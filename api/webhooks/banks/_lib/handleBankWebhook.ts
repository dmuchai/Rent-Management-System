import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, createVerify, randomUUID } from 'crypto';
import { createDbConnection } from '../../../_lib/db.js';
import { reconcilePayment, recordReconciliation } from '../../../_lib/reconciliationEngine.js';
import { bankWebhookAdapters, type BankProvider } from './bankAdapter.js';
import { ownerHasSubscriptionFeature } from '../../../_lib/subscription.js';

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

function getConfiguredKcbPublicKeys(): string[] {
  return [
    process.env.KCB_WEBHOOK_PUBLIC_KEY,
    process.env.KCB_WEBHOOK_PUBLIC_KEY_PREVIOUS,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizePemKey);
}

function transactionFingerprint(transactionId: string): string {
  return createHash('sha256').update(transactionId, 'utf8').digest('hex').slice(0, 12);
}

function logKcbWebhook(
  level: 'info' | 'warn' | 'error',
  event: string,
  details: Record<string, string | number | boolean | undefined> = {}
) {
  console[level]('[KCB Webhook]', JSON.stringify({ event, ...details }));
}

const MAX_KCB_REQUEST_BYTES = 1024 * 1024;

export type KcbNotificationKind = 'auto' | 'till' | 'account';

export class KcbRequestError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'KcbRequestError';
  }
}

export function verifyRsaSha256(
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

export function verifyRsaSha256WithKeys(
  payload: string,
  signatureBase64: string,
  publicKeysPem: string[]
): boolean {
  return publicKeysPem.some((publicKeyPem) =>
    verifyRsaSha256(payload, signatureBase64, publicKeyPem)
  );
}

function getKcbSignature(req: VercelRequest): string | undefined {
  const headerName = (process.env.KCB_WEBHOOK_SIGNATURE_HEADER || 'signature').toLowerCase();
  const signatureHeader =
    req.headers[headerName] ?? req.headers.signature ?? req.headers['x-signature'];
  return Array.isArray(signatureHeader)
    ? signatureHeader[0]
    : signatureHeader?.toString();
}

export async function readKcbRawBody(req: VercelRequest): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > MAX_KCB_REQUEST_BYTES) {
      throw new KcbRequestError(413, 'KCB request body is too large');
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    throw new KcbRequestError(400, 'KCB request body is required');
  }

  return Buffer.concat(chunks).toString('utf8');
}

export async function readKcbPayload(
  req: VercelRequest,
  verifySignature: boolean
): Promise<Record<string, unknown>> {
  const rawBody = await readKcbRawBody(req);
  if (verifySignature) {
    const configuredKeys = getConfiguredKcbPublicKeys();
    if (configuredKeys.length === 0 && process.env.NODE_ENV === 'production') {
      throw new KcbRequestError(500, 'KCB webhook public key is not configured');
    }

    const signature = getKcbSignature(req);
    if (!signature) {
      logKcbWebhook('warn', 'signature_missing');
      throw new KcbRequestError(403, 'Invalid signature');
    }

    if (
      configuredKeys.length > 0 &&
      !verifyRsaSha256WithKeys(rawBody, signature, configuredKeys)
    ) {
      logKcbWebhook('warn', 'signature_invalid');
      throw new KcbRequestError(403, 'Invalid signature');
    }
  }

  try {
    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Expected a JSON object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new KcbRequestError(400, 'Invalid JSON payload');
  }
}

