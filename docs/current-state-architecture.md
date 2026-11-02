# Landee current-state architecture

Updated 1 November 2026. This document describes implemented state, not a promise of live provider activation.

## Runtime and trust boundaries

- The browser and Android application use the same account. Google Play / RevenueCat purchases currently originate in the installed Android app and sync to web.
- Production HTTP behavior is implemented by Vercel Functions under `api/`. The Express server remains a development/compatibility surface and is not evidence of production behavior.
- Supabase Auth establishes identity. `public.user_context_memberships` establishes scoped authority. Auth profile metadata is not an authority source.
- PostgreSQL is the system of record for properties, leases, invoices, payment attempts, immutable external events, receipts, audit history, and notification outboxes.
- Provider callbacks are untrusted input. Bank callbacks use their configured verification control. M-PESA Express callbacks require an authenticated Daraja status query before completion.

## Financial flow

```text
provider / import / operator
          |
          v
external_payment_events -- durable receipt, unique(provider, transaction id)
          |
          v
processing state -- received -> processing -> processed | review | retry | failed
          |
          v
shared posting boundary -- locks event + invoice, writes receipt + audit + balance + outbox
          |
          +--> payments (receipt/allocation evidence)
          +--> invoices.amount_paid/status
          +--> payment_audit_history
          +--> email_queue / sms_queue
```

Bank allocation may split one verified event across the oldest outstanding invoices. C2B, statement, and manual-review paths use the same event-linked receipt boundary. Excess is retained as `external_payment_events.unallocated_amount` and flagged for operator review; it is not silently treated as rent. Corrections and reversals cancel receipts and append audit history rather than deleting evidence.

Collection confirmation is not settlement confirmation. A verified provider result establishes the provider-reported collection state only. Landee does not currently confirm final bank settlement for M-PESA Express.

## Safaricom boundary

Safaricom's current M-PESA Express documentation describes an asynchronous callback and OAuth-authenticated merchant APIs. It does not document a callback HMAC. Landee therefore does not invent one: it queries `/mpesa/stkpushquery/v1/query` using the configured merchant credentials, then compares checkout/merchant IDs and requires matching amount and receipt evidence before posting.

The current configuration is still one global test/merchant connection. The proposed model is future per-landlord Safaricom connections with merchant ownership verification, onboarding state, encrypted credentials or delegated connection IDs, rotation/revocation, channel activation, and separate sandbox/production configuration. Commercial decisions remain open for onboarding authority, charges, settlement destination, support responsibility, and whether Safaricom approves the intended multi-merchant operating model. This repository does not implement a pooled account, custody, automatic settlement transfer, or a new bank integration.

Official reference: https://developer.safaricom.co.ke/apis/MpesaExpressSimulate

## Scheduled operations

- Every minute: email and SMS outbox workers claim rows atomically with five-minute leases.
- Every five minutes: payment-event worker recovers abandoned claims, performs bounded retries, and exposes exhausted events for review.
- Hourly: lease lifecycle expires ended active leases and recomputes occupancy; GET/list handlers are read-only.
- Monthly: canonical rent invoice generation.

All cron routes accept `GET` only and fail closed when `CRON_SECRET` is missing.

## Release and data controls

`.github/workflows/release-checks.yml` uses `npm ci`, Node 22, and a disposable PostgreSQL 16 service. It runs type checking, route checks, focused suites, database allocation tests, and the Vercel production build without live provider credentials.

The reviewed commit `3a4c0d1e...` is not present in this checkout's available object graph. Subsequent repository history visible here already added canonical rent invoices, verified KCB allocation/reversal controls, account deletion, RevenueCat/Android subscription sync, and paid-first Starter limits. The remediation reuses those changes rather than restoring the reviewed implementation.
