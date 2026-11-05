const CLOSED_OR_SIGNED = new Set(['active', 'expired', 'cancelled', 'rejected']);

export function canEditLeaseStatus(status: string) {
  return !CLOSED_OR_SIGNED.has(status);
}

export function hasScopedUnitAccess(
  actor: { userId: string; role: string; contextOwnerId: string },
  ownerId: string,
  unitId: string,
  propertyId: string,
  assignments: Array<{ unit_id?: string | null; property_id?: string | null }>,
) {
  if (actor.userId === ownerId) return true;
  if (actor.role === 'property_manager' && actor.contextOwnerId === ownerId) return true;
  return actor.role === 'caretaker' && actor.contextOwnerId === ownerId
    && assignments.some((item) => item.unit_id
      ? item.unit_id === unitId
      : item.property_id === propertyId);
}
