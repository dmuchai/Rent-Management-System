import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createVerify } from 'crypto';
import { createDbConnection } from '../../../_lib/db';
import { reconcilePayment, recordReconciliation } from '../../../_lib/reconciliationEngine';
import { bankWebhookAdapters, type BankProvider } from './bankAdapter';

const PROVIDER_SECRET_ENV: Record<BankProvider, string> = {
  kcb: 'KCB_WEBHOOK_SECRET',
  equity: 'EQUITY_WEBHOOK_SECRET',
  coop: 'COOP_WEBHOOK_SECRET',
};

function getExpectedSecret(provider: BankProvider): string | undefined {
  return process.env[PROVIDER_SECRET_ENV[provider]];
}

function hasValidWebhookSecret(req: VercelRequest, provider: BankProvider): boolean {
  const expected = getExpectedSecret(provider);
  if (!expected) return true;

  const headerSecret = req.headers['x-webhook-secret']?.toString();
  if (headerSecret && headerSecret === expected) {
    return true;
  }

  const authHeader = req.headers.authorization?.toString();
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7) === expected;
  }

  return false;
}

function normalizePemKey(value: string): string {
  return value.replace(/\\n/g, '\n').trim();
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const body = keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(',');
  return `{${body}}`;
}

function verifyRsaSha256(
  payload: string,
  signatureBase64: string,
  publicKeyPem: string
): boolean {
  try {
    const verifier = createVerify('RSA-SHA256');
    verifier.update(payload, 'utf8');
    verifier.end();
    return verifier.verify(publicKeyPem, signatureBase64, 'base64');
  } catch (error) {
    return false;
  }
}

function hasValidKcbSignature(req: VercelRequest, provider: BankProvider): boolean {
  if (provider !== 'kcb') {
    return true;
  }

  const configuredKey = process.env.KCB_WEBHOOK_PUBLIC_KEY;
  if (!configuredKey) {
    // Allows sandbox/dev flow when public key verification is not configured.
    return true;
  }

  const headerName = (process.env.KCB_WEBHOOK_SIGNATURE_HEADER || 'signature').toLowerCase();
  const signatureHeader =
    req.headers[headerName] ?? req.headers.signature ?? req.headers['x-signature'];
  const signature = Array.isArray(signatureHeader)
    ? signatureHeader[0]
    : signatureHeader?.toString();

  if (!signature) {
    return false;
  }

  const publicKeyPem = normalizePemKey(configuredKey);
  const payloadCandidates: string[] = [];

  if (typeof req.body === 'string') {
    payloadCandidates.push(req.body);
  } else if (Buffer.isBuffer(req.body)) {
    payloadCandidates.push(req.body.toString('utf8'));
  } else {
    payloadCandidates.push(JSON.stringify(req.body));
    payloadCandidates.push(stableStringify(req.body));
  }

  // Try a small set of canonical payload encodings to improve interop with
  // providers that sign minified or key-sorted JSON.
  return payloadCandidates.some((candidate) =>
    verifyRsaSha256(candidate, signature, publicKeyPem)
  );
}

export async function handleBankWebhook(
  req: VercelRequest,
  res: VercelResponse,
  provider: BankProvider
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!hasValidKcbSignature(req, provider)) {
    return res.status(403).json({ error: 'Invalid signature' });
  }

  if (!hasValidWebhookSecret(req, provider)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const adapter = bankWebhookAdapters[provider];
  const sql = createDbConnection();

  try {
    const normalized = adapter.normalize(req.body);

    const [channel] = await sql`
      SELECT id, landlord_id, bank_paybill_number, bank_account_number
      FROM public.landlord_payment_channels
      WHERE is_active = true
        AND (
          (${normalized.destinationAccount || null} IS NOT NULL AND (
            bank_account_number = ${normalized.destinationAccount || null}
            OR account_number = ${normalized.destinationAccount || null}
          ))
          OR (${normalized.destinationPaybill || null} IS NOT NULL AND bank_paybill_number = ${normalized.destinationPaybill || null})
        )
        AND channel_type IN ('mpesa_to_bank', 'bank_account')
      ORDER BY is_primary DESC, created_at DESC
      LIMIT 1
    `;

    const inserted = await sql`
      INSERT INTO public.external_payment_events (
        event_type,
        provider,
        landlord_id,
        payment_channel_id,
        external_transaction_id,
        amount,
        currency,
        payer_phone,
        payer_name,
        payer_account_ref,
        transaction_time,
        raw_payload,
        reconciliation_status
      ) VALUES (
        'bank_webhook',
        ${provider},
        ${channel?.landlord_id || null},
        ${channel?.id || null},
        ${normalized.transactionId},
        ${normalized.amount},
        ${normalized.currency},
        ${normalized.payerPhone || null},
        ${normalized.payerName || null},
        ${normalized.payerAccountRef || normalized.referenceCode || null},
        ${normalized.transactionTime.toISOString()},
        ${JSON.stringify(normalized.rawPayload)},
        'unmatched'
      )
      ON CONFLICT (provider, external_transaction_id) DO NOTHING
      RETURNING id
    `;

    if (inserted.count === 0) {
      return res.status(200).json({
        success: true,
        message: 'Already processed',
      });
    }

    const [paymentEvent] = inserted;

    if (!channel) {
      return res.status(200).json({
        success: true,
        message: 'Payment stored (channel not recognized)',
      });
    }

    const reconciliationResult = await reconcilePayment(sql, {
      id: paymentEvent.id,
      transactionId: normalized.transactionId,
      phoneNumber: normalized.payerPhone || '',
      amount: normalized.amount,
      timestamp: normalized.transactionTime,
      bankPaybillNumber: normalized.destinationPaybill || channel.bank_paybill_number || undefined,
      bankAccountNumber: normalized.destinationAccount || channel.bank_account_number || undefined,
      referenceCode: normalized.referenceCode,
      rawData: normalized.rawPayload,
    });

    await recordReconciliation(sql, paymentEvent.id, reconciliationResult);

    return res.status(200).json({
      success: true,
      message: reconciliationResult.matched ? 'Payment matched' : 'Payment queued for review',
      matched: reconciliationResult.matched,
      method: reconciliationResult.method,
      confidence: reconciliationResult.confidence,
      provider,
    });
  } catch (error: any) {
    console.error(`[${provider.toUpperCase()} Webhook] Error:`, error);
    return res.status(200).json({
      success: false,
      message: 'Payment received (processing error)',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      provider,
    });
  } finally {
    await sql.end();
  }
}
