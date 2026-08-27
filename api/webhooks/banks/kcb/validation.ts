import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { createDbConnection } from '../../../_lib/db.js';
import {
  KcbRequestError,
  readKcbPayload,
} from '../_lib/handleBankWebhook.js';
import { buildKcbValidationResponse } from '../_lib/kcbValidation.js';

const validationRequestSchema = z.object({
  requestId: z.string().trim().min(1).max(120),
  customerReference: z.string().trim().min(1).max(120),
  organizationReference: z.string().trim().min(1).max(120),
});

function failureResponse(transactionId: string, statusMessage: string) {
  return buildKcbValidationResponse({
    transactionId,
    statusCode: '1',
    statusMessage,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const transactionId = randomUUID();
  let payload: Record<string, unknown>;

  try {
    // Temporary KCB UAT exception. Re-enable after KCB completes the validation review.
    payload = await readKcbPayload(req, false);
  } catch (error) {
    if (error instanceof KcbRequestError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(400).json({ error: 'Invalid KCB validation request' });
  }

  const parsed = validationRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return res.status(200).json(failureResponse(transactionId, 'Invalid validation request'));
  }

  const expectedOrganizationReference = process.env.KCB_ORGANIZATION_REFERENCE?.trim();
  if (!expectedOrganizationReference) {
    return res.status(200).json(
      failureResponse(transactionId, 'KCB organization reference is not configured')
    );
  }

  if (parsed.data.organizationReference !== expectedOrganizationReference) {
    return res.status(200).json(failureResponse(transactionId, 'Unknown organization reference'));
  }

  const sql = createDbConnection();

  try {
    const [invoice] = await sql`
      SELECT
        GREATEST(i.amount - COALESCE(i.amount_paid, 0), 0) AS bill_amount,
        COALESCE(i.currency, 'KES') AS currency,
        t.first_name,
        t.last_name,
        channel.bank_account_number
      FROM public.invoices i
      JOIN public.tenants t ON t.id = i.tenant_id
      JOIN LATERAL (
        SELECT c.bank_account_number
        FROM public.landlord_payment_channels c
        WHERE c.landlord_id = i.landlord_id
          AND c.is_active = true
          AND c.channel_type = 'mpesa_to_bank'
          AND c.bank_account_number IS NOT NULL
        ORDER BY c.is_primary DESC, c.created_at DESC
        LIMIT 1
      ) channel ON true
      WHERE i.reference_code = ${parsed.data.customerReference}
        AND i.status IN ('pending', 'partially_paid')
      LIMIT 1
    `;

    if (!invoice) {
      return res.status(200).json(failureResponse(transactionId, 'Bill not found'));
    }

    return res.status(200).json(buildKcbValidationResponse({
      transactionId,
      statusCode: '0',
      statusMessage: 'Success',
      customerName: `${invoice.first_name} ${invoice.last_name}`.trim(),
      billAmount: Number(invoice.bill_amount).toFixed(2),
      currency: invoice.currency,
      billType: 'FIXED',
      creditAccountIdentifier: invoice.bank_account_number,
    }));
  } catch (error) {
    console.error('[KCB Validation] Error:', error);
    return res.status(200).json(failureResponse(transactionId, 'Validation processing error'));
  } finally {
    await sql.end();
  }
}