export async function readAndVerifyKcbPayload(
  req: VercelRequest
): Promise<Record<string, unknown>> {
  return readKcbPayload(req, true);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function pickString(obj: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!obj) return undefined;

  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

export function detectKcbNotificationKind(payload: unknown): 'till' | 'account' {
  const body = asRecord(payload);
  return asRecord(body?.header) && asRecord(body?.requestPayload) ? 'till' : 'account';
}

export function buildKcbTillAck(
  payload: unknown,
  options: { statusCode: string; statusMessage: string; transactionId?: string }
): Record<string, unknown> {
  const body = asRecord(payload);
  const header = asRecord(body?.header);

  const messageID = typeof header?.messageID === 'string' ? header.messageID : 'N/A';
  const originatorConversationID =
    typeof header?.originatorConversationID === 'string'
      ? header.originatorConversationID
      : '';

  const ack: Record<string, unknown> = {
    header: {
      messageID,
      originatorConversationID,
      statusCode: options.statusCode,
      statusMessage: options.statusMessage,
    },
    responsePayload: {
      transactionInfo: {
        transactionId: options.transactionId || 'N/A',
      },
    },
  };

  return ack;
}

export function buildKcbAccountAck(
  payload: unknown,
  options: { statusCode: string; statusMessage: string; transactionId?: string }
): Record<string, unknown> {
  const body = asRecord(payload);
  const transactionID =
    options.transactionId ||
    pickString(body, ['requestId', 'transactionID', 'transactionId', 'transactionReference']) ||
    randomUUID();

  return {
    transactionID,
    statusCode: options.statusCode,
    statusMessage: options.statusMessage,
  };
}

export function buildKcbAck(
  payload: unknown,
  kind: KcbNotificationKind,
  options: { statusCode: string; statusMessage: string; transactionId?: string }
): Record<string, unknown> {
  const resolvedKind = kind === 'auto' ? detectKcbNotificationKind(payload) : kind;
  return resolvedKind === 'till'
    ? buildKcbTillAck(payload, options)
    : buildKcbAccountAck(payload, options);
}

export function resolveKcbAcknowledgementId(
  insertedEventId?: string,
  existingEventId?: string
): string {
  return insertedEventId || existingEventId || randomUUID();
}

function sendProviderResponse(
  payload: unknown,
  res: VercelResponse,
  provider: BankProvider,
  body: Record<string, unknown>,
  ack: { statusCode: string; statusMessage: string; transactionId?: string },
  kcbKind: KcbNotificationKind
) {
  if (provider !== 'kcb') {
    return res.status(200).json(body);
  }

  return res.status(200).json(buildKcbAck(payload, kcbKind, ack));
}

export async function handleBankWebhook(
  req: VercelRequest,
  res: VercelResponse,
  provider: BankProvider,
  options: {
    kcbNotificationKind?: KcbNotificationKind;
    verifyKcbSignature?: boolean;
  } = {}
) {
  const startedAt = Date.now();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const kcbKind = options.kcbNotificationKind || 'auto';
  const verifyKcbSignature = options.verifyKcbSignature !== false;
  let payload: unknown;

  if (provider === 'kcb') {
    try {
      payload = await readKcbPayload(req, verifyKcbSignature);
    } catch (error) {
      if (error instanceof KcbRequestError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(400).json({ error: 'Invalid KCB request' });
    }
  } else {
    payload = req.body;
  }

  if (!hasValidWebhookSecret(req, provider)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (provider === 'kcb' && kcbKind !== 'auto' && detectKcbNotificationKind(payload) !== kcbKind) {
    return res.status(200).json(buildKcbAck(payload, kcbKind, {
      statusCode: '1',
      statusMessage: `Invalid ${kcbKind} notification payload`,
      transactionId: randomUUID(),
    }));
  }

  const adapter = bankWebhookAdapters[provider];
  const sql = createDbConnection();

  try {
    const normalized = adapter.normalize(payload);
    const transactionRef = transactionFingerprint(normalized.transactionId);

    // Build the WHERE clause to avoid NULL parameter type inference issues
    let channel: any = undefined;

    if (normalized.destinationAccount) {
      const result = await sql`
        SELECT id, landlord_id, bank_paybill_number, bank_account_number
        FROM public.landlord_payment_channels
        WHERE is_active = true
          AND (
            bank_account_number = ${normalized.destinationAccount}
            OR account_number = ${normalized.destinationAccount}
          )
          AND channel_type IN ('mpesa_to_bank', 'bank_account')
        ORDER BY is_primary DESC, created_at DESC
        LIMIT 1
      `;
      channel = result[0];
    }

    if (!channel && normalized.destinationPaybill) {
      const result = await sql`
        SELECT id, landlord_id, bank_paybill_number, bank_account_number
        FROM public.landlord_payment_channels
        WHERE is_active = true
          AND bank_paybill_number = ${normalized.destinationPaybill}
          AND channel_type IN ('mpesa_to_bank', 'bank_account')
        ORDER BY is_primary DESC, created_at DESC
        LIMIT 1
      `;
      channel = result[0];
    }

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
        reconciliation_status,
        is_verified
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
        'unmatched',
        ${provider === 'kcb' && verifyKcbSignature && getConfiguredKcbPublicKeys().length > 0}
      )
      ON CONFLICT (provider, external_transaction_id) DO NOTHING
      RETURNING id
    `;

    if (inserted.count === 0) {
      const [existingEvent] = await sql`
        SELECT id
        FROM public.external_payment_events
        WHERE provider = ${provider}
          AND external_transaction_id = ${normalized.transactionId}
        LIMIT 1
      `;
      const acknowledgementId = resolveKcbAcknowledgementId(undefined, existingEvent?.id);

      if (provider === 'kcb') {
        logKcbWebhook('info', 'replay_acknowledged', {
          transactionRef,
          latencyMs: Date.now() - startedAt,
        });
      }

      return sendProviderResponse(payload, res, provider, {
        success: true,
        message: 'Already processed',
      }, {
        statusCode: '0',
        statusMessage: 'Already processed',
        transactionId: acknowledgementId,
      }, kcbKind);
    }

    const [paymentEvent] = inserted;
    const acknowledgementId = resolveKcbAcknowledgementId(paymentEvent.id);

    if (!channel) {
      if (provider === 'kcb') {
        logKcbWebhook('warn', 'payment_channel_unrecognized', {
          transactionRef,
          eventId: acknowledgementId,
          latencyMs: Date.now() - startedAt,
        });
      }
      return sendProviderResponse(payload, res, provider, {
        success: true,
        message: 'Payment stored (channel not recognized)',
      }, {
        statusCode: '0',
        statusMessage: 'Payment stored',
        transactionId: acknowledgementId,
      }, kcbKind);
    }

    if (!(await ownerHasSubscriptionFeature(channel.landlord_id, 'payment_reconciliation'))) {
      if (provider === 'kcb') {
        logKcbWebhook('info', 'reconciliation_not_entitled', {
          transactionRef,
          eventId: acknowledgementId,
          latencyMs: Date.now() - startedAt,
        });
      }
      return sendProviderResponse(payload, res, provider, {
        success: true,
        message: 'Payment stored',
        matched: false,
        provider,
      }, {
        statusCode: '0',
        statusMessage: 'Payment stored',
        transactionId: acknowledgementId,
      }, kcbKind);
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

    await recordReconciliation(sql, paymentEvent.id, normalized.amount, reconciliationResult);

    if (provider === 'kcb') {
      logKcbWebhook('info', 'reconciliation_completed', {
        transactionRef,
        eventId: acknowledgementId,
        matched: reconciliationResult.matched,
        method: reconciliationResult.method,
        latencyMs: Date.now() - startedAt,
      });
    }

    return sendProviderResponse(payload, res, provider, {
      success: true,
      message: reconciliationResult.matched ? 'Payment matched' : 'Payment queued for review',
      matched: reconciliationResult.matched,
      method: reconciliationResult.method,
      confidence: reconciliationResult.confidence,
      provider,
    }, {
      statusCode: '0',
      statusMessage: reconciliationResult.matched ? 'Notification received successfully' : 'Notification received',
      transactionId: acknowledgementId,
    }, kcbKind);
  } catch (error: any) {
    if (provider === 'kcb') {
      logKcbWebhook('error', 'processing_error', {
        errorType: error?.name || 'Error',
        latencyMs: Date.now() - startedAt,
      });
    } else {
      console.error(`[${provider.toUpperCase()} Webhook] Error:`, error);
    }
    return sendProviderResponse(payload, res, provider, {
      success: false,
      message: 'Payment received (processing error)',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      provider,
    }, {
      statusCode: '1',
      statusMessage: 'Processing error',
      transactionId: randomUUID(),
    }, kcbKind);
  } finally {
    await sql.end();
  }
}
