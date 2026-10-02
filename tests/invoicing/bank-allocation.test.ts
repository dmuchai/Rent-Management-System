import assert from 'node:assert/strict';
import test, { before, after, beforeEach } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import { generateKeyPairSync, sign } from 'node:crypto';
import { Readable } from 'node:stream';
import { allocateBankEvent, oldestInvoiceAllocations, normalizedPayerPhone, reverseBankAllocations } from '../../api/_lib/bankAllocation.js';
import { handleBankWebhook } from '../../api/webhooks/banks/_lib/handleBankWebhook.js';

const invoice = (id: string, period: string, amount = 1000, paid = 0) => ({
  id, lease_id: 'lease-a', amount, amount_paid: paid,
  billing_period_start: period, due_date: period, created_at: period,
});

test('allocates partial payments by oldest billing month, independent of input order', () => {
  const result = oldestInvoiceAllocations(100, [invoice('new', '2026-10-01'), invoice('old', '2026-03-01')]);
  assert.equal(result?.[0].invoice.id, 'old');
  assert.equal(result?.[0].cents, 10000);
});

test('spreads money across outstanding balances without overpaying', () => {
  const result = oldestInvoiceAllocations(250, [invoice('old', '2026-03-01', 1000, 900), invoice('new', '2026-04-01')]);
  assert.deepEqual(result?.map(({ invoice, cents }) => [invoice.id, cents]), [['old', 10000], ['new', 15000]]);
  assert.equal(oldestInvoiceAllocations(1200, [invoice('old', '2026-03-01')]), null);
  assert.equal(oldestInvoiceAllocations(0, []), null);
  assert.equal(oldestInvoiceAllocations(Number.NaN, []), null);
});

test('normalizes Kenyan mobile formats and rejects missing/incomplete identity', () => {
  assert.equal(normalizedPayerPhone('+254711000001'), '711000001');
  assert.equal(normalizedPayerPhone('0711 000 001'), '711000001');
  assert.equal(normalizedPayerPhone('001'), null);
  assert.equal(normalizedPayerPhone(null), null);
});

// A private disposable PostgreSQL cluster; never connects to application data.
const directory = mkdtempSync(join(tmpdir(), 'landee-allocation-test-'));
const bin = '/usr/lib/postgresql/16/bin';
let sql: ReturnType<typeof postgres>;
let started = false;
before(async () => {
  execFileSync(join(bin, 'initdb'), ['-D', join(directory, 'db'), '-A', 'trust', '--no-locale'], { stdio: 'ignore' });
  execFileSync(join(bin, 'pg_ctl'), ['-D', join(directory, 'db'), '-l', join(directory, 'server.log'),
    '-o', `-k ${directory} -h '' -p 55439`, '-w', 'start'], { stdio: 'ignore' });
  started = true;
  sql = postgres({ host: directory, port: 55439, database: 'postgres', max: 5, onnotice: () => {} });
  await sql.unsafe(`
    CREATE TYPE invoice_status AS ENUM ('pending','partially_paid','paid','overdue','cancelled','disputed');
    CREATE TYPE payment_status AS ENUM ('pending','completed','failed','cancelled');
    CREATE TABLE properties (id varchar PRIMARY KEY, owner_id varchar);
    CREATE TABLE units (id varchar PRIMARY KEY, property_id varchar);
    CREATE TABLE tenants (id varchar PRIMARY KEY, phone varchar);
    CREATE TABLE leases (id varchar PRIMARY KEY, tenant_id varchar, unit_id varchar);
    CREATE TABLE landlord_payment_channels (id varchar PRIMARY KEY, landlord_id varchar,
      bank_account_number varchar, account_number varchar, bank_paybill_number varchar,
      is_active boolean DEFAULT true, channel_type varchar DEFAULT 'mpesa_to_bank',
      is_primary boolean DEFAULT true, created_at timestamp DEFAULT now());
    CREATE TABLE invoices (id varchar PRIMARY KEY, landlord_id varchar, tenant_id varchar,
      lease_id varchar, amount numeric(10,2), amount_paid numeric(10,2) DEFAULT 0,
      billing_period_start timestamp, due_date timestamp, created_at timestamp DEFAULT now(),
      updated_at timestamp, paid_at timestamp, reference_code varchar, invoice_type varchar DEFAULT 'rent',
      currency varchar DEFAULT 'KES', status invoice_status DEFAULT 'pending');
    CREATE TABLE external_payment_events (id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      event_type varchar DEFAULT 'bank_webhook', payment_channel_id varchar, external_transaction_id varchar,
      payer_name varchar, raw_payload jsonb, landlord_id varchar, amount numeric(10,2),
      currency varchar DEFAULT 'KES', payer_phone varchar, payer_account_ref varchar, transaction_time timestamp DEFAULT now(),
      reconciliation_status varchar DEFAULT 'unmatched', is_verified boolean DEFAULT true, provider varchar DEFAULT 'kcb',
      matched_invoice_id varchar REFERENCES invoices(id), reconciliation_method varchar, confidence_score numeric,
      reconciled_at timestamp, reconciliation_notes text,
      UNIQUE (provider, external_transaction_id));
    CREATE TABLE payments (id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      lease_id varchar, invoice_id varchar REFERENCES invoices(id), amount numeric(10,2),
      due_date timestamp, paid_date timestamp, payment_method varchar, payment_type varchar,
      payment_source varchar, status payment_status, description text, updated_at timestamp);
  `);
  const migrationConnection = await sql.reserve();
  try {
    await migrationConnection.unsafe(readFileSync(new URL('../../migrations/014_bank_payment_allocations.sql', import.meta.url), 'utf8'));
  } finally {
    migrationConnection.release();
  }
});

