import type { Sql } from 'postgres';

export async function runLeaseLifecycle(sql: Sql, now = new Date()) {
  return sql.begin(async (tx) => {
    const [run] = await tx`INSERT INTO public.operational_job_runs (job_name, status)
      VALUES ('lease_lifecycle', 'running') RETURNING id`;
    try {
      const expired = await tx`
        UPDATE public.leases SET status = 'expired', is_active = false, updated_at = NOW()
        WHERE is_active = true AND status = 'active' AND end_date < ${now}
        RETURNING unit_id
      `;
      const unitIds = Array.from(new Set(expired.map((row: any) => row.unit_id)));
      if (unitIds.length) await tx`
        UPDATE public.units u SET is_occupied = EXISTS(
          SELECT 1 FROM public.leases l WHERE l.unit_id = u.id AND l.is_active = true
        ), updated_at = NOW() WHERE u.id = ANY(${unitIds}::varchar[])
      `;
      await tx`UPDATE public.operational_job_runs SET status = 'completed', completed_at = NOW(),
        processed_count = ${expired.length} WHERE id = ${run.id}`;
      return { expired: expired.length, unitsRecomputed: unitIds.length };
    } catch (error: any) {
      await tx`UPDATE public.operational_job_runs SET status = 'failed', completed_at = NOW(),
        error_summary = ${String(error?.message || error).slice(0, 500)} WHERE id = ${run.id}`;
      throw error;
    }
  });
}
