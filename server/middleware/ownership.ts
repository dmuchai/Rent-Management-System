import type { Request, Response, NextFunction } from "express";
import { supabase } from "../supabaseAuth";

const ALLOWED_MANAGEMENT_ROLES = new Set(["landlord", "property_manager", "admin"]);

function getActor(req: Request) {
  const user = (req as any).user;
  return {
    userId: user?.sub as string | undefined,
    role: user?.appRole as string | undefined,
  };
}

export async function ensurePropertyOwnership(req: Request, res: Response, propertyId: string): Promise<boolean> {
  const { userId, role } = getActor(req);

  if (!userId || !role) {
    res.status(401).json({ message: "Unauthorized" });
    return false;
  }

  if (!ALLOWED_MANAGEMENT_ROLES.has(role)) {
    res.status(403).json({ message: "Forbidden" });
    return false;
  }

  const { data: property, error } = await supabase
    .from("properties")
    .select("id, owner_id")
    .eq("id", propertyId)
    .single();

  if (error || !property) {
    res.status(404).json({ message: "Property not found" });
    return false;
  }

  if (property.owner_id !== userId) {
    res.status(403).json({ message: "Forbidden" });
    return false;
  }

  return true;
}

export async function requirePropertyOwnership(req: Request, res: Response, next: NextFunction) {
  const propertyId = (req.params.propertyId || req.params.id) as string | undefined;
  if (!propertyId) {
    return res.status(400).json({ message: "Property ID is required" });
  }

  if (!(await ensurePropertyOwnership(req, res, propertyId))) {
    return;
  }

  next();
}

export async function requireUnitOwnership(req: Request, res: Response, next: NextFunction) {
  const unitId = (req.params.unitId || req.params.id) as string | undefined;
  if (!unitId) {
    return res.status(400).json({ message: "Unit ID is required" });
  }

  const { data: unit, error } = await supabase
    .from("units")
    .select("id, property_id")
    .eq("id", unitId)
    .single();

  if (error || !unit) {
    return res.status(404).json({ message: "Unit not found" });
  }

  if (!(await ensurePropertyOwnership(req, res, unit.property_id))) {
    return;
  }

  next();
}
