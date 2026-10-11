// Keep account recovery, billing, export and tenant self-service available.
export function requiresManagementSubscription(method: string | undefined, url: string | undefined, role: string): boolean {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes((method || '').toUpperCase())) return false;
  if (!['landlord', 'property_manager', 'caretaker'].includes(role)) return false;
  const path = (url || '').split('?')[0];
  // Archiving units preserves records and lets an owner recover from a downgrade.
  if (method?.toUpperCase() === 'DELETE' && /^\/api\/units\/[^/]+$/.test(path)) return false;
  return /^\/api\/(properties|units|tenants|leases|invoices|payments|caretakers|caretaker-invitations|invitations|maintenance-requests|landlord|reconciliation|payment-channels|sms)(\/|$)/.test(path);
}

export const READ_ONLY_SUBSCRIPTION_ERROR = {
  code: 'SUBSCRIPTION_REQUIRED',
  requiredPlan: 'starter',
  error: 'Choose a paid plan or archive excess units to fit your allowance. Your records remain available to view and export.',
};
