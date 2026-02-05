import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createDbConnection } from '../../_lib/db.js';

/**
 * GET /api/landlord/[landlordId]/payment-channels
 * Public endpoint for tenants to view their landlord's active payment channels
 * No auth required - tenants need to see payment instructions
 */
export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sql = createDbConnection();

  try {
    // Extract landlordId from the URL path
    // URL format: /api/landlord/[landlordId]/payment-channels
    const landlordId = req.url?.split('/')[3];
    
    if (!landlordId) {
      return res.status(400).json({ error: 'Landlord ID is required' });
    }

    // Fetch only ACTIVE payment channels for this landlord
    // Only return fields needed for payment instructions (no sensitive internal data)
    const channels = await sql`
      SELECT 
        id,
        channel_type,
        paybill_number,
        till_number,
        bank_paybill_number,
        bank_account_number,
        bank_name,
        account_number,
        account_name,
        is_primary,
        display_name
      FROM public.landlord_payment_channels
      WHERE landlord_id = ${landlordId}
        AND is_active = true
      ORDER BY is_primary DESC, created_at DESC
    `;

    if (channels.length === 0) {
      return res.status(200).json([]);
    }

    // Format response with camelCase keys
    const formattedChannels = channels.map((ch: any) => ({
      id: ch.id,
      channelType: ch.channel_type,
      paybillNumber: ch.paybill_number,
      tillNumber: ch.till_number,
      bankPaybillNumber: ch.bank_paybill_number,
      bankAccountNumber: ch.bank_account_number,
      bankName: ch.bank_name,
      accountNumber: ch.account_number,
      accountName: ch.account_name,
      isPrimary: ch.is_primary,
      displayName: ch.display_name,
    }));

    return res.status(200).json(formattedChannels);

  } catch (error) {
    console.error('Error fetching payment channels:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch payment channels',
      details: error instanceof Error ? error.message : String(error)
    });
  } finally {
    await sql.end();
  }
};
