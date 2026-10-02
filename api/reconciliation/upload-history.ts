import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';

/**
 * Get Statement Upload History
 * 
 * GET /api/reconciliation/upload-history
 * 
 * Returns list of all statement uploads with statistics
 */

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Only landlords can view upload history
  if (auth.role !== 'landlord') {
    return res.status(403).json({ error: 'Only landlords can view upload history' });
  }

  const sql = createDbConnection();

  try {
    const uploads = await sql`
      SELECT 
        id,
        file_name,
        statement_type,
        transactions_total,
        transactions_matched,
        transactions_unmatched,
        transactions_duplicates,
        upload_date,
        created_at
      FROM public.statement_upload_history
      WHERE landlord_id = ${auth.userId}
      ORDER BY upload_date DESC
      LIMIT 50
    `;

    return res.status(200).json({
      uploads: uploads.map(u => ({
        id: u.id,
        fileName: u.file_name,
        statementType: u.statement_type,
        total: u.transactions_total,
        matched: u.transactions_matched,
        unmatched: u.transactions_unmatched,
        duplicates: u.transactions_duplicates,
        uploadDate: u.upload_date,
        matchRate: u.transactions_total > 0 
          ? Math.round((u.transactions_matched / u.transactions_total) * 100) 
          : 0
      }))
    });

  } catch (error) {
    console.error('[Upload History] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch upload history' });
  } finally {
    await sql.end();
  }
});
