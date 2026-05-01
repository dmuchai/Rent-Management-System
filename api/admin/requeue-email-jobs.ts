import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createDbConnection } from '../_lib/db.js';

interface RequeueRequestBody {
  ids?: string[];
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseBody(body: unknown): RequeueRequestBody {
  if (!body) return {};

  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }

  if (typeof body === 'object') {
    return body as RequeueRequestBody;
  }

  return {};
}

function isAuthorized(req: VercelRequest): boolean {
  const adminSecret = process.env.ADMIN_ACTION_SECRET || process.env.CRON_SECRET;

  if (!adminSecret) {
    return false;
  }

  const authHeader = req.headers.authorization;
  const headerSecret = req.headers['x-admin-secret'];

  return (
    authHeader === `Bearer ${adminSecret}` ||
    (typeof headerSecret === 'string' && headerSecret === adminSecret)
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = parseBody(req.body);
  const ids = Array.isArray(body.ids) ? body.ids.map((id) => String(id).trim()) : [];

  if (ids.length === 0) {
    return res.status(400).json({ error: 'Provide at least one email queue id in body.ids[]' });
  }

  const uniqueIds = Array.from(new Set(ids));
  const invalidIds = uniqueIds.filter((id) => !UUID_REGEX.test(id));

  if (invalidIds.length > 0) {
    return res.status(400).json({
      error: 'Invalid id format. Expected UUID values in body.ids[]',
      invalidIds,
    });
  }

  const sql = createDbConnection();

  try {
    const requeued = await sql`
      UPDATE public.email_queue
      SET status = 'pending',
          retry_count = 0,
          last_error = NULL,
          updated_at = NOW()
      WHERE id IN ${sql(uniqueIds)}
        AND status = 'failed'
        AND retry_count >= 5
      RETURNING id
    `;

    const requeuedIds = (requeued as any[]).map((row) => String(row.id));
    const skippedIds = uniqueIds.filter((id) => !requeuedIds.includes(id));

    return res.status(200).json({
      message: 'Selected exhausted email jobs processed.',
      requested: uniqueIds.length,
      requeued: requeuedIds.length,
      requeuedIds,
      skippedIds,
      note: 'Only rows with status=failed and retry_count>=5 are reset to pending.',
    });
  } catch (error: any) {
    console.error('[Admin] Failed to requeue email jobs:', error);
    return res.status(500).json({
      error: 'Failed to requeue email jobs',
      details: error?.message || String(error),
    });
  } finally {
    await sql.end();
  }
}
