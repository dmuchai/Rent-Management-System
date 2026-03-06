/**
 * Row-mapping helpers shared across tenant and caretaker route modules.
 */

export function mapTenantRow(tenant: any) {
  return {
    id: tenant.id,
    landlordId: tenant.landlord_id,
    userId: tenant.user_id,
    firstName: tenant.first_name,
    lastName: tenant.last_name,
    email: tenant.email,
    phone: tenant.phone,
    emergencyContact: tenant.emergency_contact,
    accountStatus: tenant.account_status,
    approvalStatus: tenant.approval_status,
    approvedBy: tenant.approved_by,
    approvedAt: tenant.approved_at,
    assignedUnitId: tenant.assigned_unit_id,
    assignedStartDate: tenant.assigned_start_date,
    assignedEndDate: tenant.assigned_end_date,
    assignedMonthlyRent: tenant.assigned_monthly_rent,
    assignedSecurityDeposit: tenant.assigned_security_deposit,
    assignedAt: tenant.assigned_at,
    assignedBy: tenant.assigned_by,
    createdAt: tenant.created_at,
    updatedAt: tenant.updated_at,
  };
}

export function mapCaretakerAssignmentRow(assignment: any, caretaker?: any) {
  return {
    id: assignment.id,
    caretakerId: assignment.caretaker_id,
    caretakerName: caretaker
      ? `${caretaker.first_name || ""} ${caretaker.last_name || ""}`.trim()
      : undefined,
    caretakerEmail: caretaker?.email,
    landlordId: assignment.landlord_id,
    propertyId: assignment.property_id,
    unitId: assignment.unit_id,
    status: assignment.status,
    createdAt: assignment.created_at,
    updatedAt: assignment.updated_at,
  };
}
