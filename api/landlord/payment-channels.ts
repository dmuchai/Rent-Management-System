import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';
import { z } from 'zod';

// GET /api/landlord/payment-channels - List landlord's payment channels
// POST /api/landlord/payment-channels - Create new payment channel
// PUT /api/landlord/payment-channels?id=xxx - Update payment channel
// DELETE /api/landlord/payment-channels?id=xxx - Delete payment channel

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  // Only landlords can manage payment channels
  if (auth.role !== 'landlord') {
    return res.status(403).json({ error: 'Only landlords can manage payment channels' });
  }

  const sql = createDbConnection();

  try {
    if (req.method === 'GET') {
      // List all payment channels for this landlord
      const channels = await sql`
        SELECT 
          id,
          channel_type,
          paybill_number,
          till_number,
          bank_name,
          account_number,
          account_name,
          is_primary,
          is_active,
          display_name,
          notes,
          created_at,
          updated_at
        FROM public.landlord_payment_channels
        WHERE landlord_id = ${auth.userId}
        ORDER BY is_primary DESC, created_at DESC
      `;

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
        isActive: ch.is_active,
        displayName: ch.display_name,
        notes: ch.notes,
        createdAt: ch.created_at,
        updatedAt: ch.updated_at,
      }));

      return res.status(200).json(formattedChannels);
    }

    if (req.method === 'POST') {
      const channelSchema = z.object({
        channelType: z.enum(['mpesa_paybill', 'mpesa_till', 'mpesa_to_bank', 'bank_account']),
        paybillNumber: z.string().regex(/^\d{6,7}$/, 'Paybill must be 6-7 digits').optional(),
        tillNumber: z.string().regex(/^\d{6,7}$/, 'Till number must be 6-7 digits').optional(),
        bankPaybillNumber: z.string().regex(/^\d{6,7}$/, 'Bank paybill must be 6-7 digits').optional(),
        bankAccountNumber: z.string().min(8).max(16).optional(),
        bankName: z.string().min(1).optional(),
        accountNumber: z.string().min(1).optional(),
        accountName: z.string().min(1).optional(),
        displayName: z.string().min(1, 'Display name is required'),
        isPrimary: z.boolean().default(false),
        notes: z.string().optional(),
      }).refine((data) => {
        // Validate that required fields for each channel type are present
        if (data.channelType === 'mpesa_paybill' && !data.paybillNumber) {
          return false;
        }
        if (data.channelType === 'mpesa_till' && !data.tillNumber) {
          return false;
        }
        if (data.channelType === 'mpesa_to_bank' && (!data.bankPaybillNumber || !data.bankAccountNumber)) {
          return false;
        }
        if (data.channelType === 'bank_account' && (!data.bankName || !data.accountNumber)) {
          return false;
        }
        return true;
      }, {
        message: 'Missing required fields for channel type',
      });

      const channelData = channelSchema.parse(req.body);

      // Check for duplicate paybill/till number
      if (channelData.paybillNumber) {
        const [existing] = await sql`
          SELECT id FROM public.landlord_payment_channels
          WHERE paybill_number = ${channelData.paybillNumber}
            AND landlord_id = ${auth.userId}
        `;
        if (existing) {
          return res.status(400).json({ 
            error: 'This Paybill number is already registered',
            details: 'You cannot register the same Paybill twice'
          });
        }
      }

      if (channelData.tillNumber) {
        const [existingTill] = await sql`
          SELECT id FROM public.landlord_payment_channels
          WHERE till_number = ${channelData.tillNumber}
            AND landlord_id = ${auth.userId}
        `;
        if (existingTill) {
          return res.status(400).json({ 
            error: 'This Till number is already registered',
            details: 'You cannot register the same Till number twice'
          });
        }
      }

      if (channelData.bankAccountNumber) {
        const [existingBank] = await sql`
          SELECT id FROM public.landlord_payment_channels
          WHERE bank_account_number = ${channelData.bankAccountNumber}
            AND landlord_id = ${auth.userId}
        `;
        if (existingBank) {
          return res.status(400).json({ 
            error: 'This bank account is already registered',
            details: 'You cannot register the same bank account twice'
          });
        }
      }

      // If setting as primary, unset other primary channels
      if (channelData.isPrimary) {
        await sql`
          UPDATE public.landlord_payment_channels
          SET is_primary = false, updated_at = NOW()
          WHERE landlord_id = ${auth.userId}
        `;
      }

      // Create new channel
      const [channel] = await sql`
        INSERT INTO public.landlord_payment_channels (
          landlord_id,
          channel_type,
          paybill_number,
          till_number,
          bank_paybill_number,
          bank_account_number,
          bank_name,
          account_number,
          account_name,
          display_name,
          is_primary,
          notes
        ) VALUES (
          ${auth.userId},
          ${channelData.channelType},
          ${channelData.paybillNumber || null},
          ${channelData.tillNumber || null},
          ${channelData.bankPaybillNumber || null},
          ${channelData.bankAccountNumber || null},
          ${channelData.bankName || null},
          ${channelData.accountNumber || null},
          ${channelData.accountName || null},
          ${channelData.displayName},
          ${channelData.isPrimary},
          ${channelData.notes || null}
        )
        RETURNING *
      `;

      return res.status(201).json({
        id: channel.id,
        channelType: channel.channel_type,
        paybillNumber: channel.paybill_number,
        tillNumber: channel.till_number,
        bankPaybillNumber: channel.bank_paybill_number,
        bankAccountNumber: channel.bank_account_number,
        bankName: channel.bank_name,
        accountNumber: channel.account_number,
        accountName: channel.account_name,
        isPrimary: channel.is_primary,
        isActive: channel.is_active,
        displayName: channel.display_name,
        notes: channel.notes,
        createdAt: channel.created_at,
      });
    }

    if (req.method === 'PUT') {
      const channelId = req.query.id as string;

      if (!channelId) {
        return res.status(400).json({ error: 'Channel ID is required' });
      }

      const updateSchema = z.object({
        displayName: z.string().min(1).optional(),
        isPrimary: z.boolean().optional(),
        isActive: z.boolean().optional(),
        notes: z.string().optional(),
      });

      const updateData = updateSchema.parse(req.body);

      // Verify ownership
      const [channel] = await sql`
        SELECT id FROM public.landlord_payment_channels
        WHERE id = ${channelId} AND landlord_id = ${auth.userId}
      `;

      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }

      // If setting as primary, unset other primary channels
      if (updateData.isPrimary) {
        await sql`
          UPDATE public.landlord_payment_channels
          SET is_primary = false, updated_at = NOW()
          WHERE landlord_id = ${auth.userId} AND id != ${channelId}
        `;
      }

      // Update channel
      const [updated] = await sql`
        UPDATE public.landlord_payment_channels
        SET 
          display_name = COALESCE(${updateData.displayName || null}, display_name),
          is_primary = COALESCE(${updateData.isPrimary ?? null}, is_primary),
          is_active = COALESCE(${updateData.isActive ?? null}, is_active),
          notes = COALESCE(${updateData.notes || null}, notes),
          updated_at = NOW()
        WHERE id = ${channelId} AND landlord_id = ${auth.userId}
        RETURNING *
      `;

      return res.status(200).json({
        id: updated.id,
        channelType: updated.channel_type,
        paybillNumber: updated.paybill_number,
        tillNumber: updated.till_number,
        bankName: updated.bank_name,
        accountNumber: updated.account_number,
        accountName: updated.account_name,
        isPrimary: updated.is_primary,
        isActive: updated.is_active,
        displayName: updated.display_name,
        notes: updated.notes,
        updatedAt: updated.updated_at,
      });
    }

    if (req.method === 'DELETE') {
      const channelId = req.query.id as string;

      if (!channelId) {
        return res.status(400).json({ error: 'Channel ID is required' });
      }

      // Verify ownership
      const [channel] = await sql`
        SELECT id, is_primary FROM public.landlord_payment_channels
        WHERE id = ${channelId} AND landlord_id = ${auth.userId}
      `;

      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }

      // Prevent deleting if it has associated payment events
      const [hasEvents] = await sql`
        SELECT id FROM public.external_payment_events
        WHERE payment_channel_id = ${channelId}
        LIMIT 1
      `;

      if (hasEvents) {
        return res.status(400).json({ 
          error: 'Cannot delete channel with payment history',
          details: 'This channel has received payments and cannot be deleted. You can deactivate it instead.'
        });
      }

      // Delete channel
      await sql`
        DELETE FROM public.landlord_payment_channels
        WHERE id = ${channelId} AND landlord_id = ${auth.userId}
      `;

      return res.status(200).json({ 
        message: 'Payment channel deleted successfully',
        id: channelId 
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error: any) {
    console.error('Payment channels API error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: error.errors 
      });
    }

    return res.status(500).json({ 
      error: 'Failed to process request',
      details: error.message 
    });
  } finally {
    await sql.end();
  }
});
