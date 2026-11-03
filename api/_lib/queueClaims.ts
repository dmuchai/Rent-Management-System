export async function claimEmailJobs(sql: any, batchSize: number, claimToken: string) {
  return sql`WITH candidates AS (
    SELECT id FROM public.email_queue
    WHERE retry_count < 5 AND available_at <= NOW()
      AND (status IN ('pending', 'failed') OR (status = 'processing' AND lease_expires_at < NOW()))
    ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT ${batchSize}
  ) UPDATE public.email_queue q SET status = 'processing', claim_token = ${claimToken},
    lease_expires_at = NOW() + INTERVAL '5 minutes', updated_at = NOW()
  FROM candidates WHERE q.id = candidates.id RETURNING q.*`;
}

export async function claimSmsJobs(sql: any, batchSize: number, claimToken: string) {
  return sql`WITH candidates AS (
    SELECT id FROM public.sms_queue
    WHERE retry_count < 5 AND available_at <= NOW()
      AND (status IN ('pending', 'failed') OR (status = 'processing' AND lease_expires_at < NOW()))
    ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT ${batchSize}
  ) UPDATE public.sms_queue q SET status = 'processing', claim_token = ${claimToken},
    lease_expires_at = NOW() + INTERVAL '5 minutes', updated_at = NOW()
  FROM candidates WHERE q.id = candidates.id RETURNING q.*`;
}
