import { Router } from "express";
import { isAuthenticated, supabase } from "../supabaseAuth";
import { supabaseStorage } from "../storageInstance";
import { insertPropertySchema, insertUnitSchema } from "../../shared/schema";
import { z } from "zod";

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

router.put("/:id", isAuthenticated, async (req: any, res: any) => {
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

router.delete("/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    await supabaseStorage.deleteProperty(req.params.id);
    res.status(204).send();
  } catch {
    res.status(500).json({ message: "Failed to delete property" });
  }
});

// ─── Units (nested under /properties/:propertyId/units) ───────────────────────

router.get("/:propertyId/units", isAuthenticated, async (req: any, res: any) => {
  try {
    const units = await supabaseStorage.getUnitsByPropertyId(req.params.propertyId) || [];
    res.json(units);
  } catch {
    res.status(500).json({ message: "Failed to fetch units" });
  }
});

export default router;
