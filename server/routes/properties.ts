import { Router } from "express";
import { isAuthenticated } from "../supabaseAuth";
import { supabaseStorage } from "../storageInstance";
import { insertPropertySchema } from "../../shared/schema";
import { requirePropertyOwnership } from "../middleware/ownership";
import { z } from "zod";
import { buildPlanLimitError, canAddProperty } from "../../shared/subscription/index.js";
import { getOwnerSubscriptionAccess } from "../utils/subscriptionAccess";
import { supabase } from "../supabaseAuth";

const router = Router();

// ─── Properties ───────────────────────────────────────────────────────────────

router.get("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const properties = await supabaseStorage.getPropertiesByOwnerId(userId) || [];
    res.json(properties);
  } catch {
    res.status(500).json({ message: "Failed to fetch properties" });
  }
});

router.get("/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const property = await supabaseStorage.getPropertyById(req.params.id);

    if (!property) return res.status(404).json({ message: "Property not found" });

    const propertyOwnerId = property.ownerId || (property as any).owner_id;
    if (propertyOwnerId && propertyOwnerId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(property);
  } catch {
    res.status(500).json({ message: "Failed to fetch property" });
  }
});

router.post("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const { planCode } = await getOwnerSubscriptionAccess(userId);
    const { count } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .is("archived_at", null);
    const activeProperties = Number(count || 0);
    if (!canAddProperty(planCode, activeProperties)) {
      return res.status(409).json(buildPlanLimitError(planCode, "active_properties", activeProperties));
    }
    const propertyData = insertPropertySchema.parse({ ...req.body, ownerId: userId });
    const property = await supabaseStorage.createProperty(propertyData);
    res.status(201).json(property);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to create property" });
  }
});

router.put("/:id", isAuthenticated, requirePropertyOwnership, async (req: any, res: any) => {
  try {
    const propertyData = insertPropertySchema.partial().parse(req.body);
    const property = await supabaseStorage.updateProperty(req.params.id, propertyData);
    res.json(property);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to update property" });
  }
});

router.patch("/:id/restore", isAuthenticated, requirePropertyOwnership, async (req: any, res: any) => {
  try {
    const ownerId = req.user.sub;
    const { planCode } = await getOwnerSubscriptionAccess(ownerId);
    const { count } = await supabase.from("properties").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).is("archived_at", null);
    const activeProperties = Number(count || 0);
    if (!canAddProperty(planCode, activeProperties)) {
      return res.status(409).json(buildPlanLimitError(planCode, "active_properties", activeProperties));
    }
    const { data, error } = await supabase.from("properties").update({ archived_at: null, updated_at: new Date().toISOString() }).eq("id", req.params.id).select("*").single();
    if (error) throw error;
    res.json(data);
  } catch {
    res.status(500).json({ message: "Failed to restore property" });
  }
});

router.delete("/:id", isAuthenticated, requirePropertyOwnership, async (req: any, res: any) => {
  try {
    const { error } = await supabase
      .from("properties")
      .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ message: "Property archived successfully", id: req.params.id });
  } catch {
    res.status(500).json({ message: "Failed to delete property" });
  }
});

// ─── Units (nested under /properties/:propertyId/units) ───────────────────────

router.get("/:propertyId/units", isAuthenticated, requirePropertyOwnership, async (req: any, res: any) => {
  try {
    const units = await supabaseStorage.getUnitsByPropertyId(req.params.propertyId) || [];
    res.json(units);
  } catch {
    res.status(500).json({ message: "Failed to fetch units" });
  }
});

export default router;
