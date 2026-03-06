import { Router } from "express";
import { isAuthenticated, supabase } from "../supabaseAuth";
import { supabaseStorage } from "../storageInstance";
import { insertTenantSchema } from "../../shared/schema";
import { mapTenantRow } from "../utils/mappers";
import { getCaretakerUnitIds, caretakerHasLandlordAccess } from "../utils/caretakerHelpers";
import { tryAutoCreateLeaseForTenant } from "../utils/leaseHelpers";
import { z } from "zod";
import crypto from "crypto";
import { emailService } from "../services/emailService";

const router = Router();

// GET /api/tenants
router.get("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;

    if (role === "tenant") return res.status(403).json({ message: "Tenants cannot list all tenants" });

    if (role === "caretaker") {
      const unitIds = await getCaretakerUnitIds(userId);

      if (unitIds.length === 0) {
        const { data, error } = await supabase.from("tenants").select("*").eq("created_by", userId).order("created_at", { ascending: true });
        if (error) return res.status(500).json({ message: "Failed to fetch tenants" });
        return res.json((data || []).map(mapTenantRow));
      }

      const { data: leases, error: leasesError } = await supabase.from("leases").select("tenant_id").in("unit_id", unitIds);
      if (leasesError) return res.status(500).json({ message: "Failed to fetch tenants" });

      const tenantIds = Array.from(new Set((leases || []).map((l: any) => l.tenant_id)));

      if (tenantIds.length === 0) {
        const { data, error } = await supabase.from("tenants").select("*").eq("created_by", userId).order("created_at", { ascending: true });
        if (error) return res.status(500).json({ message: "Failed to fetch tenants" });
        return res.json((data || []).map(mapTenantRow));
      }

      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .or(`id.in.(${tenantIds.join(",")}),created_by.eq.${userId}`)
        .order("created_at", { ascending: true });

      if (error) return res.status(500).json({ message: "Failed to fetch tenants" });
      return res.json((data || []).map(mapTenantRow));
    }

    const tenants = await supabaseStorage.getTenantsByOwnerId(userId) || [];
    res.json(tenants);
  } catch {
    res.status(500).json({ message: "Failed to fetch tenants" });
  }
});

// GET /api/tenants/me
router.get("/me", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const tenant = await supabaseStorage.getTenantByUserId(userId);
    if (!tenant) return res.status(404).json({ message: "Tenant profile not found" });
    res.json(tenant);
  } catch {
    res.status(500).json({ message: "Failed to fetch tenant profile" });
  }
});

// POST /api/tenants
router.post("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const landlordId = req.user.sub;
    const role = req.user.appRole;

    if (role === "tenant") return res.status(403).json({ message: "Tenants cannot create tenants" });

    if (role === "caretaker") {
      const caretakerTenantSchema = insertTenantSchema.extend({
        propertyId: z.string().min(1, "Property is required"),
      });
      const caretakerTenantData = caretakerTenantSchema.parse(req.body);

      const { data: property, error: propertyError } = await supabase
        .from("properties").select("id, owner_id, name").eq("id", caretakerTenantData.propertyId).single();

      if (propertyError || !property) return res.status(404).json({ message: "Property not found" });

      const hasAccess = await caretakerHasLandlordAccess(req.user.sub, property.owner_id);
      if (!hasAccess) return res.status(403).json({ message: "Caretaker not assigned to this landlord" });

      const { data: assignment } = await supabase
        .from("caretaker_assignments").select("id")
        .eq("caretaker_id", req.user.sub).eq("property_id", property.id).eq("status", "active").maybeSingle();

      if (!assignment) return res.status(403).json({ message: "Caretaker not assigned to this property" });

      const invitationToken = crypto.randomBytes(32).toString("hex");

      const { data, error } = await supabase
        .from("tenants")
        .insert([{
          landlord_id: property.owner_id,
          user_id: caretakerTenantData.userId || null,
          first_name: caretakerTenantData.firstName,
          last_name: caretakerTenantData.lastName,
          email: caretakerTenantData.email,
          phone: caretakerTenantData.phone,
          emergency_contact: caretakerTenantData.emergencyContact || null,
          invitation_token: invitationToken,
          account_status: "pending_invitation",
          created_by: req.user.sub,
          approval_status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select().single();

      if (error) return res.status(500).json({ message: "Failed to create tenant" });

      const { data: landlordProfile } = await supabase
        .from("users").select("first_name, last_name").eq("id", property.owner_id).single();

      try {
        await emailService.sendTenantInvitation(
          data.email, `${data.first_name} ${data.last_name}`, invitationToken, property.name, undefined,
          landlordProfile ? `${landlordProfile.first_name} ${landlordProfile.last_name}` : undefined
        );
        const { data: updatedTenant } = await supabase
          .from("tenants")
          .update({ invitation_sent_at: new Date().toISOString(), account_status: "invited" })
          .eq("id", data.id).select().single();
        return res.status(201).json(mapTenantRow(updatedTenant));
      } catch {
        return res.status(201).json(mapTenantRow(data));
      }
    }

    const tenantData = insertTenantSchema.parse(req.body);
    const tenant = await supabaseStorage.createTenant(tenantData, landlordId);
    res.status(201).json(tenant);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: error.errors });
    res.status(500).json({ message: "Failed to create tenant" });
  }
});

