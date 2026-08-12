import { Router } from "express";
import { isAuthenticated, supabase } from "../supabaseAuth";
import { supabaseStorage } from "../storageInstance";
import { insertUnitSchema } from "../../shared/schema";
import { ensurePropertyOwnership, requireUnitOwnership } from "../middleware/ownership";
import { z } from "zod";
import { buildPlanLimitError, canAddUnit } from "../../shared/subscription/index.js";
import { getOwnerSubscriptionAccess } from "../utils/subscriptionAccess";

const router = Router();

// GET /api/units?propertyId=
router.get("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const propertyId = req.query.propertyId as string | undefined;
    let units: any[];

    if (propertyId) {
      if (!(await ensurePropertyOwnership(req, res, propertyId))) {
        return;
      }
      units = await supabaseStorage.getUnitsByPropertyId(propertyId);
    } else {
      const ownerId = req.user.sub;
      const { data: properties, error: propertiesError } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_id", ownerId);

      if (propertiesError) return res.status(500).json({ message: "Failed to fetch units" });

      const propertyIds = (properties || []).map((p: any) => p.id);
      if (propertyIds.length === 0) return res.json([]);

      const { data: unitRows, error: unitsError } = await supabase
        .from("units")
        .select("*")
        .in("property_id", propertyIds)
        .order("unit_number", { ascending: true });

      if (unitsError) return res.status(500).json({ message: "Failed to fetch units" });

      units = (unitRows || []).map((unit: any) => ({
        id: unit.id,
        propertyId: unit.property_id,
        unitNumber: unit.unit_number,
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        size: unit.size,
        rentAmount: unit.rent_amount,
        isOccupied: unit.is_occupied,
        createdAt: unit.created_at,
        updatedAt: unit.updated_at,
      }));
    }

    res.json(units || []);
  } catch {
    res.status(500).json({ message: "Failed to fetch units" });
  }
});

// POST /api/units
router.post("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const unitData = insertUnitSchema.parse(req.body);
    if (!(await ensurePropertyOwnership(req, res, unitData.propertyId))) {
      return;
    }
    const ownerId = req.user.sub;
    const { planCode } = await getOwnerSubscriptionAccess(ownerId);
    const { data: ownerProperties } = await supabase.from("properties").select("id").eq("owner_id", ownerId).is("archived_at", null);
    const propertyIds = (ownerProperties || []).map((property: any) => property.id);
    const { count } = propertyIds.length === 0
      ? { count: 0 }
      : await supabase.from("units").select("id", { count: "exact", head: true }).in("property_id", propertyIds).is("archived_at", null);
    const activeUnits = Number(count || 0);
    if (!canAddUnit(planCode, activeUnits)) {
      return res.status(409).json(buildPlanLimitError(planCode, "active_units", activeUnits));
    }
    const unit = await supabaseStorage.createUnit(unitData);
    res.status(201).json(unit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    res.status(500).json({
      message: "Failed to create unit",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// PUT /api/units/:id
router.put("/:id", isAuthenticated, requireUnitOwnership, async (req: any, res: any) => {
  try {
    const unitData = insertUnitSchema.partial().parse(req.body);
    if (unitData.propertyId && !(await ensurePropertyOwnership(req, res, unitData.propertyId))) {
      return;
    }
    const unit = await supabaseStorage.updateUnit(req.params.id, unitData);
    res.json(unit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to update unit" });
  }
});

// DELETE /api/units/:id
router.delete("/:id", isAuthenticated, requireUnitOwnership, async (req: any, res: any) => {
  try {
    const { error } = await supabase
      .from("units")
      .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ message: "Unit archived successfully" });
  } catch {
    res.status(500).json({ message: "Failed to delete unit" });
  }
});

export default router;
