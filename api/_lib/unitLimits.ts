/** Serialize all active-unit changes for one portfolio, then count in the same transaction. */
export async function lockAndCountActiveUnits(tx: any, ownerId: string): Promise<number> {
  await tx`SELECT pg_advisory_xact_lock(hashtextextended(${ownerId}, 0))`;
  const [row] = await tx`SELECT COUNT(*)::int AS count FROM public.units u
    JOIN public.properties p ON p.id = u.property_id
    WHERE p.owner_id = ${ownerId} AND p.archived_at IS NULL AND u.archived_at IS NULL`;
  return Number(row?.count || 0);
}
