import { supabase } from "../supabaseAuth";
import { SupabaseStorage } from "../storage";

/**
 * Attempts to automatically create a lease when a tenant is approved and has a unit
 * assignment in place. Returns the created lease or a reason string explaining why
 * no lease was created.
 */
export async function tryAutoCreateLeaseForTenant(
  supabaseStorage: SupabaseStorage,
  tenantId: string,
  landlordId: string,
  actorId: string
) {
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select(
      "id, landlord_id, approval_status, assigned_unit_id, assigned_start_date, assigned_end_date, assigned_monthly_rent, assigned_security_deposit"
    )
    .eq("id", tenantId)
    .single();

  if (tenantError || !tenant) {
    return { lease: null, reason: "tenant_not_found" };
  }

  if (tenant.landlord_id !== landlordId) {
    return { lease: null, reason: "unauthorized" };
  }

  if (tenant.approval_status !== "approved") {
    return { lease: null, reason: "not_approved" };
  }

  if (
    !tenant.assigned_unit_id ||
    !tenant.assigned_start_date ||
    !tenant.assigned_end_date ||
    !tenant.assigned_monthly_rent
  ) {
    return { lease: null, reason: "missing_assignment" };
  }

  const { data: tenantLease } = await supabase
    .from("leases")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .in("status", ["pending_landlord_signature", "pending_tenant_signature", "active"])
    .limit(1);

  if ((tenantLease || []).length > 0) {
    return { lease: null, reason: "tenant_has_lease" };
  }

  const { data: unitLease } = await supabase
    .from("leases")
    .select("id, status")
    .eq("unit_id", tenant.assigned_unit_id)
    .in("status", ["pending_landlord_signature", "pending_tenant_signature", "active"])
    .limit(1);

  if ((unitLease || []).length > 0) {
    return { lease: null, reason: "unit_occupied" };
  }

  const lease = await supabaseStorage.createLease({
    tenantId,
    unitId: tenant.assigned_unit_id,
    startDate: new Date(tenant.assigned_start_date),
    endDate: new Date(tenant.assigned_end_date),
    monthlyRent: tenant.assigned_monthly_rent,
    securityDeposit: tenant.assigned_security_deposit || "0",
    isActive: false,
    status: "pending_tenant_signature",
    landlordSignedAt: new Date(),
    landlordSignedBy: landlordId,
    createdBy: actorId,
  });

  return { lease, reason: null };
}
