export type ContextMembership = { role: string; context_owner_id: string; status?: string };

const ROLE_PRIORITY = ['landlord', 'property_manager', 'caretaker', 'tenant'];
const rolePriority = (role: string) => {
  const index = ROLE_PRIORITY.indexOf(role);
  return index < 0 ? ROLE_PRIORITY.length : index;
};

export function selectTrustedAuthority(
  memberships: ContextMembership[],
  requestedRole?: string,
  requestedOwner?: string,
) {
  const ordered = [...memberships].sort((a, b) =>
    (rolePriority(a.role) - rolePriority(b.role))
    || a.context_owner_id.localeCompare(b.context_owner_id)
    || a.role.localeCompare(b.role));
  const requested = ordered.find((membership) =>
    (!requestedRole || membership.role === requestedRole)
    && (!requestedOwner || membership.context_owner_id === requestedOwner));
  return requested || (!requestedRole && !requestedOwner ? ordered[0] : null);
}
