import { Router } from "express";
import { isAuthenticated, supabase } from "../supabaseAuth";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const ownerId = req.user.sub;
    const { data: properties } = await supabase.from("properties").select("*").eq("owner_id", ownerId).order("created_at");
    const propertyIds = (properties || []).map((row: any) => row.id);
    const { data: units } = propertyIds.length ? await supabase.from("units").select("*").in("property_id", propertyIds).order("created_at") : { data: [] };
    const unitIds = (units || []).map((row: any) => row.id);
    const { data: tenants } = await supabase.from("tenants").select("*").eq("landlord_id", ownerId).order("created_at");
    const { data: leases } = unitIds.length ? await supabase.from("leases").select("*").in("unit_id", unitIds).order("created_at") : { data: [] };
    const leaseIds = (leases || []).map((row: any) => row.id);
    const { data: payments } = leaseIds.length ? await supabase.from("payments").select("*").in("lease_id", leaseIds).order("created_at") : { data: [] };
    const { data: maintenanceRequests } = unitIds.length ? await supabase.from("maintenance_requests").select("*").in("unit_id", unitIds).order("created_at") : { data: [] };
    res.json({ exportedAt: new Date().toISOString(), properties, units, tenants, leases, payments, maintenanceRequests });
  } catch (error) {
    res.status(500).json({ message: "Failed to export account data" });
  }
});

export default router;