after(async () => {
  if (sql) await sql.end();
  if (started) execFileSync(join(bin, 'pg_ctl'), ['-D', join(directory, 'db'), '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' });
  rmSync(directory, { recursive: true, force: true });
});

beforeEach(async () => {
  await sql.unsafe(`TRUNCATE payments, external_payment_events, invoices, leases, tenants, units, properties, landlord_payment_channels;
    INSERT INTO properties VALUES ('property-a','owner-a'), ('property-b','owner-b');
    INSERT INTO units VALUES ('unit-a','property-a'), ('unit-b','property-b');
    INSERT INTO tenants VALUES ('tenant-a','0711000001'), ('tenant-b','0711000002');
    INSERT INTO leases VALUES ('lease-a','tenant-a','unit-a'), ('lease-b','tenant-b','unit-b');
    INSERT INTO landlord_payment_channels (id,landlord_id,bank_account_number,bank_paybill_number)
      VALUES ('channel-a','owner-a','1234567890','522522');
    INSERT INTO invoices (id,landlord_id,tenant_id,lease_id,amount,billing_period_start,due_date,reference_code)
      VALUES ('old','owner-a','tenant-a','lease-a',1000,'2026-03-01','2026-03-01','REF-OLD'),
             ('new','owner-a','tenant-a','lease-a',1000,'2026-04-01','2026-04-01','REF-NEW'),
             ('other','owner-b','tenant-b','lease-b',1000,'2026-01-01','2026-01-01','REF-OTHER');
    INSERT INTO external_payment_events (id,landlord_id,amount,payer_phone)
      VALUES ('event-a','owner-a',100,'+254711000001');
  `);
});

test('transaction creates exactly one partial payment receipt on the oldest invoice', async () => {
  const result = await allocateBankEvent(sql, 'event-a');
  assert.equal(result.matched, true);
  assert.deepEqual(result.billingMonths, ['2026-03']);
  const [row] = await sql`SELECT amount_paid, status FROM invoices WHERE id = 'old'`;
  assert.equal(Number(row.amount_paid), 100);
  assert.equal(row.status, 'partially_paid');
  const [receipt] = await sql`SELECT invoice_id, bank_event_id, status, amount FROM payments`;
  assert.equal(receipt.invoice_id, 'old');
  assert.equal(receipt.bank_event_id, 'event-a');
  assert.equal(receipt.status, 'completed');
  assert.equal(Number(receipt.amount), 100);
});