// PUT /api/tenants/:id
router.put("/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    const role = req.user.appRole;

    if (role === "tenant") return res.status(403).json({ message: "Tenants cannot update tenant records" });

    if (role === "caretaker") {
      const { data: existingTenant, error } = await supabase
        .from("tenants").select("id, created_by").eq("id", req.params.id).single();

      if (error || !existingTenant) return res.status(404).json({ message: "Tenant not found" });
      if (existingTenant.created_by !== req.user.sub) return res.status(403).json({ message: "Caretaker cannot update this tenant" });

      const updateSchema = z.object({
        firstName: z.string().min(1).optional(), lastName: z.string().min(1).optional(),
        email: z.string().email().optional(), phone: z.string().min(1).optional(),
        emergencyContact: z.string().optional(),
      });

      const updateData = updateSchema.parse(req.body);
      const dbUpdate: any = { updated_at: new Date().toISOString() };
      if (updateData.firstName !== undefined) dbUpdate.first_name = updateData.firstName;
      if (updateData.lastName !== undefined) dbUpdate.last_name = updateData.lastName;
      if (updateData.email !== undefined) dbUpdate.email = updateData.email;
      if (updateData.phone !== undefined) dbUpdate.phone = updateData.phone;
      if (updateData.emergencyContact !== undefined) dbUpdate.emergency_contact = updateData.emergencyContact;

      const { data, error: updateError } = await supabase
        .from("tenants").update(dbUpdate).eq("id", req.params.id).select().single();

      if (updateError) return res.status(500).json({ message: "Failed to update tenant" });
      return res.json(mapTenantRow(data));
    }

    const tenantData = insertTenantSchema.partial().parse(req.body);
    const tenant = await supabaseStorage.updateTenant(req.params.id, tenantData);
    res.json(tenant);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: error.errors });
    res.status(500).json({ message: "Failed to update tenant" });
  }
});

// PUT /api/tenants/:id/approve
router.put("/:id/approve", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;

    if (role !== "landlord" && role !== "property_manager") {
      return res.status(403).json({ message: "Only landlords can approve tenants" });
    }

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants").select("id, landlord_id, approval_status").eq("id", req.params.id).single();

    if (tenantError || !tenant) return res.status(404).json({ message: "Tenant not found" });
    if (tenant.landlord_id !== userId) return res.status(403).json({ message: "Unauthorized" });

    const { data, error } = await supabase
      .from("tenants")
      .update({ approval_status: "approved", approved_by: userId, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", req.params.id).select().single();

    if (error) return res.status(500).json({ message: "Failed to approve tenant" });

    const autoLease = await tryAutoCreateLeaseForTenant(supabaseStorage, req.params.id, userId, userId);
    return res.json({ tenant: mapTenantRow(data), leaseCreated: !!autoLease.lease, lease: autoLease.lease, leaseReason: autoLease.reason });
  } catch {
    res.status(500).json({ message: "Failed to approve tenant" });
  }
});

