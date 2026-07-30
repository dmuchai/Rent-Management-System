type TenantProfileWithLandlord = {
  landlordId?: string | null;
} | null | undefined;

type LeaseWithOwner = {
  ownerId?: string | null;
} | null | undefined;

/**
 * Resolve the landlord that owns a tenant's payment channels.
 *
 * The tenant profile is authoritative, while the lease owner is a safe
 * fallback when an older mobile session cannot load /api/tenants/me.
 */
export function resolvePaymentLandlordId(
  tenantProfile: TenantProfileWithLandlord,
  activeLease: LeaseWithOwner
): string | undefined {
  return tenantProfile?.landlordId || activeLease?.ownerId || undefined;
}
