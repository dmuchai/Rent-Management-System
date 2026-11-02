export type ContextMembership = { role: string; context_owner_id: string };

export function selectTrustedAuthority(
  memberships: ContextMembership[],
  requestedRole?: string,
  requestedOwner?: string,
) {
  const requested = memberships.find((membership) =>
    (!requestedRole || membership.role === requestedRole)
    && (!requestedOwner || membership.context_owner_id === requestedOwner));
  return requested || (!requestedRole && !requestedOwner ? memberships[0] : null);
}