// PUT /api/tenants/:id/assign
router.put("/:id/assign", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;

    if (role !== "landlord" && role !== "property_manager") {
      return res.status(403).json({ message: "Only landlords can assign units" });
    }

    const assignSchema = z.object({
      unitId: z.string().min(1),
      startDate: z.string().min(1),
      endDate: z.string().min(1),
      monthlyRent: z.string().optional(),
      securityDeposit: z.string().optional(),
    });

    const assignment = assignSchema.parse(req.body);

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants").select("id, landlord_id").eq("id", req.params.id).single();

    if (tenantError || !tenant) return res.status(404).json({ message: "Tenant not found" });
    if (tenant.landlord_id !== userId) return res.status(403).json({ message: "Unauthorized" });

    const unit = await supabaseStorage.getUnitById(assignment.unitId);
    if (!unit) return res.status(404).json({ message: "Unit not found" });

    const property = await supabaseStorage.getPropertyById(unit.propertyId);
    if (!property) return res.status(404).json({ message: "Property not found" });

    const owner = property.ownerId || (property as any).owner_id;
    if (owner !== userId) return res.status(403).json({ message: "Unauthorized: Unit does not belong to you" });

    if (new Date(assignment.endDate) <= new Date(assignment.startDate)) {
      return res.status(400).json({ message: "End date must be after start date" });
    }

    const { data: conflicts } = await supabase
      .from("leases").select("id").eq("unit_id", assignment.unitId)
      .in("status", ["pending_landlord_signature", "pending_tenant_signature", "active"])
      .lt("start_date", assignment.endDate).gt("end_date", assignment.startDate);

    if (conflicts && conflicts.length > 0) return res.status(409).json({ message: "Unit has a conflicting lease" });

    const { data, error } = await supabase
      .from("tenants")
      .update({
        assigned_unit_id: assignment.unitId, assigned_start_date: assignment.startDate,
        assigned_end_date: assignment.endDate, assigned_monthly_rent: assignment.monthlyRent || unit.rentAmount || "0",
        assigned_security_deposit: assignment.securityDeposit || null,
        assigned_at: new Date().toISOString(), assigned_by: userId, updated_at: new Date().toISOString(),
      })
      .eq("id", req.params.id).select().single();

    if (error) return res.status(500).json({ message: "Failed to assign unit" });

    const autoLease = await tryAutoCreateLeaseForTenant(supabaseStorage, req.params.id, userId, userId);
    return res.json({ tenant: mapTenantRow(data), leaseCreated: !!autoLease.lease, lease: autoLease.lease, leaseReason: autoLease.reason });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: error.errors });
    res.status(500).json({ message: "Failed to assign unit" });
  }
});

// PUT /api/tenants/:id/reject
router.put("/:id/reject", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;

    if (role !== "landlord" && role !== "property_manager") {
      return res.status(403).json({ message: "Only landlords can reject tenants" });
    }

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants").select("id, landlord_id").eq("id", req.params.id).single();

    if (tenantError || !tenant) return res.status(404).json({ message: "Tenant not found" });
    if (tenant.landlord_id !== userId) return res.status(403).json({ message: "Unauthorized" });

    const { data, error } = await supabase
      .from("tenants")
      .update({ approval_status: "rejected", approved_by: userId, updated_at: new Date().toISOString() })
      .eq("id", req.params.id).select().single();

    if (error) return res.status(500).json({ message: "Failed to reject tenant" });
    return res.json(mapTenantRow(data));
  } catch {
    res.status(500).json({ message: "Failed to reject tenant" });
  }
});

export default router;
