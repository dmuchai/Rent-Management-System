import { Router } from "express";
import { isAuthenticated, supabase } from "../supabaseAuth";
import { supabaseStorage } from "../storageInstance";
import { insertUnitSchema } from "../../shared/schema";
import { z } from "zod";
import { buildPlanLimitError, canAddUnit } from "../../shared/subscription/index.js";
import { getOwnerSubscriptionAccess } from "../utils/subscriptionAccess";
import { createDbConnection } from "../../api/_lib/db.js";
import { lockAndCountActiveUnits } from "../../api/_lib/unitLimits.js";
import { hasScopedUnitAccess } from "../../api/_lib/leasePolicy.js";

const router = Router();

async function getCaretakerAssignments(req: any) {
  if (req.user.appRole !== 'caretaker') return [];
  const { data, error } = await supabase.from('caretaker_assignments')
    .select('property_id, unit_id')
    .eq('caretaker_id', req.user.sub)
    .eq('landlord_id', req.user.contextOwnerId)
    .eq('status', 'active');
  if (error) throw error;
  return data || [];
}

// GET /api/units?propertyId=
router.get("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const propertyId = req.query.propertyId as string | undefined;
    let units: any[];
    const ownerId = req.user.contextOwnerId;
    if (!['landlord', 'property_manager', 'caretaker'].includes(req.user.appRole)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (propertyId) {
      const { data: property } = await supabase.from('properties').select('id, owner_id').eq('id', propertyId).maybeSingle();
      if (!property) return res.status(404).json({ message: 'Property not found' });
      if (property.owner_id !== ownerId) return res.status(403).json({ message: 'Access denied' });
      units = await supabaseStorage.getUnitsByPropertyId(propertyId);
      const assignments = await getCaretakerAssignments(req);
      if (req.user.appRole === 'caretaker') {
        units = units.filter((unit: any) => hasScopedUnitAccess(
          { userId: req.user.sub, role: req.user.appRole, contextOwnerId: ownerId },
          ownerId, unit.id, unit.propertyId || unit.property_id, assignments,
        ));
      }
    } else {
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
      const assignments = await getCaretakerAssignments(req);
      if (req.user.appRole === 'caretaker') {
        units = units.filter((unit: any) => hasScopedUnitAccess(
          { userId: req.user.sub, role: req.user.appRole, contextOwnerId: ownerId },
          ownerId, unit.id, unit.propertyId, assignments,
        ));
      }
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
    if (!["landlord", "property_manager", "caretaker"].includes(req.user.appRole)) {
      return res.status(403).json({ message: "Only landlords, property managers, and caretakers can create units" });
    }
    const ownerId = req.user.contextOwnerId;
    const { data: property } = await supabase.from('properties').select('id, owner_id')
      .eq('id', unitData.propertyId).maybeSingle();
    if (!property) return res.status(404).json({ message: 'Property not found' });
    if (property.owner_id !== ownerId) return res.status(403).json({ message: 'Access denied' });
    if (req.user.appRole === 'caretaker') {
      const assignments = await getCaretakerAssignments(req);
      const hasPropertyAssignment = assignments.some((assignment: any) =>
        !assignment.unit_id && assignment.property_id === unitData.propertyId);
      if (!hasPropertyAssignment) return res.status(403).json({ message: 'Access denied' });
    }
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
router.put("/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    const unitData = insertUnitSchema.partial().parse(req.body);
    const ownerId = req.user.contextOwnerId;
    if (!['landlord', 'property_manager', 'caretaker'].includes(req.user.appRole)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const { data: currentUnit } = await supabase.from('units').select('id, property_id').eq('id', req.params.id).maybeSingle();
    if (!currentUnit) return res.status(404).json({ message: 'Unit not found' });
    const { data: currentProperty } = await supabase.from('properties').select('owner_id').eq('id', currentUnit.property_id).maybeSingle();
    if (!currentProperty || currentProperty.owner_id !== ownerId) return res.status(403).json({ message: 'Access denied' });
    if (unitData.propertyId && unitData.propertyId !== currentUnit.property_id) {
      return res.status(403).json({ message: 'Moving units between properties is not supported here' });
    }
    if (req.user.appRole === 'caretaker') {
      const assignments = await getCaretakerAssignments(req);
      const actor = { userId: req.user.sub, role: req.user.appRole, contextOwnerId: ownerId };
      if (!hasScopedUnitAccess(actor, ownerId, currentUnit.id, currentUnit.property_id, assignments)) {
        return res.status(403).json({ message: 'Access denied' });
      }
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
router.patch('/:id', isAuthenticated, async (req: any, res: any) => {
  const sql = createDbConnection();
  try {
    const ownerId = req.user.contextOwnerId;
    if (!['landlord', 'property_manager', 'caretaker'].includes(req.user.appRole)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const access = await getOwnerSubscriptionAccess(ownerId);
    const result = await sql.begin(async (tx) => {
      const activeUnits = await lockAndCountActiveUnits(tx, ownerId);
      const [unit] = await tx`SELECT u.id, u.property_id, u.archived_at, p.owner_id
        FROM public.units u JOIN public.properties p ON p.id = u.property_id
        WHERE u.id = ${req.params.id} FOR UPDATE OF u, p`;
      if (!unit) return { status: 404, body: { message: 'Unit not found' } };
      if (unit.owner_id !== ownerId) return { status: 403, body: { message: 'Access denied' } };
      if (unit.archived_at === null) return { status: 400, body: { message: 'Unit is already active' } };
      if (req.user.appRole === 'caretaker') {
        const assignments = await tx`SELECT property_id, unit_id FROM public.caretaker_assignments
          WHERE caretaker_id = ${req.user.sub} AND landlord_id = ${ownerId} AND status = 'active'`;
        const actor = { userId: req.user.sub, role: req.user.appRole, contextOwnerId: ownerId };
        if (!hasScopedUnitAccess(actor, unit.owner_id, unit.id, unit.property_id, assignments)) {
          return { status: 403, body: { message: 'Access denied' } };
        }
      }
      if (!canAddUnit(access.planCode, activeUnits)) {
        return { status: 409, body: buildPlanLimitError(access.planCode, 'active_units', activeUnits) };
      }
      await tx`UPDATE public.units SET archived_at = NULL, updated_at = NOW() WHERE id = ${unit.id}`;
      await tx`UPDATE public.properties SET total_units = (
        SELECT COUNT(*)::int FROM public.units WHERE property_id = ${unit.property_id} AND archived_at IS NULL
      ) WHERE id = ${unit.property_id}`;
      return { status: 200, body: { message: 'Unit restored successfully', id: unit.id, propertyId: unit.property_id } };
    });
    return res.status(result.status).json(result.body);
  } catch {
    return res.status(500).json({ message: 'Failed to restore unit' });
  } finally {
    await sql.end();
  }
});
router.delete("/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    const ownerId = req.user.contextOwnerId;
    if (!['landlord', 'property_manager', 'caretaker'].includes(req.user.appRole)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const { data: unit } = await supabase.from('units').select('id, property_id').eq('id', req.params.id).maybeSingle();
    if (!unit) return res.status(404).json({ message: 'Unit not found' });
    const { data: property } = await supabase.from('properties').select('owner_id').eq('id', unit.property_id).maybeSingle();
    if (!property || property.owner_id !== ownerId) return res.status(403).json({ message: 'Access denied' });
    if (req.user.appRole === 'caretaker') {
      const assignments = await getCaretakerAssignments(req);
      const actor = { userId: req.user.sub, role: req.user.appRole, contextOwnerId: ownerId };
      if (!hasScopedUnitAccess(actor, ownerId, unit.id, unit.property_id, assignments)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }
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
