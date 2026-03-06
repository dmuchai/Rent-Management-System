import { Router } from "express";
import { isAuthenticated, supabase } from "../supabaseAuth";
import { supabaseStorage } from "../storageInstance";
import { getCaretakerUnitIds } from "../utils/caretakerHelpers";
const router = Router();

// GET /api/dashboard/stats
router.get("/stats", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;

    if (role === "tenant") {
      const tenant = await supabaseStorage.getTenantByUserId(userId);
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });

      const tenantLeases = await supabaseStorage.getLeasesByTenantId(tenant.id);
      const activeLease = tenantLeases.find((l) => l.isActive);
      const leaseIds = tenantLeases.map((l) => l.id);
      const { data: paymentRows } = leaseIds.length
        ? await supabase.from("payments").select("*").in("lease_id", leaseIds)
        : { data: [] };
      const payments = paymentRows || [];
      const maintenanceRequests = await supabaseStorage.getMaintenanceRequestsByTenantId(tenant.id);

      const completedPayments = payments.filter((p: any) => p.status === "completed" || p.status === "paid");
      const totalPaid = completedPayments.reduce((sum: number, p: any) => sum + parseFloat(String(p.amount || "0")), 0);

      return res.json({
        tenant: {
          id: tenant.id, firstName: tenant.firstName, lastName: tenant.lastName,
          email: tenant.email, status: tenant.approvalStatus,
        },
        activeLease: activeLease
          ? {
              id: activeLease.id, startDate: activeLease.startDate, endDate: activeLease.endDate,
              monthlyRent: activeLease.monthlyRent, status: activeLease.status,
              unitId: activeLease.unitId, tenantSignedAt: activeLease.tenantSignedAt,
              landlordSignedAt: activeLease.landlordSignedAt,
            }
          : null,
        payments: { total: payments.length, completed: completedPayments.length, totalPaid },
        maintenanceRequests: {
          total: maintenanceRequests.length,
          open: maintenanceRequests.filter((r: any) => r.status === "open").length,
          inProgress: maintenanceRequests.filter((r: any) => r.status === "in_progress").length,
          completed: maintenanceRequests.filter((r: any) => r.status === "completed").length,
        },
      });
    }

    if (role === "caretaker") {
      const unitIds = await getCaretakerUnitIds(userId);

      const { data: assignments } = await supabase
        .from("caretaker_assignments").select("property_id").eq("caretaker_id", userId).eq("status", "active");
      const propertyIds = Array.from(new Set((assignments || []).map((a: any) => a.property_id)));

      const { count: tenantsCount } = await supabase
        .from("tenants").select("*", { count: "exact", head: true }).in("unit_id", unitIds);
      const { count: maintenanceCount } = await supabase
        .from("maintenance_requests").select("*", { count: "exact", head: true }).in("unit_id", unitIds);
      const { data: maintenanceData } = await supabase
        .from("maintenance_requests").select("status").in("unit_id", unitIds);

      return res.json({
        caretaker: { userId },
        assignedProperties: propertyIds.length,
        assignedUnits: unitIds.length,
        tenants: tenantsCount || 0,
        maintenanceRequests: {
          total: maintenanceCount || 0,
          open: (maintenanceData || []).filter((r: any) => r.status === "open").length,
          inProgress: (maintenanceData || []).filter((r: any) => r.status === "in_progress").length,
          completed: (maintenanceData || []).filter((r: any) => r.status === "completed").length,
        },
      });
    }

    // Landlord
    const properties = await supabaseStorage.getPropertiesByOwnerId(userId);
    const propertyIds = properties.map((p) => p.id);

    let totalUnits = 0, occupiedUnits = 0;
    await Promise.all(
      properties.map(async (property) => {
        const units = await supabaseStorage.getUnitsByPropertyId(property.id);
        totalUnits += units.length;
        occupiedUnits += units.filter((u) => u.isOccupied).length;
      })
    );

    const tenants = await supabaseStorage.getTenantsByOwnerId(userId);
    const totalPayments = await supabaseStorage.getPaymentsByOwnerId(userId);
    const completedPayments = totalPayments.filter((p: any) => p.status === "completed" || p.status === "paid");
    const totalRevenue = completedPayments.reduce((sum: number, p: any) => sum + parseFloat(String(p.amount || "0")), 0);

    const { data: maintenanceData } = await supabase
      .from("maintenance_requests")
      .select("status, units!inner(properties!inner(owner_id))")
      .eq("units.properties.owner_id", userId);

    const maintenanceRequests = maintenanceData || [];

    res.json({
      properties: { total: properties.length, ids: propertyIds },
      units: { total: totalUnits, occupied: occupiedUnits, vacant: totalUnits - occupiedUnits, occupancyRate: totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0 },
      tenants: { total: tenants.length, active: tenants.filter((t: any) => t.status === "active").length, pending: tenants.filter((t: any) => t.status === "pending").length },
      payments: { total: totalPayments.length, completed: completedPayments.length, totalRevenue },
      maintenanceRequests: {
        total: maintenanceRequests.length,
        open: maintenanceRequests.filter((r: any) => r.status === "open").length,
        inProgress: maintenanceRequests.filter((r: any) => r.status === "in_progress").length,
        completed: maintenanceRequests.filter((r: any) => r.status === "completed").length,
      },
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
});

export default router;
