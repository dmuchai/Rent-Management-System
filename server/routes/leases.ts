import { Router } from "express";
import { isAuthenticated, supabase } from "../supabaseAuth";
import { supabaseStorage } from "../storageInstance";
import { getCaretakerUnitIds } from "../utils/caretakerHelpers";
import { z } from "zod";

const router = Router();

// GET /api/leases
router.get("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;
    let leases: any[] = [];

    if (role === "tenant") {
      const tenant = await supabaseStorage.getTenantByUserId(userId);
      if (tenant) {
        leases = await supabaseStorage.getLeasesByTenantId(tenant.id);
      }
    } else if (role === "caretaker") {
      const unitIds = await getCaretakerUnitIds(userId);
      if (unitIds.length === 0) return res.json([]);

      const { data: leaseRows, error } = await supabase
        .from("leases").select("*").in("unit_id", unitIds).order("created_at", { ascending: false });

      if (error) return res.status(500).json({ message: "Failed to fetch leases" });

      leases = await Promise.all(
        (leaseRows || []).map(async (lease: any) => {
          const unit = await supabaseStorage.getUnitById(lease.unit_id);
          const tenant = await supabaseStorage.getTenantById(lease.tenant_id);
          const property = unit ? await supabaseStorage.getPropertyById(unit.propertyId) : null;
          return {
            id: lease.id, tenantId: lease.tenant_id, unitId: lease.unit_id,
            startDate: lease.start_date, endDate: lease.end_date, monthlyRent: lease.monthly_rent,
            securityDeposit: lease.security_deposit, leaseDocumentUrl: lease.lease_document_url,
            status: lease.status, landlordSignedAt: lease.landlord_signed_at, tenantSignedAt: lease.tenant_signed_at,
            landlordSignedBy: lease.landlord_signed_by, tenantSignedBy: lease.tenant_signed_by,
            createdBy: lease.created_by, isActive: lease.is_active, createdAt: lease.created_at, updatedAt: lease.updated_at,
            property: property ? { id: property.id, name: property.name, address: property.address, propertyType: property.propertyType } : null,
            unit: unit ? { id: unit.id, unitNumber: unit.unitNumber, property: property ? { id: property.id, name: property.name, address: property.address, propertyType: property.propertyType } : null } : null,
            tenant: tenant ? { id: tenant.id, firstName: tenant.firstName, lastName: tenant.lastName, email: tenant.email } : null,
          };
        })
      );
    } else {
      leases = await supabaseStorage.getLeasesByOwnerId(userId);
    }

    res.json(leases);
  } catch {
    res.status(500).json({ message: "Failed to fetch leases" });
  }
});

// POST /api/leases
router.post("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;

    if (role === "tenant") return res.status(403).json({ message: "Tenants cannot create leases" });

    const leaseCreateSchema = z.object({
      tenantId: z.string().min(1),
      unitId: z.string().min(1),
      startDate: z.string().min(1),
      endDate: z.string().min(1),
      monthlyRent: z.string().min(1),
      securityDeposit: z.string().optional(),
    });

    const leaseData = leaseCreateSchema.parse(req.body);

    const unit = await supabaseStorage.getUnitById(leaseData.unitId);
    if (!unit) return res.status(404).json({ message: "Unit not found" });

    const property = await supabaseStorage.getPropertyById(unit.propertyId);
    if (!property) return res.status(404).json({ message: "Property not found" });

    const owner = property.ownerId || (property as any).owner_id;
    if (role !== "caretaker" && owner !== userId) {
      return res.status(403).json({ message: "Unauthorized: Unit does not belong to you" });
    }

    if (role === "caretaker") {
      const { data: assignment } = await supabase
        .from("caretaker_assignments").select("id")
        .eq("caretaker_id", userId).eq("property_id", property.id).eq("status", "active").maybeSingle();
      if (!assignment) return res.status(403).json({ message: "Caretaker not assigned to this property" });
    }

    const existingLeases = await supabaseStorage.getLeasesByOwnerId(owner);
    if (existingLeases.find((l) => l.unitId === leaseData.unitId && l.isActive)) {
      return res.status(400).json({ message: "Unit is already occupied by an active lease" });
    }

    const tenant = await supabaseStorage.getTenantById(leaseData.tenantId);
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    const tenantLandlordId = (tenant as any).landlordId || (tenant as any).landlord_id;
    if (tenantLandlordId && tenantLandlordId !== owner) {
      return res.status(403).json({ message: "Unauthorized: Tenant does not belong to this landlord" });
    }

    const isCaretaker = role === "caretaker";
    const lease = await supabaseStorage.createLease({
      tenantId: leaseData.tenantId, unitId: leaseData.unitId,
      startDate: new Date(leaseData.startDate), endDate: new Date(leaseData.endDate),
      monthlyRent: leaseData.monthlyRent, securityDeposit: leaseData.securityDeposit || "0",
      isActive: false,
      status: isCaretaker ? "pending_landlord_signature" : "pending_tenant_signature",
      landlordSignedAt: isCaretaker ? null : new Date(),
      landlordSignedBy: isCaretaker ? null : userId,
      createdBy: userId,
    });

    res.status(201).json(lease);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: error.errors });
    res.status(500).json({ message: "Failed to create lease" });
  }
});

// POST /api/leases/:id/landlord-sign
router.post("/:id/landlord-sign", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;

    if (role !== "landlord") return res.status(403).json({ message: "Only landlords can sign leases" });

    const { data: lease, error: leaseError } = await supabase
      .from("leases").select("*").eq("id", req.params.id).single();

    if (leaseError || !lease) return res.status(404).json({ message: "Lease not found" });

    const unit = await supabaseStorage.getUnitById(lease.unit_id);
    const property = unit ? await supabaseStorage.getPropertyById(unit.propertyId) : null;
    const owner = property ? (property.ownerId || (property as any).owner_id) : null;

    if (!owner || owner !== userId) return res.status(403).json({ message: "Unauthorized" });
    if (lease.status !== "pending_landlord_signature") return res.status(400).json({ message: "Lease is not awaiting landlord signature" });

    const { data: updated, error: updateError } = await supabase
      .from("leases")
      .update({ status: "pending_tenant_signature", landlord_signed_at: new Date().toISOString(), landlord_signed_by: userId, updated_at: new Date().toISOString() })
      .eq("id", req.params.id).select().single();

    if (updateError) return res.status(500).json({ message: "Failed to sign lease" });
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to sign lease" });
  }
});

// POST /api/leases/:id/tenant-sign
router.post("/:id/tenant-sign", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;

    if (role !== "tenant") return res.status(403).json({ message: "Only tenants can sign leases" });

    const { data: lease, error: leaseError } = await supabase
      .from("leases").select("*").eq("id", req.params.id).single();

    if (leaseError || !lease) return res.status(404).json({ message: "Lease not found" });
    if (lease.status !== "pending_tenant_signature") return res.status(400).json({ message: "Lease is not awaiting tenant signature" });

    const tenant = await supabaseStorage.getTenantByUserId(userId);
    if (!tenant || tenant.id !== lease.tenant_id) return res.status(403).json({ message: "Unauthorized" });

    const { data: updated, error: updateError } = await supabase
      .from("leases")
      .update({ status: "active", tenant_signed_at: new Date().toISOString(), tenant_signed_by: userId, is_active: true, updated_at: new Date().toISOString() })
      .eq("id", req.params.id).select().single();

    if (updateError) return res.status(500).json({ message: "Failed to sign lease" });

    await supabaseStorage.updateUnit(lease.unit_id, { isOccupied: true });
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to sign lease" });
  }
});

export default router;
