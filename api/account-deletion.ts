import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { createDbConnection } from './_lib/db.js';
import { checkRateLimit, getClientIp } from './_lib/rate-limit.js';
import {
  ACCOUNT_DELETION_PUBLIC_MESSAGE,
  ACCOUNT_DELETION_VERIFICATION_TTL_MS,
  accountDeletionRequestSchema,
  accountDeletionVerificationSchema,
  buildAccountDeletionSupportEmail,
  buildAccountDeletionVerificationEmail,
  buildAccountDeletionVerificationUrl,
  canResendAccountDeletionVerification,
  createAccountDeletionVerificationToken,
  hashAccountDeletionIdentifier,
  hashAccountDeletionToken,
  isAccountDeletionHoneypotTriggered,
} from '../shared/accountDeletion.js';

const MAX_REQUEST_BYTES = 12_000;

function setSecurityHeaders(req: VercelRequest, res: VercelResponse): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Allow', 'POST, OPTIONS');

  const origin = req.headers.origin;
  const configuredFrontendOrigin = (() => {
    try {
      return new URL(getFrontendUrl()).origin;
    } catch {
      return null;
    }
  })();
  const allowedOrigins = new Set([
    configuredFrontendOrigin,
    'https://landee.kejalink.co.ke',
    'https://property-manager-ke.vercel.app',
    'capacitor://localhost',
    'http://localhost',
    'https://localhost',
  ]);
  const isLocalDevelopmentOrigin =
    process.env.NODE_ENV !== 'production' &&
    typeof origin === 'string' &&
    (() => {
      try {
        return ['localhost', '127.0.0.1'].includes(new URL(origin).hostname);
      } catch {
        return false;
      }
    })();

  if (typeof origin === 'string' && (allowedOrigins.has(origin) || isLocalDevelopmentOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Vary', 'Origin');
  }
}

function getHashSecret(): string | null {
  const secret = process.env.ACCOUNT_DELETION_HASH_SECRET || process.env.SUPABASE_JWT_SECRET;
  if (secret) return secret;
  return process.env.NODE_ENV === 'production' ? null : 'landee-account-deletion-development-secret';
}

function getFrontendUrl(): string {
  return process.env.FRONTEND_URL || 'https://landee.kejalink.co.ke';
}

function getSupportEmail(): string {
  return process.env.ACCOUNT_DELETION_SUPPORT_EMAIL || 'support@landee.co.ke';
}

