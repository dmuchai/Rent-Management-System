import { config } from 'dotenv';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { createPublicKey } from 'node:crypto';
import { allocateBankEvent } from '../api/_lib/bankAllocation.js';

// Usage: tsx scripts/reconcile-bank-event.ts --env <protected-file> [--apply]
// This recovery is deliberately limited to the event authorized in this incident.
const envIndex = process.argv.indexOf('--env');
if (envIndex < 0 || !process.argv[envIndex + 1]) throw new Error('Protected environment file is required');
config({ path: process.argv[envIndex + 1], override: true, quiet: true });
const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, ssl: 'require' });
const eventId = 'fd06fdfa-b6ea-4637-8d28-bc249a4506b9';
const apply = process.argv.includes('--apply');
try {
  const signatureMode = process.env.KCB_ACCOUNT_SIGNATURE_MODE?.trim().toLowerCase();
  let publicKeyConfigured = false;
  try {
    publicKeyConfigured = createPublicKey((process.env.KCB_WEBHOOK_PUBLIC_KEY || '').replace(/\\n/g, '\n').trim()).asymmetricKeyType === 'rsa';
  } catch { /* Report only configuration status. */ }
  const [event] = await sql`
    SELECT amount, provider, currency FROM public.external_payment_events WHERE id = ${eventId}
  `;
  if (!event || Number(event.amount) !== 100 || event.provider !== 'kcb' || event.currency !== 'KES') {
    throw new Error('Recovery event does not match the authorized KES 100 callback');
  }
  if (apply) {
    if (!publicKeyConfigured || signatureMode !== 'enforce') {
      throw new Error('Production signature configuration must be enforced before recovery');
    }
    await sql.unsafe(readFileSync(new URL('../migrations/014_bank_payment_allocations.sql', import.meta.url), 'utf8'));
  }
  const result = await allocateBankEvent(sql, eventId, {
    dryRun: !apply,
    auditEvidence: 'Production signature_audit signaturePresent=true signatureValid=true at 2026-10-02 10:09:24 UTC; owner authorized oldest-invoice allocation',
  });
  if (apply && result.matched) {
    const [persisted] = await sql`
      SELECT e.reconciliation_status, i.status AS invoice_status,
             (SELECT count(*)::int FROM public.payments p
              WHERE p.bank_event_id = e.id AND p.status = 'completed') AS receipt_count,
             (SELECT COALESCE(sum(amount), 0)::float8 FROM public.payments p
              WHERE p.bank_event_id = e.id AND p.status = 'completed') AS receipt_total
      FROM public.external_payment_events e
      JOIN public.invoices i ON i.id = e.matched_invoice_id WHERE e.id = ${eventId}
    `;
    if (!persisted || persisted.receipt_count !== 1 || persisted.receipt_total !== 100) {
      throw new Error('Recovery validation failed');
    }
    console.log(JSON.stringify({ eventStatus: persisted.reconciliation_status,
      invoiceStatus: persisted.invoice_status, receiptCount: persisted.receipt_count,
      receiptTotal: persisted.receipt_total }));
  }
  console.log(JSON.stringify({ applied: apply, ...result,
    subscriptionsEnabled: process.env.ENABLE_SUBSCRIPTIONS === 'true',
    signatureEnforcementEnabled: signatureMode === 'enforce',
    signatureMode: ['audit', 'enforce'].includes(signatureMode || '') ? signatureMode : signatureMode ? 'unrecognized' : 'missing',
    publicKeyConfigured }));
} catch {
  console.error('Bank event recovery failed; inspect the database state before retrying. No sensitive details logged.');
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