test('dry run predicts allocations without changing any records', async () => {
  const result = await allocateBankEvent(sql, 'event-a', { dryRun: true });
  assert.equal(result.matched, true);
  const [counts] = await sql`SELECT (SELECT count(*) FROM payments)::int AS receipts,
    (SELECT amount_paid FROM invoices WHERE id = 'old') AS paid,
    (SELECT reconciliation_status FROM external_payment_events WHERE id = 'event-a') AS status`;
  assert.equal(counts.receipts, 0);
  assert.equal(Number(counts.paid), 0);
  assert.equal(counts.status, 'unmatched');
});

test('duplicate concurrent processing credits the event once', async () => {
  const results = await Promise.all([allocateBankEvent(sql, 'event-a'), allocateBankEvent(sql, 'event-a')]);
  assert.equal(results.filter((r) => r.duplicate).length, 1);
  const [row] = await sql`SELECT count(*)::int AS count, sum(amount) AS amount FROM payments`;
  assert.equal(row.count, 1);
  assert.equal(Number(row.amount), 100);
});

test('different concurrent callbacks serialize balances and spill into next month', async () => {
  await sql`UPDATE external_payment_events SET amount = 750 WHERE id = 'event-a'`;
  await sql`INSERT INTO external_payment_events (id,landlord_id,amount,payer_phone)
    VALUES ('event-b','owner-a',750,'0711000001')`;
  await Promise.all([allocateBankEvent(sql, 'event-a'), allocateBankEvent(sql, 'event-b')]);
  const rows = await sql`SELECT id, amount_paid, status FROM invoices WHERE landlord_id = 'owner-a' ORDER BY id`;
  assert.deepEqual(rows.map((r) => [r.id, Number(r.amount_paid), r.status]),
    [['new', 500, 'partially_paid'], ['old', 1000, 'paid']]);
  const [sum] = await sql`SELECT sum(amount) AS amount FROM payments WHERE status = 'completed'`;
  assert.equal(Number(sum.amount), 1500);
});

test('ignores paid/cancelled/disputed and bank validation fixtures', async () => {
  await sql`UPDATE invoices SET status = 'paid', amount_paid = amount WHERE id = 'old'`;
  await sql.unsafe(`INSERT INTO invoices (id,landlord_id,tenant_id,lease_id,amount,billing_period_start,due_date,status,invoice_type)
    VALUES ('uat','owner-a','tenant-a','lease-a',100,'2025-01-01','2025-01-01','pending','uat_validation'),
           ('cancel','owner-a','tenant-a','lease-a',1000,'2025-01-01','2025-01-01','cancelled','rent'),
           ('dispute','owner-a','tenant-a','lease-a',1000,'2025-01-01','2025-01-01','disputed','rent')`);
  await allocateBankEvent(sql, 'event-a');
  const [receipt] = await sql`SELECT invoice_id FROM payments`;
  assert.equal(receipt.invoice_id, 'new');
});

test('overpayment queues the whole event without crediting or losing money', async () => {
  await sql`UPDATE external_payment_events SET amount = 2500 WHERE id = 'event-a'`;
  const result = await allocateBankEvent(sql, 'event-a');
  assert.equal(result.matched, false);
  const [row] = await sql`SELECT (SELECT count(*) FROM payments)::int AS count,
    (SELECT sum(amount_paid) FROM invoices) AS paid,
    (SELECT reconciliation_status FROM external_payment_events WHERE id = 'event-a') AS status`;
  assert.equal(row.count, 0);
  assert.equal(Number(row.paid), 0);
  assert.equal(row.status, 'pending_review');
});

test('missing signature evidence never credits invoices automatically', async () => {
  await sql`UPDATE external_payment_events SET is_verified = false WHERE id = 'event-a'`;
  assert.equal((await allocateBankEvent(sql, 'event-a')).matched, false);
  const [row] = await sql`SELECT count(*)::int AS count FROM payments`;
  assert.equal(row.count, 0);
  const recovered = await allocateBankEvent(sql, 'event-a', { auditEvidence: 'operator-approved test audit' });
  assert.equal(recovered.matched, true);
  const [event] = await sql`SELECT is_verified, reconciliation_status FROM external_payment_events WHERE id = 'event-a'`;
  assert.equal(event.is_verified, false);
  assert.equal(event.reconciliation_status, 'manually_matched');
});