function getContentLength(req: VercelRequest): number {
  const value = req.headers['content-length'];
  const parsed = typeof value === 'string' ? Number(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function validationResponse(res: VercelResponse, error: z.ZodError): VercelResponse {
  return res.status(400).json({
    error: 'Please correct the highlighted fields.',
    fields: error.flatten().fieldErrors,
  });
}

type SqlClient = ReturnType<typeof createDbConnection>;

async function enqueueVerificationEmail(
  sql: SqlClient,
  email: string,
  requestId: string,
  token: string,
): Promise<void> {
  const verificationUrl = buildAccountDeletionVerificationUrl(getFrontendUrl(), token);
  const content = buildAccountDeletionVerificationEmail(verificationUrl);

  await sql`
    INSERT INTO public.email_queue ("to", subject, html_content, text_content, metadata)
    VALUES (
      ${email},
      ${'Confirm your Landee deletion request'},
      ${content.html},
      ${content.text},
      ${JSON.stringify({ type: 'account_deletion_verification', requestId })}
    )
  `;
}

async function handleSubmission(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  const parsed = accountDeletionRequestSchema.safeParse(req.body || {});
  if (!parsed.success) return validationResponse(res, parsed.error);

  // Silently accept bot-filled forms so the honeypot does not teach automated clients how to bypass it.
  if (isAccountDeletionHoneypotTriggered(parsed.data.company)) {
    return res.status(202).json({ message: ACCOUNT_DELETION_PUBLIC_MESSAGE });
  }

  const hashSecret = getHashSecret();
  if (!hashSecret) {
    console.error('[AccountDeletion] ACCOUNT_DELETION_HASH_SECRET or SUPABASE_JWT_SECRET is required');
    return res.status(503).json({ error: 'Deletion requests are temporarily unavailable. Please try again later.' });
  }

  const sql = createDbConnection();
  const now = new Date();
  const verificationExpiresAt = new Date(now.getTime() + ACCOUNT_DELETION_VERIFICATION_TTL_MS);
  const emailHash = hashAccountDeletionIdentifier(`email:${parsed.data.email}`, hashSecret);
  const ipHash = hashAccountDeletionIdentifier(`ip:${getClientIp(req)}`, hashSecret);
  const userAgentHeader = req.headers['user-agent'];
  const userAgent = (typeof userAgentHeader === 'string' ? userAgentHeader : '').slice(0, 500) || null;

  try {
    const [existingRequest] = await sql`
      SELECT id, status, requested_at
      FROM public.account_deletion_requests
      WHERE email_hash = ${emailHash}
        AND status IN ('pending_verification', 'pending_review', 'in_progress')
      ORDER BY requested_at DESC
      LIMIT 1
    `;

    if (existingRequest) {
      const canResend = canResendAccountDeletionVerification(
        existingRequest.status,
        new Date(existingRequest.requested_at),
        now,
      );

      if (canResend) {
        const token = createAccountDeletionVerificationToken();
        const tokenHash = hashAccountDeletionToken(token);

        await sql.begin(async (tx) => {
          const [updated] = await tx`
            UPDATE public.account_deletion_requests
            SET request_type = ${parsed.data.requestType},
                details = ${parsed.data.details || null},
                verification_token_hash = ${tokenHash},
                verification_expires_at = ${verificationExpiresAt},
                source_ip_hash = ${ipHash},
                user_agent = ${userAgent},
                requested_at = ${now},
                updated_at = ${now}
            WHERE id = ${existingRequest.id}
              AND status = 'pending_verification'
            RETURNING id
          `;

          if (updated) {
            await enqueueVerificationEmail(tx as SqlClient, parsed.data.email, updated.id, token);
          }
        });
      }

      return res.status(202).json({ message: ACCOUNT_DELETION_PUBLIC_MESSAGE });
    }

    const token = createAccountDeletionVerificationToken();
    const tokenHash = hashAccountDeletionToken(token);

    await sql.begin(async (tx) => {
      const [user] = await tx`
        SELECT id
        FROM public.users
        WHERE LOWER(email) = ${parsed.data.email}
        LIMIT 1
      `;

      const [created] = await tx`
        INSERT INTO public.account_deletion_requests (
          user_id,
          email,
          email_hash,
          request_type,
          details,
          verification_token_hash,
          verification_expires_at,
          source_ip_hash,
          user_agent,
          requested_at,
          updated_at
        ) VALUES (
          ${user?.id || null},
          ${parsed.data.email},
          ${emailHash},
          ${parsed.data.requestType},
          ${parsed.data.details || null},
          ${tokenHash},
          ${verificationExpiresAt},
          ${ipHash},
          ${userAgent},
          ${now},
          ${now}
        )
        RETURNING id
      `;

      await enqueueVerificationEmail(tx as SqlClient, parsed.data.email, created.id, token);
    });

    return res.status(202).json({ message: ACCOUNT_DELETION_PUBLIC_MESSAGE });
  } catch (error: any) {
    // A concurrent request can hit the partial unique index; retain the same generic response.
    if (error?.code === '23505') {
      return res.status(202).json({ message: ACCOUNT_DELETION_PUBLIC_MESSAGE });
    }

    console.error('[AccountDeletion] Failed to record request:', error);
    return res.status(500).json({ error: 'We could not record the request. Please try again later.' });
  } finally {
    await sql.end();
  }
}

async function handleVerification(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  const parsed = accountDeletionVerificationSchema.safeParse(req.body || {});
  if (!parsed.success) return validationResponse(res, parsed.error);

  const sql = createDbConnection();
  const tokenHash = hashAccountDeletionToken(parsed.data.token);
  const supportEmail = getSupportEmail();

  try {
    const verified = await sql.begin(async (tx) => {
      const [request] = await tx`
        UPDATE public.account_deletion_requests
        SET status = 'pending_review',
            verified_at = NOW(),
            verification_token_hash = NULL,
            verification_expires_at = NULL,
            updated_at = NOW()
        WHERE verification_token_hash = ${tokenHash}
          AND status = 'pending_verification'
          AND verification_expires_at > NOW()
        RETURNING id, user_id, email, request_type, details
      `;

      if (!request) return null;

      const supportContent = buildAccountDeletionSupportEmail({
        requestId: request.id,
        email: request.email,
        requestType: request.request_type,
        details: request.details || '',
        userId: request.user_id,
      });
      const requesterText = [
        'Your Landee deletion request is verified.',
        '',
        `Reference: ${request.id}`,
        'Our support team will review the request and contact you if identity, ownership, retention, or record-transfer details are required.',
        '',
        'Landee support: support@landee.co.ke',
      ].join('\n');
      const requesterHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h1 style="color: #0284c7;">Deletion request verified</h1>
          <p>Your request is now awaiting review.</p>
          <p><strong>Reference:</strong> ${request.id}</p>
          <p>Our support team will contact you if identity, ownership, retention, or record-transfer details are required.</p>
        </div>`;

      await tx`
        INSERT INTO public.email_queue ("to", subject, html_content, text_content, metadata)
        VALUES
          (
            ${request.email},
            ${'Your Landee deletion request is verified'},
            ${requesterHtml},
            ${requesterText},
            ${JSON.stringify({ type: 'account_deletion_verified', requestId: request.id })}
          ),
          (
            ${supportEmail},
            ${`Verified deletion request ${request.id}`},
            ${supportContent.html},
            ${supportContent.text},
            ${JSON.stringify({ type: 'account_deletion_support', requestId: request.id })}
          )
      `;

      return request;
    });

    if (!verified) {
      return res.status(400).json({ error: 'This verification link is invalid, expired, or already used.' });
    }

    return res.status(200).json({
      status: 'verified',
      message: 'Your deletion request has been verified and is awaiting review.',
    });
  } catch (error) {
    console.error('[AccountDeletion] Failed to verify request:', error);
    return res.status(500).json({ error: 'We could not verify the request. Please try again later.' });
  } finally {
    await sql.end();
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (getContentLength(req) > MAX_REQUEST_BYTES) {
    return res.status(413).json({ error: 'Request payload is too large.' });
  }

  const isVerification = req.body?.action === 'verify';
  const rateLimitResult = await checkRateLimit(
    req,
    isVerification ? 'account-deletion-verify' : 'account-deletion-request',
  );
  res.setHeader('X-RateLimit-Remaining', String(rateLimitResult.remaining));

  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', String(rateLimitResult.retryAfter || 3600));
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  return isVerification ? handleVerification(req, res) : handleSubmission(req, res);
}
