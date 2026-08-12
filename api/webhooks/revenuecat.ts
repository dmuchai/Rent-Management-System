import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { createDbConnection } from '../_lib/db.js';
import { normalizeRevenueCatWebhookPayload } from '../../shared/subscription/index.js';

const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_AUTHORIZATION_SECRET || process.env.REVENUECAT_WEBHOOK_SECRET || '';

function extractAuthorizationValue(headerValue: string | string[] | undefined): string | null {
  if (!headerValue) return null;
  const rawHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const trimmed = rawHeader.trim();

  if (!trimmed) return null;
  if (trimmed.toLowerCase().startsWith('bearer ')) {
    return trimmed.slice(7).trim();
  }

  return trimmed;
}

function isAuthorized(req: VercelRequest): boolean {
  if (!WEBHOOK_SECRET) {
    return false;
  }

  const provided = extractAuthorizationValue(req.headers.authorization);
  if (!provided) {
    return false;
  }

  const secretBuffer = Buffer.from(WEBHOOK_SECRET, 'utf8');
  const providedBuffer = Buffer.from(provided, 'utf8');

  if (secretBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(secretBuffer, providedBuffer);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (process.env.ENABLE_SUBSCRIPTIONS !== 'true') {
    return res.status(503).json({ error: 'Subscriptions are disabled' });
  }

  const sql = createDbConnection();

  try {
    const normalized = normalizeRevenueCatWebhookPayload(req.body);

    if (!normalized.eventId || !normalized.appUserId) {
      return res.status(400).json({ error: 'Invalid RevenueCat payload' });
    }

    const eventTimestamp = normalized.eventTimestamp || new Date().toISOString();

    const result = await sql.begin(async (tx) => {
      const [insertedEvent] = await tx`
        INSERT INTO public.subscription_events (
          revenuecat_event_id,
          event_type,
          app_user_id,
          event_timestamp,
          raw_payload
        ) VALUES (
          ${normalized.eventId},
          ${normalized.eventType},
          ${normalized.appUserId},
          ${eventTimestamp},
          ${JSON.stringify(req.body)}::jsonb
        )
        ON CONFLICT (revenuecat_event_id) DO NOTHING
        RETURNING id, processed_at
      `;

      const eventRow = insertedEvent ?? (await tx`
        SELECT id, processed_at
        FROM public.subscription_events
        WHERE revenuecat_event_id = ${normalized.eventId}
        LIMIT 1
      `)[0];

      if (!eventRow) {
        throw new Error('Failed to persist RevenueCat event');
      }

      if (eventRow.processed_at) {
        return { duplicate: true };
      }

      let [billingAccount] = await tx`
        SELECT *
        FROM public.billing_accounts
        WHERE revenuecat_app_user_id = ${normalized.appUserId}
        FOR UPDATE
      `;

      if (!billingAccount) {
        // The SDK uses the authenticated owner UUID as the RevenueCat App
        // User ID. Provision defensively here as well as from /api/subscription
        // so a purchase made before the subscription screen syncs is not lost.
        [billingAccount] = await tx`
          INSERT INTO public.billing_accounts (
            owner_user_id,
            revenuecat_app_user_id,
            plan_code,
            subscription_status
          )
          SELECT u.id, ${normalized.appUserId}, 'free', 'free'
          FROM public.users u
          WHERE u.id::text IN (${normalized.appUserId}, ${normalized.originalAppUserId ?? normalized.appUserId})
            AND u.role IN ('landlord', 'property_manager')
          LIMIT 1
          ON CONFLICT (owner_user_id) DO UPDATE
          SET revenuecat_app_user_id = EXCLUDED.revenuecat_app_user_id,
              updated_at = NOW()
          RETURNING *
        `;

        if (!billingAccount) {
          throw new Error('BILLING_ACCOUNT_NOT_FOUND');
        }
      }

      const incomingEventAt = Date.parse(eventTimestamp);
      const lastEventAt = billingAccount.last_event_at ? Date.parse(billingAccount.last_event_at) : Number.NaN;
      if (Number.isFinite(lastEventAt) && Number.isFinite(incomingEventAt) && incomingEventAt < lastEventAt) {
        await tx`
          UPDATE public.subscription_events
          SET billing_account_id = ${billingAccount.id}, processed_at = NOW()
          WHERE id = ${eventRow.id}
        `;
        return { duplicate: false, stale: true };
      }

      const productId = normalized.productId ?? null;
      const subscriptionStatus = normalized.subscriptionStatus;

      await tx`
        UPDATE public.billing_accounts
        SET
          plan_code = ${normalized.planCode},
          subscription_status = ${subscriptionStatus},
          product_id = ${productId},
          base_plan_id = ${normalized.basePlanId},
          store = 'google_play',
          trial_ends_at = ${normalized.trialEndsAt},
          current_period_ends_at = ${normalized.expirationAt},
          grace_period_ends_at = ${normalized.gracePeriodEndsAt},
          will_renew = ${normalized.willRenew},
          last_event_at = ${eventTimestamp},
          updated_at = NOW()
        WHERE id = ${billingAccount.id}
      `;

      await tx`
        UPDATE public.subscription_events
        SET billing_account_id = ${billingAccount.id}, processed_at = NOW()
        WHERE id = ${eventRow.id}
      `;

      return { duplicate: false };
    });

    return res.status(200).json({
      ok: true,
      duplicate: Boolean(result.duplicate),
      stale: Boolean((result as any).stale),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'BILLING_ACCOUNT_NOT_FOUND') {
      return res.status(404).json({ error: 'Billing account not found' });
    }

    console.error('[RevenueCat] Webhook failed:', message);
    return res.status(500).json({ error: 'Failed to process RevenueCat webhook' });
  } finally {
    await sql.end();
  }
}