test('unknown and ambiguous tenant phones go to review', async () => {
  await sql`UPDATE external_payment_events SET payer_phone = '0711000099' WHERE id = 'event-a'`;
  assert.equal((await allocateBankEvent(sql, 'event-a')).matched, false);
  await sql`UPDATE external_payment_events SET payer_phone = '0711000001' WHERE id = 'event-a'`;
  await sql`INSERT INTO tenants VALUES ('duplicate','0711000001')`;
  await sql`INSERT INTO leases VALUES ('duplicate-lease','duplicate','unit-a')`;
  assert.equal((await allocateBankEvent(sql, 'event-a')).matched, false);
  const [row] = await sql`SELECT count(*)::int AS count FROM payments`;
  assert.equal(row.count, 0);
});

test('reference identifies the tenant but still pays their oldest month', async () => {
  await sql`UPDATE external_payment_events SET payer_phone = NULL, payer_account_ref = 'REF-NEW' WHERE id = 'event-a'`;
  assert.equal((await allocateBankEvent(sql, 'event-a', { referenceCode: 'BANK-TRANSACTION-ID' })).matched, true);
  const [receipt] = await sql`SELECT invoice_id FROM payments`;
  assert.equal(receipt.invoice_id, 'old');
});

test('foreign landlord reference never credits another portfolio', async () => {
  await sql`UPDATE external_payment_events SET payer_phone = '0711000002', payer_account_ref = 'REF-OTHER' WHERE id = 'event-a'`;
  assert.equal((await allocateBankEvent(sql, 'event-a')).matched, false);
  const [row] = await sql`SELECT count(*)::int AS count FROM payments`;
  assert.equal(row.count, 0);
});

test('conflicting reference and phone require review', async () => {
  await sql`INSERT INTO tenants VALUES ('second','0711000003')`;
  await sql`INSERT INTO leases VALUES ('lease-second','second','unit-a')`;
  await sql`INSERT INTO invoices (id,landlord_id,tenant_id,lease_id,amount,billing_period_start,due_date,reference_code)
    VALUES ('second','owner-a','second','lease-second',1000,'2026-02-01','2026-02-01','REF-SECOND')`;
  await sql`UPDATE external_payment_events SET payer_account_ref = 'REF-SECOND' WHERE id = 'event-a'`;
  assert.equal((await allocateBankEvent(sql, 'event-a')).matched, false);
});

test('reverses all split allocations and cancels receipts, then permits safe reallocation', async () => {
  await sql`UPDATE external_payment_events SET amount = 1500 WHERE id = 'event-a'`;
  await allocateBankEvent(sql, 'event-a');
  const reversed = await sql.begin(async (tx) => {
    await tx`SELECT id FROM external_payment_events WHERE id = 'event-a' FOR UPDATE`;
    return reverseBankAllocations(tx, 'event-a', 'owner-a');
  });
  assert.equal(reversed, 2);
  const [row] = await sql`SELECT sum(amount_paid) AS paid FROM invoices`;
  assert.equal(Number(row.paid), 0);
  assert.equal((await allocateBankEvent(sql, 'event-a')).matched, true);
  const [receipts] = await sql`SELECT count(*)::int AS count, sum(amount) AS amount FROM payments WHERE status = 'completed'`;
  assert.equal(receipts.count, 2);
  assert.equal(Number(receipts.amount), 1500);
});

test('a receipt insert failure rolls back every invoice and event mutation', async () => {
  await sql`UPDATE external_payment_events SET amount = 1500 WHERE id = 'event-a'`;
  await sql.unsafe(`CREATE FUNCTION reject_second_receipt() RETURNS trigger AS $$
    BEGIN IF NEW.invoice_id = 'new' THEN RAISE EXCEPTION 'test insert failure'; END IF; RETURN NEW; END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER reject_second BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION reject_second_receipt();`);
  try {
    await assert.rejects(allocateBankEvent(sql, 'event-a'));
    const [row] = await sql`SELECT (SELECT count(*) FROM payments)::int AS count,
      (SELECT sum(amount_paid) FROM invoices) AS paid,
      (SELECT reconciliation_status FROM external_payment_events WHERE id = 'event-a') AS status`;
    assert.equal(row.count, 0);
    assert.equal(Number(row.paid), 0);
    assert.equal(row.status, 'unmatched');
  } finally {
    await sql.unsafe('DROP TRIGGER reject_second ON payments; DROP FUNCTION reject_second_receipt();');
  }
});

test('a signed Production-style Account callback credits oldest rent and acknowledges duplicates safely', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const oldKey = process.env.KCB_WEBHOOK_PUBLIC_KEY;
  const previousKey = process.env.KCB_WEBHOOK_PUBLIC_KEY_PREVIOUS;
  const oldSecret = process.env.KCB_WEBHOOK_SECRET;
  process.env.KCB_WEBHOOK_PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  delete process.env.KCB_WEBHOOK_PUBLIC_KEY_PREVIOUS;
  delete process.env.KCB_WEBHOOK_SECRET;
  const raw = JSON.stringify({ transactionReference: 'TEST-BANK-TXN', channelCode: '202',
    timestamp: '2026-10-02T10:09:24.000Z', transactionAmount: '100.00', currency: 'KES',
    customerMobileNumber: '254711000001', creditAccountIdentifier: '1234567890', organizationShortCode: '522522' });
  const signature = sign('RSA-SHA256', Buffer.from(raw), privateKey).toString('base64');
  const connection = new Proxy(sql, { get(target, property) {
    return property === 'end' ? async () => {} : Reflect.get(target, property);
  } });
  const invoke = async (mode: 'audit' | 'enforce', signed = true) => {
    const req = Readable.from([Buffer.from(raw)]) as any;
    req.method = 'POST';
    req.headers = signed ? { Signature: signature } : {};
    const state = { status: 0, body: {} as any };
    const res = { status(code: number) { state.status = code; return res; },
      json(body: unknown) { state.body = body; return body; } } as any;
    await handleBankWebhook(req, res, 'kcb', { kcbNotificationKind: 'account', kcbSignatureMode: mode,
      createDbConnection: () => connection });
    return state;
  };
  try {
    await sql.unsafe(`CREATE FUNCTION fail_callback_receipt() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'simulated callback failure'; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_callback BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION fail_callback_receipt();`);
    try {
      const failed = await invoke('enforce');
      assert.equal(failed.body.statusCode, '1');
      const [failedState] = await sql`SELECT (SELECT count(*) FROM payments)::int AS receipts,
        (SELECT reconciliation_status FROM external_payment_events WHERE external_transaction_id = 'TEST-BANK-TXN') AS status`;
      assert.equal(failedState.receipts, 0);
      assert.equal(failedState.status, 'unmatched');
    } finally {
      await sql.unsafe('DROP TRIGGER fail_callback ON payments; DROP FUNCTION fail_callback_receipt();');
    }
    const first = await invoke('enforce');
    assert.equal(first.status, 200);
    assert.equal(first.body.statusCode, '0');
    const [receipt] = await sql`SELECT invoice_id, amount FROM payments`;
    assert.equal(receipt.invoice_id, 'old');
    assert.equal(Number(receipt.amount), 100);
    const duplicate = await invoke('enforce');
    assert.equal(duplicate.body.statusMessage, 'Already processed');
    assert.equal(duplicate.body.transactionID, first.body.transactionID);
    const missing = await invoke('enforce', false);
    assert.equal(missing.status, 401);
    const [count] = await sql`SELECT count(*)::int AS count FROM payments`;
    assert.equal(count.count, 1);
  } finally {
    for (const [name, value] of Object.entries({ KCB_WEBHOOK_PUBLIC_KEY: oldKey,
      KCB_WEBHOOK_PUBLIC_KEY_PREVIOUS: previousKey, KCB_WEBHOOK_SECRET: oldSecret })) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
