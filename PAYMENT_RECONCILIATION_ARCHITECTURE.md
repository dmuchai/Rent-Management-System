# Hybrid Pass-Through Payment Reconciliation Architecture

**Version:** 1.0  
**Date:** February 1, 2026  
**Status:** Implementation Plan

---

## **EXECUTIVE SUMMARY**

Your system currently operates as a **hybrid payment tracker** where:
- Payments flow through Pesapal (Tenant → Pesapal → Landlord)
- M-Pesa STK Push exists but routes through your Paybill (not ideal)
- No support for landlord-specific Paybills
- Payment reconciliation is manual (landlord records completed payments)

**Target Architecture**: Transform into a true **pass-through payment recorder** where:
- Tenants pay directly to landlord Paybills (M-Pesa, bank accounts)
- Platform receives confirmations via webhooks (Daraja, Pesapal)
- Payments auto-reconcile to pending invoices using deterministic + heuristic matching
- Landlords review low-confidence matches
- Platform never touches money (legal/regulatory safe harbor)

---

## **1️⃣ CODEBASE REVIEW - EXISTING STATE**

### **Entities Identified**

#### **Core Tables** (`shared/schema.ts`)
```
users
├── id, email, firstName, lastName, phoneNumber, role
├── Landlords (role='landlord')
└── Tenants (userId reference)

properties
├── id, name, address, ownerId (→ users.id)
└── Owned by landlords

units
├── id, unitNumber, rentAmount, propertyId
└── Belong to properties

tenants
├── id, landlordId, userId, email, phone
└── Linked to users OR standalone (pre-invitation)

leases
├── id, tenantId, unitId, monthlyRent, startDate, endDate, isActive
└── Active contracts

payments (CURRENT - this will evolve)
├── id, leaseId, amount, dueDate, paidDate
├── status (pending/completed/failed)
├── paymentMethod, paymentType
├── pesapalTransactionId, pesapalOrderTrackingId
└── Currently assumes platform-mediated payments
```

### **Current Payment Flow**

**Route**: `api/payments/pesapal/[action].ts`

1. Tenant initiates payment from dashboard
2. System creates `payments` record (status='pending')
3. Redirects to Pesapal checkout
4. Pesapal IPN webhook → Updates status to 'completed'
5. Notifications sent to tenant + landlord

**Problem**: This assumes Pesapal holds/routes money. Doesn't support landlord-specific Paybills.

**M-Pesa STK**: `api/payments/mpesa/push.ts` + `api/payments/mpesa/callback.ts`
- Uses *your* MPESA_SHORTCODE (centralized Paybill)
- Not suitable for multi-landlord pass-through

**Invoicing**: `api/cron/generate-invoices.ts`
- Monthly cron creates `payments` records (type='rent', status='pending')
- These are "invoices" but stored in payments table
- **Gap**: No explicit invoice/bill distinction from payment confirmations

### **Gaps Preventing Reconciliation**

1. **No landlord payment channel registry** (Paybills, bank accounts, till numbers)
2. **Invoices conflated with payments** (same table, confusing semantics)
3. **No external transaction event store** (raw webhook data not preserved)
4. **No reconciliation attempts table** (can't track match confidence)
5. **Webhook endpoints hardcoded to platform Paybill**, not landlord-specific
6. **No reference generation strategy** for invoices (tenant can't include in M-Pesa)

---

## **2️⃣ TARGET ARCHITECTURE**

### **Core Principles**

1. **Invoices ≠ Payments**: Invoices are *what is owed*. Payments are *what was received*.
2. **Two-sided ledger**:
   - **Receivables** (invoices): System generates monthly, tracks due amounts
   - **Receipts** (external_payment_events): Raw confirmations from M-Pesa/banks
3. **Reconciliation engine**: Matches receipts → invoices using deterministic + heuristic rules
4. **Landlord autonomy**: Each landlord brings own Paybill/bank account

### **Payment Flow (Sequence)**

#### **A. Invoice Generation (Unchanged)**
```
1. Cron runs 1st of month
2. For each active lease:
   - Create invoice record (due_date, amount, reference_code)
   - Send notification to tenant with:
     * Landlord Paybill number
     * Invoice reference code (e.g., "INV-UNIT42-202602")
     * Amount due
3. Invoice status = 'pending'
```

#### **B. Tenant Payment (External)**
```
1. Tenant goes to M-Pesa
2. Paybill: <landlord_paybill>
   Account: INV-UNIT42-202602 (max 13 chars - Kenya constraint)
   Amount: 15000
3. M-Pesa confirms instantly to tenant
4. Safaricom sends:
   - SMS to landlord (statement)
   - Webhook to Daraja API (if landlord enabled)
   - Webhook to platform (if configured via C2B)
```

#### **C. Webhook Receipt (Platform)**
```
1. POST /api/webhooks/mpesa/c2b
   - Validates Safaricom signature
   - Extracts: phone, amount, time, reference, TransID
2. Create external_payment_event:
   - raw_payload (full JSON)
   - event_type = 'mpesa_c2b'
   - status = 'received'
   - landlord_id (derived from Paybill config)
3. Trigger reconciliation worker (async)
4. Respond 200 OK (Safaricom timeout = 30s)
```

#### **D. Reconciliation (Automated)**
```
1. Reconciliation engine fetches:
   - New external_payment_events (unmatched)
   - Pending invoices (status='pending')
2. Matching algorithm (see section 5):
   - Level 1: Exact reference + amount + landlord
   - Level 2: Fuzzy reference + amount + time window
   - Level 3: Phone + amount + property heuristics
3. Create payment_reconciliation record:
   - invoice_id, event_id, confidence_score, matched_by
4. If confidence >= 95%:
   - Auto-approve → Update invoice.status = 'paid'
   - Notify tenant + landlord
5. If confidence < 95%:
   - Flag for manual review
   - Notify landlord
```

#### **E. Manual Review (Landlord Dashboard)**
```
1. Landlord sees "3 unmatched payments"
2. UI shows:
   - Transaction details (phone, amount, time)
   - Suggested matches (if any)
   - Open invoices for same property
3. Landlord clicks "Match to Invoice #123"
4. System creates approved reconciliation
5. Invoice marked paid
```

---

## **3️⃣ DATABASE CHANGES (Drizzle Schema)**

### **New Tables**

#### **A. `landlord_payment_channels`**
**Purpose**: Registry of how each landlord receives money

```typescript
export const landlordPaymentChannels = pgTable("landlord_payment_channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  landlordId: varchar("landlord_id").notNull().references(() => users.id),
  channelType: varchar("channel_type").notNull(), // 'mpesa_paybill', 'mpesa_till', 'bank_account'
  
  // M-Pesa specific
  paybillNumber: varchar("paybill_number"), // e.g., "4012345"
  tillNumber: varchar("till_number"),       // e.g., "5123456"
  
  // Bank specific
  bankName: varchar("bank_name"),
  accountNumber: varchar("account_number"),
  accountName: varchar("account_name"),
  
  // Daraja integration (optional)
  darajaConsumerKey: varchar("daraja_consumer_key"),    // Encrypted
  darajaConsumerSecret: varchar("daraja_consumer_secret"), // Encrypted
  darajaShortcode: varchar("daraja_shortcode"),
  darajaCallbackUrl: varchar("daraja_callback_url"),    // For validation callbacks
  
  isPrimary: boolean("is_primary").default(true),
  isActive: boolean("is_active").default(true),
  
  // Metadata
  displayName: varchar("display_name"), // "Main Paybill", "Legacy Till"
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

**Relationships**: One landlord → Many channels (but typically 1 primary)

**Idempotency**: Unique constraint on `(landlord_id, paybill_number)` where not null

---

#### **B. `invoices` (NEW - separates from payments)**
**Purpose**: Formalized bills/receivables generated by system

```typescript
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "pending",      // Awaiting payment
  "partially_paid", // Multiple partial payments
  "paid",         // Fully reconciled
  "overdue",      // Past due_date, unpaid
  "cancelled",    // Voided by landlord
  "disputed"      // Tenant disputes amount
]);

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Core fields
  leaseId: varchar("lease_id").notNull().references(() => leases.id),
  landlordId: varchar("landlord_id").notNull().references(() => users.id), // Denormalized for queries
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),   // Denormalized
  
  // Financial
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).default("0"),
  currency: varchar("currency").default("KES"),
  
  // Timing
  billingPeriodStart: timestamp("billing_period_start").notNull(), // e.g., 2026-02-01
  billingPeriodEnd: timestamp("billing_period_end").notNull(),     // e.g., 2026-02-28
  dueDate: timestamp("due_date").notNull(),                        // e.g., 2026-02-05
  
  // Reference for payment matching
  referenceCode: varchar("reference_code").unique().notNull(), // "INV-U42-0226" (13 chars max)
  
  // Type and description
  invoiceType: varchar("invoice_type").default("rent"), // rent, utility, deposit, etc.
  description: text("description"),
  lineItems: jsonb("line_items"), // [{description: "Rent Feb 2026", amount: 15000}]
  
  // Status
  status: invoiceStatusEnum("status").default("pending"),
  
  // Audit
  issuedAt: timestamp("issued_at").defaultNow(),
  paidAt: timestamp("paid_at"),
  cancelledAt: timestamp("cancelled_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

**Key Design Decisions**:
- `referenceCode`: Auto-generated, short, unique (for M-Pesa account ref)
- `amountPaid`: Tracks partial payments
- Denormalized `landlordId`/`tenantId` for fast filtering

**Reference Code Strategy** (Kenya M-Pesa limits account ref to 13 chars):
```typescript
// Format: INV-{unit_number}-{MMYY}
// Example: INV-A205-0226 (Invoice for Unit A205, Feb 2026)
// Fallback: INV-{hash(lease_id + period)} if unit_number too long
```

---

#### **C. `external_payment_events`**
**Purpose**: Raw immutable webhook events from payment providers

```typescript
export const externalPaymentEvents = pgTable("external_payment_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Source
  eventType: varchar("event_type").notNull(), // 'mpesa_c2b', 'mpesa_b2c', 'pesapal_ipn', 'bank_webhook'
  provider: varchar("provider").notNull(),    // 'safaricom', 'pesapal', 'equity_bank'
  
  // Who received money
  landlordId: varchar("landlord_id").references(() => users.id), // Matched from paybill lookup
  paymentChannelId: varchar("payment_channel_id").references(() => landlordPaymentChannels.id),
  
  // Transaction details (normalized from webhook)
  externalTransactionId: varchar("external_transaction_id").notNull(), // M-Pesa TransID, Pesapal OrderTrackingId
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("KES"),
  
  // Payer details
  payerPhone: varchar("payer_phone"),          // 254712345678
  payerName: varchar("payer_name"),            // From webhook if available
  payerAccountRef: varchar("payer_account_ref"), // What tenant entered in M-Pesa "Account"
  
  // Timing
  transactionTime: timestamp("transaction_time").notNull(), // When payment occurred (from webhook)
  
  // Raw data (for debugging, disputes)
  rawPayload: jsonb("raw_payload").notNull(),  // Full webhook body
  headers: jsonb("headers"),                   // HTTP headers (for signature verification)
  
  // Reconciliation status
  reconciliationStatus: varchar("reconciliation_status").default("unmatched"), 
    // 'unmatched', 'auto_matched', 'manually_matched', 'ignored', 'duplicate'
  
  // Idempotency
  webhookSignature: varchar("webhook_signature"), // For verification
  isVerified: boolean("is_verified").default(false),
  isDuplicate: boolean("is_duplicate").default(false), // Detected duplicate TransID
  duplicateOfId: varchar("duplicate_of_id").references(() => externalPaymentEvents.id), // Self-reference
  
  // Audit
  receivedAt: timestamp("received_at").defaultNow(), // When webhook hit our server
  createdAt: timestamp("created_at").defaultNow(),
});

// Unique constraint to prevent duplicate processing
CREATE UNIQUE INDEX idx_external_payment_events_txid 
  ON external_payment_events(provider, external_transaction_id);
```

**Idempotency Strategy**:
1. Hash `(provider, externalTransactionId)` → If exists, mark `isDuplicate=true`
2. Return 200 OK without reprocessing
3. Link via `duplicateOfId` for audit trail

---

#### **D. `payment_reconciliations`**
**Purpose**: Links external events to invoices (the "match")

```typescript
export const reconciliationStatusEnum = pgEnum("reconciliation_status", [
  "pending_review",  // Below auto-approve threshold
  "auto_approved",   // High confidence, auto-matched
  "manually_approved", // Landlord confirmed
  "rejected",        // Landlord rejected match
  "reversed"         // Approved then reversed (refund scenario)
]);

export const paymentReconciliations = pgTable("payment_reconciliations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Links
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),
  eventId: varchar("event_id").notNull().references(() => externalPaymentEvents.id),
  
  // Amount (may be partial payment)
  allocatedAmount: decimal("allocated_amount", { precision: 10, scale: 2 }).notNull(),
  
  // Matching metadata
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }), // 0.00 - 100.00
  matchedBy: varchar("matched_by"), // 'reference_exact', 'reference_fuzzy', 'phone_heuristic', 'manual'
  matchingRules: jsonb("matching_rules"), // [{rule: 'ref_match', score: 80}, {rule: 'amount_match', score: 95}]
  
  // Status
  status: reconciliationStatusEnum("status").default("pending_review"),
  
  // Approver
  reviewedBy: varchar("reviewed_by").references(() => users.id), // Landlord who approved
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  
  // Audit
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// One event can match multiple invoices (partial payments)
// One invoice can have multiple events (split payments from different sources)
```

**Confidence Score Calculation** (see section 5):
```
Score = weighted sum of:
- Reference match (40 points)
- Amount match (30 points)
- Timing match (15 points)
- Phone match (10 points)
- Landlord/property match (5 points)
```

---

#### **E. Modified `payments` Table**
**Purpose**: Legacy compatibility + explicit payment confirmations

**Changes**:
```typescript
// DEPRECATE or REPURPOSE
// Option 1: Keep for Pesapal-mediated payments (platform checkout)
// Option 2: Merge into invoices + reconciliations
// Recommended: Keep for backward compatibility, add reconciliation link

ALTER TABLE payments ADD COLUMN reconciliation_id varchar REFERENCES payment_reconciliations(id);
ALTER TABLE payments ADD COLUMN invoice_id varchar REFERENCES invoices(id);

// Migration: Backfill existing payments → Create invoices + reconciliations
```

---

## **4️⃣ WEBHOOK & EVENT HANDLING PLAN**

### **A. Webhook Endpoints**

#### **1. M-Pesa C2B (Daraja API)**
**Endpoint**: `POST /api/webhooks/mpesa/c2b`

**Flow**:
```
1. Safaricom POSTs to this URL when payment received on registered Paybill
2. Payload structure:
   {
     "TransactionType": "Pay Bill",
     "TransID": "RBK12345ABC",
     "TransAmount": "15000.00",
     "BusinessShortCode": "4012345",
     "BillRefNumber": "INV-U42-0226",  // Tenant input
     "MSISDN": "254712345678",
     "FirstName": "John",
     "LastName": "Doe",
     "TransTime": "20260201143022"
   }
3. Platform extracts:
   - Paybill (4012345) → Lookup landlord_payment_channels
   - BillRefNumber → Match against invoices.reference_code
   - TransID → Idempotency check
4. Create external_payment_event
5. Enqueue reconciliation job
6. Return { "ResultCode": 0, "ResultDesc": "Accepted" }
```

**Signature Verification**:
- Daraja C2B doesn't use HMAC signatures (unlike B2C)
- Verify via:
  - IP whitelist (Safaricom ranges)
  - TLS mutual auth (if configured)
  - Validate BusinessShortCode matches registered channel

**Idempotency**:
```sql
INSERT INTO external_payment_events (...)
ON CONFLICT (provider, external_transaction_id) DO NOTHING;
```

---

#### **2. M-Pesa STK Callback (Existing, Modified)**
**Endpoint**: `POST /api/webhooks/mpesa/stkpush`

**Note**: Only use if landlord uses your platform to *initiate* collections (rare in pass-through model)

**Modified Flow**:
- Still create `external_payment_event` (not direct payment update)
- Reconciliation engine handles matching

---

#### **3. Pesapal IPN (Modified)**
**Endpoint**: `POST /api/webhooks/pesapal/ipn`

**Use Case**: If landlord uses Pesapal for card/bank payments (platform-mediated checkout)

**Flow**:
1. Receive Pesapal IPN (OrderTrackingId, MerchantReference)
2. Create `external_payment_event` (type='pesapal_ipn')
3. MerchantReference = invoice.id (or reference_code)
4. Reconciliation matches via reference

---

#### **4. Bank Webhooks (Future)**
**Endpoint**: `POST /api/webhooks/bank/:bank_code`

**Example**: Equity Bank, KCB corporate API
- Similar structure to M-Pesa C2B
- Bank reference field maps to invoice reference

---

### **B. Trust & Security Model**

#### **Signature Verification**
```typescript
// api/webhooks/mpesa/c2b.ts
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. IP Whitelist
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (!isAllowedIp(clientIp, SAFARICOM_IP_RANGES)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // 2. Validate BusinessShortCode
  const { BusinessShortCode, TransID } = req.body;
  const channel = await getPaymentChannelByPaybill(BusinessShortCode);
  if (!channel) {
    // Unknown Paybill - log for investigation
    await logSuspiciousWebhook(req.body);
    return res.status(400).json({ error: 'Unknown Paybill' });
  }
  
  // 3. Idempotency check
  const existing = await checkDuplicateTransaction('safaricom', TransID);
  if (existing) {
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Duplicate' });
  }
  
  // 4. Create event
  await createExternalPaymentEvent({
    eventType: 'mpesa_c2b',
    provider: 'safaricom',
    landlordId: channel.landlord_id,
    paymentChannelId: channel.id,
    externalTransactionId: TransID,
    amount: req.body.TransAmount,
    payerPhone: req.body.MSISDN,
    payerAccountRef: req.body.BillRefNumber,
    transactionTime: parseTimestamp(req.body.TransTime),
    rawPayload: req.body,
    isVerified: true
  });
  
  // 5. Trigger reconciliation (async)
  await reconciliationQueue.enqueue(TransID);
  
  return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
}
```

---

### **C. Duplicate Detection**

**Scenarios**:
1. **Safaricom retries** (network timeout) → Same TransID
2. **Tenant pays twice** (forgot first payment) → Different TransID
3. **Replay attack** → Old webhook body resubmitted

**Strategy**:
```typescript
// 1. DB-level unique constraint (handled by Postgres)
CREATE UNIQUE INDEX ON external_payment_events (provider, external_transaction_id);

// 2. Application-level deduplication window (24 hours)
const recent = await sql`
  SELECT id FROM external_payment_events
  WHERE provider = 'safaricom'
    AND external_transaction_id = ${TransID}
    AND received_at > NOW() - INTERVAL '24 hours'
`;

if (recent.length > 0) {
  await sql`UPDATE external_payment_events SET is_duplicate = true WHERE id = ${eventId}`;
  return { duplicate: true, originalId: recent[0].id };
}

// 3. Amount/phone/time clustering (detect tenant double-pay)
const suspicious = await sql`
  SELECT id FROM external_payment_events
  WHERE payer_phone = ${phone}
    AND amount = ${amount}
    AND transaction_time BETWEEN ${time - 5min} AND ${time + 5min}
    AND reconciliation_status = 'unmatched'
`;
if (suspicious.length > 1) {
  // Flag for manual review (likely duplicate payment)
  await flagForReview(suspicious, 'suspected_duplicate');
}
```

---

## **5️⃣ RECONCILIATION LOGIC**

### **Matching Algorithm (Deterministic → Heuristic)**

#### **Level 1: Deterministic Match (Auto-Approve)**
**Confidence**: 100%

```typescript
async function level1Match(event: ExternalPaymentEvent) {
  // Exact reference + amount + landlord
  const invoice = await sql`
    SELECT * FROM invoices
    WHERE reference_code = ${event.payer_account_ref}
      AND landlord_id = ${event.landlord_id}
      AND amount = ${event.amount}
      AND status IN ('pending', 'partially_paid')
      AND due_date >= ${event.transaction_time - 90 days}
  `;
  
  if (invoice.length === 1) {
    return {
      invoiceId: invoice[0].id,
      confidence: 100,
      matchedBy: 'reference_exact',
      rules: [
        { rule: 'reference_exact', score: 40 },
        { rule: 'amount_exact', score: 30 },
        { rule: 'landlord_match', score: 5 },
        { rule: 'timing_valid', score: 15 },
        { rule: 'status_pending', score: 10 }
      ]
    };
  }
  
  return null;
}
```

---

#### **Level 2: Fuzzy Reference Match**
**Confidence**: 80-95%

**Common Tenant Errors**:
- `INV-U42-0226` → `INVU420226` (removed hyphens)
- `INV-U42-0226` → `INV-U42` (truncated)
- `INV-U42-0226` → `inv-u42-0226` (lowercase)

```typescript
function fuzzyReferenceMatch(input: string, expected: string): number {
  // Normalize both
  const norm1 = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const norm2 = expected.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  // Levenshtein distance
  const distance = levenshtein(norm1, norm2);
  
  // Prefix match (tenant typed partial)
  if (norm2.startsWith(norm1) && norm1.length >= 8) {
    return 90; // High confidence (>=8 chars typed correctly)
  }
  
  // Edit distance scoring
  const similarity = 1 - (distance / Math.max(norm1.length, norm2.length));
  return Math.round(similarity * 40); // Max 40 points for reference
}

async function level2Match(event: ExternalPaymentEvent) {
  // Get all pending invoices for this landlord
  const invoices = await sql`
    SELECT * FROM invoices
    WHERE landlord_id = ${event.landlord_id}
      AND status IN ('pending', 'partially_paid')
      AND due_date >= ${event.transaction_time - 90 days}
  `;
  
  const candidates = invoices.map(inv => {
    const refScore = fuzzyReferenceMatch(event.payer_account_ref, inv.reference_code);
    const amountScore = amountMatchScore(event.amount, inv.amount - inv.amount_paid);
    const timeScore = timeProximityScore(event.transaction_time, inv.due_date);
    const phoneScore = phoneMatchScore(event.payer_phone, inv.tenant.phone);
    
    const total = refScore + amountScore + timeScore + phoneScore;
    
    return { invoice: inv, score: total, breakdown: { refScore, amountScore, timeScore, phoneScore } };
  });
  
  candidates.sort((a, b) => b.score - a.score);
  
  if (candidates[0]?.score >= 80) {
    return {
      invoiceId: candidates[0].invoice.id,
      confidence: candidates[0].score,
      matchedBy: 'reference_fuzzy',
      rules: candidates[0].breakdown
    };
  }
  
  return null;
}
```

---

#### **Level 3: Phone + Amount Heuristic**
**Confidence**: 60-80%

**Use Case**: Tenant forgot reference, just paid amount to Paybill

```typescript
async function level3Match(event: ExternalPaymentEvent) {
  // Find invoices where:
  // - Tenant phone matches payer phone
  // - Amount matches (within tolerance)
  // - Due date近期 (within 30 days)
  
  const invoices = await sql`
    SELECT i.*, t.phone as tenant_phone
    FROM invoices i
    JOIN tenants t ON i.tenant_id = t.id
    WHERE i.landlord_id = ${event.landlord_id}
      AND i.status IN ('pending', 'partially_paid')
      AND t.phone = ${event.payer_phone}
      AND ABS(i.amount - i.amount_paid - ${event.amount}) < 100  -- KES 100 tolerance
      AND i.due_date BETWEEN ${event.transaction_time - 30 days} AND ${event.transaction_time + 7 days}
  `;
  
  if (invoices.length === 1) {
    // Single match = high confidence
    return {
      invoiceId: invoices[0].id,
      confidence: 75,
      matchedBy: 'phone_heuristic',
      rules: [
        { rule: 'phone_exact', score: 10 },
        { rule: 'amount_close', score: 25 },
        { rule: 'timing_recent', score: 15 },
        { rule: 'single_candidate', score: 25 }
      ]
    };
  } else if (invoices.length > 1) {
    // Multiple candidates - need manual review
    return {
      candidates: invoices.map(i => i.id),
      confidence: 50,
      matchedBy: 'phone_multiple_matches'
    };
  }
  
  return null;
}
```

---

#### **Scoring Functions**

```typescript
function amountMatchScore(paid: number, due: number): number {
  const diff = Math.abs(paid - due);
  
  if (diff === 0) return 30;
  if (diff <= 50) return 25;   // KES 50 tolerance (rounding)
  if (diff <= 500) return 15;  // Possible partial payment
  return 0;
}

function timeProximityScore(txTime: Date, dueDate: Date): number {
  const daysDiff = Math.abs((txTime.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff <= 3) return 15;   // Paid within 3 days of due
  if (daysDiff <= 7) return 12;
  if (daysDiff <= 30) return 8;
  if (daysDiff <= 90) return 3;   // Late payment (still valid)
  return 0;
}

function phoneMatchScore(payerPhone: string, tenantPhone: string): number {
  // Normalize both (remove +, spaces, etc.)
  const norm1 = normalizePhone(payerPhone);
  const norm2 = normalizePhone(tenantPhone);
  
  if (norm1 === norm2) return 10;
  
  // Sometimes tenant pays from different number (family/friend)
  // Can't give points, but don't penalize
  return 0;
}
```

---

### **Auto-Approval Threshold**

```typescript
const RECONCILIATION_CONFIG = {
  AUTO_APPROVE_THRESHOLD: 95,  // Confidence >= 95% → Auto-approve
  MANUAL_REVIEW_THRESHOLD: 70, // 70-94% → Flag for review
  REJECT_THRESHOLD: 70,        // < 70% → Don't create match, wait for manual
  
  // Safety limits
  MAX_AUTO_APPROVE_AMOUNT: 500000, // KES 500k (don't auto-approve mega payments)
  REQUIRE_LANDLORD_REVIEW_DAYS: 7  // After 7 days unmatched, notify landlord
};

async function reconcileEvent(eventId: string) {
  const event = await getExternalPaymentEvent(eventId);
  
  // Try levels in order
  let match = await level1Match(event);
  if (!match) match = await level2Match(event);
  if (!match) match = await level3Match(event);
  
  if (!match || match.confidence < RECONCILIATION_CONFIG.REJECT_THRESHOLD) {
    // No match - leave unmatched, notify landlord
    await notifyLandlordUnmatchedPayment(event);
    return;
  }
  
  // Create reconciliation record
  const reconciliation = await createReconciliation({
    invoiceId: match.invoiceId,
    eventId: event.id,
    allocatedAmount: event.amount,
    confidenceScore: match.confidence,
    matchedBy: match.matchedBy,
    matchingRules: match.rules,
    status: match.confidence >= RECONCILIATION_CONFIG.AUTO_APPROVE_THRESHOLD 
      ? 'auto_approved' 
      : 'pending_review'
  });
  
  // If auto-approved, update invoice
  if (reconciliation.status === 'auto_approved') {
    await markInvoicePaid(match.invoiceId, event.amount);
    await notifyTenantPaymentConfirmed(event, match.invoiceId);
    await notifyLandlordPaymentReceived(event, match.invoiceId);
  } else {
    // Pending review - notify landlord
    await notifyLandlordReviewRequired(event, match.invoiceId, match.confidence);
  }
}
```

---

## **6️⃣ MANUAL REVIEW & EXCEPTION HANDLING**

### **Unmatched Payment Scenarios**

| **Scenario** | **Why Unmatched** | **Landlord Action** |
|---|---|---|
| Tenant paid to wrong Paybill | `landlord_id` mismatch | Mark as "Not for me" → Refund tenant |
| Tenant entered garbage reference | No fuzzy match found | View recent invoices, manually match |
| Tenant paid partial amount | Amount doesn't match any invoice | Split payment across 2 invoices |
| Tenant paid in advance (no invoice yet) | No pending invoice for future period | Create advance credit, apply next month |
| External transfer (not tenant) | Phone/amount doesn't match | Mark as "Other income" (not rent) |

---

### **Landlord Review UI (Dashboard Section)**

**Route**: `/dashboard/landlord?section=reconciliation`

**Components**:

1. **Unmatched Payments List**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Payments Requiring Review (3)</CardTitle>
  </CardHeader>
  <CardContent>
    {unmatchedEvents.map(event => (
      <div key={event.id} className="border-b pb-4">
        <div className="flex justify-between">
          <div>
            <p className="font-medium">KES {event.amount}</p>
            <p className="text-sm text-gray-600">
              From: {event.payer_phone} ({event.payer_name})
            </p>
            <p className="text-xs text-gray-500">
              {formatDate(event.transaction_time)} • Ref: {event.payer_account_ref || 'None'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => openMatchModal(event)}>
              Match to Invoice
            </Button>
            <Button variant="outline" onClick={() => markAsOther(event)}>
              Not Rent
            </Button>
          </div>
        </div>
        
        {/* Suggested matches */}
        {event.suggestedMatches?.length > 0 && (
          <div className="mt-2 p-2 bg-blue-50 rounded">
            <p className="text-sm font-medium">Suggested Match (Confidence: {event.suggestedMatches[0].confidence}%)</p>
            <p className="text-xs">
              Invoice #{event.suggestedMatches[0].invoice.reference_code} - 
              Unit {event.suggestedMatches[0].invoice.unit_number} - 
              KES {event.suggestedMatches[0].invoice.amount}
            </p>
            <Button size="sm" onClick={() => confirmMatch(event, event.suggestedMatches[0])}>
              Confirm Match
            </Button>
          </div>
        )}
      </div>
    ))}
  </CardContent>
</Card>
```

2. **Match Modal**
```tsx
<Dialog open={isMatchModalOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Match Payment to Invoice</DialogTitle>
    </DialogHeader>
    
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 rounded">
        <h4 className="font-medium">Payment Details</h4>
        <p>Amount: KES {selectedEvent.amount}</p>
        <p>From: {selectedEvent.payer_phone}</p>
        <p>Reference: {selectedEvent.payer_account_ref || 'None provided'}</p>
      </div>
      
      <div>
        <Label>Select Invoice</Label>
        <Select onValueChange={setSelectedInvoiceId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose invoice..." />
          </SelectTrigger>
          <SelectContent>
            {pendingInvoices.map(inv => (
              <SelectItem value={inv.id} key={inv.id}>
                {inv.reference_code} - Unit {inv.unit_number} - 
                KES {inv.amount} (Due: {formatDate(inv.due_date)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label>Amount to Allocate (for partial payments)</Label>
        <Input 
          type="number" 
          defaultValue={selectedEvent.amount}
          max={selectedEvent.amount}
        />
      </div>
      
      <div>
        <Label>Notes (optional)</Label>
        <Textarea placeholder="E.g., 'Tenant paid from spouse phone'" />
      </div>
      
      <Button onClick={handleManualMatch}>Confirm Match</Button>
    </div>
  </DialogContent>
</Dialog>
```

---

### **Audit Trail Requirements**

Every reconciliation action must be logged:

```typescript
export const reconciliationAuditLog = pgTable("reconciliation_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reconciliationId: varchar("reconciliation_id").references(() => paymentReconciliations.id),
  action: varchar("action"), // 'created', 'approved', 'rejected', 'reversed', 'updated'
  performedBy: varchar("performed_by").references(() => users.id),
  previousStatus: varchar("previous_status"),
  newStatus: varchar("new_status"),
  changes: jsonb("changes"), // { field: 'allocated_amount', from: 15000, to: 14500 }
  reason: text("reason"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Access Control**:
- Only property owner can approve/reject reconciliations for their invoices
- Property managers (if role exists) can review but not approve > KES 50k
- System can auto-approve if confidence >= 95%

---

## **7️⃣ API SURFACE CHANGES**

### **New Endpoints**

#### **A. Payment Channels Management**

**`POST /api/landlord/payment-channels`**
```typescript
// Register landlord's Paybill/Till
{
  channelType: "mpesa_paybill",
  paybillNumber: "4012345",
  displayName: "Main Paybill",
  isPrimary: true
}
```

**`GET /api/landlord/payment-channels`**
```typescript
// List landlord's registered channels
[
  {
    id: "ch_123",
    channelType: "mpesa_paybill",
    paybillNumber: "4012345",
    isPrimary: true,
    isActive: true
  }
]
```

**`PUT /api/landlord/payment-channels/:id`**
```typescript
// Update channel (e.g., change primary)
```

---

#### **B. Invoice Management**

**`GET /api/invoices`** (Landlord)
```typescript
// Query params: ?status=pending&tenantId=...
[
  {
    id: "inv_123",
    referenceCode: "INV-U42-0226",
    amount: 15000,
    amountPaid: 0,
    dueDate: "2026-02-05",
    status: "pending",
    tenant: { name: "John Doe", phone: "254712..." },
    unit: { unitNumber: "A205" }
  }
]
```

**`GET /api/invoices/me`** (Tenant)
```typescript
// Tenant's own invoices
[
  {
    id: "inv_123",
    referenceCode: "INV-U42-0226",
    amount: 15000,
    dueDate: "2026-02-05",
    status: "pending",
    landlordPaymentInstructions: {
      paybillNumber: "4012345",
      accountReference: "INV-U42-0226",
      recipientName: "ABC Property Ltd"
    }
  }
]
```

**`POST /api/invoices`** (Manual invoice creation)
```typescript
// For ad-hoc charges (utility, late fee)
{
  leaseId: "lease_123",
  amount: 2500,
  invoiceType: "utility",
  description: "Water Bill - Jan 2026",
  dueDate: "2026-02-15"
}
```

**`PUT /api/invoices/:id/cancel`**
```typescript
// Landlord cancels incorrect invoice
```

---

#### **C. Reconciliation**

**`GET /api/reconciliation/unmatched-events`** (Landlord)
```typescript
// Payments awaiting review
[
  {
    id: "evt_456",
    amount: 15000,
    payerPhone: "254712345678",
    payerAccountRef: "INVU42",
    transactionTime: "2026-02-01T14:30:00Z",
    suggestedMatches: [
      {
        invoiceId: "inv_123",
        confidence: 85,
        invoice: { referenceCode: "INV-U42-0226", ... }
      }
    ]
  }
]
```

**`POST /api/reconciliation/manual-match`** (Landlord)
```typescript
// Manually approve a match
{
  eventId: "evt_456",
  invoiceId: "inv_123",
  allocatedAmount: 15000,
  notes: "Tenant paid from spouse phone"
}
```

**`POST /api/reconciliation/:id/reject`** (Landlord)
```typescript
// Reject suggested match
{
  reason: "Payment was for different property"
}
```

**`GET /api/reconciliation/history`** (Landlord)
```typescript
// Audit log
[
  {
    id: "rec_789",
    invoice: { referenceCode: "INV-U42-0226" },
    event: { amount: 15000, transactionId: "RBK12345" },
    status: "auto_approved",
    confidenceScore: 100,
    matchedAt: "2026-02-01T14:31:00Z"
  }
]
```

---

#### **D. Webhooks (Internal - Not Exposed to Clients)**

**`POST /api/webhooks/mpesa/c2b`** (Safaricom → Platform)

**`POST /api/webhooks/pesapal/ipn`** (Pesapal → Platform)

**`POST /api/webhooks/bank/:bank_code`** (Future)

---

### **Modified Endpoints**

**`GET /api/payments`** → **Deprecated in favor of /api/invoices + /api/reconciliation**

**Alternative**: Keep for backward compatibility, add `source` field:
```typescript
{
  id: "pay_123",
  source: "reconciliation", // or "pesapal_checkout"
  reconciliationId: "rec_789",
  invoiceId: "inv_123",
  // ... existing fields
}
```

---

### **Web vs Mobile Client Differences**

**Web (React SPA)**:
- Full reconciliation UI (landlord dashboard)
- Inline invoice matching
- Bulk actions (approve multiple)

**Mobile (Capacitor)**:
- **Tenant**: View invoices, payment instructions (Paybill + reference)
- **Landlord**: Push notifications for unmatched payments
- Deep link to reconciliation page: `app://reconciliation/:eventId`

**Shared API**: Same endpoints, different UX

---

## **8️⃣ ROLLOUT PLAN (INCREMENTAL)**

### **Phase 1: Foundation (Weeks 1-2)**
**Goal**: Schema + Logging (No Automation)

**Tasks**:
1. ✅ Create new tables (invoices, landlord_payment_channels, external_payment_events, payment_reconciliations)
2. ✅ Add migration scripts (Drizzle)
3. ✅ Implement landlord payment channel registration UI
4. ✅ Modify invoice generation to use new `invoices` table (keep old `payments` for now)
5. ✅ Create webhook endpoints (M-Pesa C2B, Pesapal IPN) → Only log to `external_payment_events`, don't reconcile yet
6. ✅ Test webhook reception with Safaricom sandbox

**Success Criteria**:
- Landlord can register Paybill
- Monthly cron creates `invoices` (not `payments`)
- Webhooks create `external_payment_events` without crashing

**Rollback Plan**: Drop new tables, revert to old `payments`-only flow

---

### **Phase 2: Webhook Ingestion (Weeks 3-4)**
**Goal**: Reliable Event Capture

**Tasks**:
1. ✅ Implement idempotency (unique constraint on TransID)
2. ✅ Add signature verification (IP whitelist for M-Pesa)
3. ✅ Create background worker to process events (Vercel Queues or cron every 5 min)
4. ✅ Duplicate detection logic
5. ✅ Landlord UI to view unmatched events (read-only list)

**Testing**:
- Trigger duplicate webhooks → Verify deduplication
- Forge webhook from non-Safaricom IP → Verify rejection
- Pay to registered Paybill → Verify event created

**Success Criteria**:
- 99% webhook delivery (no dropped events)
- Zero duplicate processing
- Events visible in landlord dashboard

---

### **Phase 3: Automated Matching (Weeks 5-7)**
**Goal**: Reconciliation Engine Live

**Tasks**:
1. ✅ Implement Level 1 matching (deterministic)
2. ✅ Implement Level 2 matching (fuzzy reference)
3. ✅ Implement Level 3 matching (phone + amount)
4. ✅ Auto-approval logic (confidence >= 95%)
5. ✅ Create `payment_reconciliations` on match
6. ✅ Update `invoices.status` to 'paid' on approval
7. ✅ Notifications (tenant + landlord) on auto-approval

**Testing**:
- Pay with exact reference → Auto-match
- Pay with partial reference → Fuzzy match
- Pay with no reference → Phone heuristic
- Pay wrong amount → No match (manual review)

**Success Criteria**:
- >= 80% auto-match rate (exact + fuzzy)
- Zero false positives (incorrect auto-approvals)
- Notifications sent within 1 minute of payment

**Rollback**: Disable auto-approval, require manual review for all

---

### **Phase 4: Manual Review UI (Weeks 8-9)**
**Goal**: Landlord Can Handle Exceptions

**Tasks**:
1. ✅ Build unmatched payments widget (landlord dashboard)
2. ✅ Match modal (select invoice, allocate amount, add notes)
3. ✅ Manual approval action → Creates reconciliation record
4. ✅ "Not for me" / "Other income" buttons
5. ✅ Audit log table + API
6. ✅ Email notifications for pending reviews

**Testing**:
- Pay with wrong reference → Appears in unmatched
- Landlord manually matches → Invoice marked paid
- Landlord rejects → Event marked 'ignored'

**Success Criteria**:
- Landlords can resolve 100% of unmatched within UI
- Average resolution time < 2 hours (from notification)

---

### **Phase 5: Migration & Cleanup (Weeks 10-11)**
**Goal**: Retire Old System

**Tasks**:
1. ✅ Backfill existing `payments` → Create `invoices` + `reconciliations`
2. ✅ Update all existing API clients to use `/api/invoices`
3. ✅ Deprecate `/api/payments` POST (read-only for legacy)
4. ✅ Remove Pesapal-mediated checkout (if no longer needed)
5. ✅ Add soft delete to `payments` table (archive only)

**Success Criteria**:
- All rent payments flow through reconciliation
- Legacy `payments` table frozen (no new inserts)
- Zero client-side errors

---

### **Phase 6: Advanced Features (Weeks 12+)**
**Goal**: Optimize & Scale

**Tasks**:
1. ⚠️ Partial payment support (allocate event across multiple invoices)
2. ⚠️ Advance payment credits (tenant pays before invoice generated)
3. ⚠️ Landlord-initiated refunds (via reconciliation reversal)
4. ⚠️ Bank webhook integration (Equity, KCB)
5. ⚠️ SMS notifications for unmatched payments (not just email)
6. ⚠️ Machine learning for heuristic scoring (improve Level 3)

---

## **9️⃣ EXPLICIT NON-GOALS**

### **What This Architecture Intentionally Does NOT Solve**

1. **⛔ Payouts / Disbursements**
   - Platform does NOT send money to landlords
   - Landlords receive funds directly via their Paybill/bank
   - No "withdraw balance" feature

2. **⛔ Escrow / Held Funds**
   - Platform does NOT hold security deposits
   - Deposits must be paid directly to landlord's bank/Paybill
   - No regulated money holding

3. **⛔ Split Payments**
   - Platform does NOT split rent between landlord + property manager
   - If PM takes commission, they handle it offline
   - Single recipient per payment channel

4. **⛔ Multi-Currency**
   - Kenya only (KES)
   - No USD/EUR support
   - Forex conversion out of scope

5. **⛔ Tenant-to-Tenant Payments**
   - Roommate rent splitting not supported
   - One tenant = one invoice
   - Shared leases require manual landlord action

6. **⛔ Automated Refunds**
   - Overpayments flagged but NOT auto-refunded
   - Landlord must manually process refund via M-Pesa B2C or bank
   - Platform tracks credit balance only

7. **⛔ Subscription Billing**
   - Not designed for SaaS (no metered usage, tiers, etc.)
   - Rent is fixed-amount recurring
   - Variable charges (utilities) require manual invoicing

8. **⛔ Payment Reminders Before Due**
   - System sends invoice notification (when generated)
   - No "3 days before due" auto-reminders (keep simple)
   - Landlord can manually trigger reminder

9. **⛔ Credit Checks / Risk Scoring**
   - No tenant creditworthiness assessment
   - No late payment penalties (landlord adds manually)
   - No collections automation

10. **⛔ Regulatory Compliance Automation**
    - Platform is a recorder, not a payment facilitator
    - Landlords responsible for tax reporting (1099 equivalent)
    - No automated withholding tax calculations

---

## **IMPLEMENTATION PRIORITIES**

### **Must-Have for MVP** (Phase 1-4)
- ✅ Landlord payment channel registration
- ✅ Invoice generation (separate from payments)
- ✅ M-Pesa C2B webhook ingestion
- ✅ Deterministic reconciliation (Level 1)
- ✅ Manual review UI
- ✅ Auto-approval for high-confidence matches

### **Nice-to-Have for V1.1** (Phase 5-6)
- ⚠️ Fuzzy reference matching (Level 2)
- ⚠️ Phone heuristics (Level 3)
- ⚠️ Partial payment allocation
- ⚠️ Bank webhooks

### **Future (V2+)**
- ⚠️ ML-based matching
- ⚠️ Multi-property manager support
- ⚠️ Tenant payment analytics (on-time rate, etc.)

---

## **KEY DESIGN DECISIONS & RATIONALE**

1. **Why separate `invoices` from `payments`?**
   - Invoices = obligation to pay (immutable)
   - Payments = actual money received (from external source)
   - Reconciliation = mapping between them
   - Allows partial payments, overpayments, disputes

2. **Why `external_payment_events` instead of directly updating `payments`?**
   - Webhooks are untrusted (can be forged, duplicated)
   - Need immutable audit trail of raw data
   - Reconciliation can be retried/reversed without losing webhook data
   - Supports multiple providers (M-Pesa, Pesapal, banks) with different schemas

3. **Why confidence scoring instead of binary match?**
   - Real-world payments are messy (typos, wrong refs, partial amounts)
   - Binary would reject too many valid payments
   - Graduated thresholds allow safe automation + human oversight

4. **Why denormalize `landlordId` in `invoices`?**
   - Query performance (filtering invoices by landlord is common)
   - Avoids 3-table join (invoices → leases → units → properties → users)
   - Data consistency maintained via triggers/app logic

5. **Why 13-character reference code limit?**
   - M-Pesa Paybill "Account Number" field = max 13 alphanumeric
   - Must fit: `INV-{identifier}-{period}`
   - Forces short, deterministic format

6. **Why auto-approve at 95% instead of 100%?**
   - 100% = only exact matches (excludes legitimate fuzzy matches)
   - 95% = allows minor typos (e.g., removed hyphen) but still safe
   - Tunable based on fraud/error rate

---

## **RISK MITIGATION**

### **Financial Risks**

| **Risk** | **Mitigation** |
|---|---|
| False positive match (pay wrong invoice) | ✅ Require >= 95% confidence for auto-approval<br>✅ Audit log with reversal capability<br>✅ Amount limit (no auto-approve > KES 500k) |
| Duplicate payments processed | ✅ Unique constraint on `(provider, transaction_id)`<br>✅ 24-hour deduplication window |
| Fraudulent webhook (fake payment) | ✅ IP whitelist (Safaricom ranges)<br>✅ Signature verification (when available)<br>✅ Paybill ownership validation |
| Tenant pays to wrong Paybill | ✅ Clear UI showing landlord Paybill number<br>✅ Landlord can mark as "not for me"<br>✅ Tenant can upload receipt for manual review |

### **Technical Risks**

| **Risk** | **Mitigation** |
|---|---|
| Webhook endpoint downtime | ✅ Safaricom retries (3x over 24h)<br>✅ Fallback: Landlord uploads M-Pesa statement |
| Database migration failure | ✅ Incremental rollout (new tables don't break old flow)<br>✅ Dual-write period (both old + new tables)<br>✅ Rollback plan (drop new tables) |
| Reconciliation performance (1000s events) | ✅ Index on `invoices.reference_code`<br>✅ Background worker (async processing)<br>✅ Batch reconciliation (process 100 events at once) |
| Race condition (2 events match same invoice) | ✅ Optimistic locking (`SELECT FOR UPDATE`)<br>✅ Check `invoice.status != 'paid'` before matching |

---

## **NEXT STEPS**

1. **Stakeholder Review** (1 week)
   - Product: Validate reconciliation UX mockups
   - Finance: Confirm legal pass-through model (Kenya law)
   - Engineering: Capacity planning (Vercel function limits)

2. **Proof of Concept** (1 week)
   - Build Phase 1 (schema + webhook logging)
   - Test with Safaricom sandbox (C2B callback)
   - Validate reference code generation

3. **Full Implementation** (11 weeks)
   - Follow rollout plan (Phases 1-5)
   - Weekly demos to stakeholders
   - Beta test with 5 landlords (Phase 3)

4. **Go-Live** (Week 12)
   - Enable auto-reconciliation for all users
   - Monitor error rates (target < 5% manual review)
   - Collect feedback for Phase 6 features

---

**END OF IMPLEMENTATION PLAN**

This architecture transforms your system from a **payment processor** to a **payment recorder**, aligning with Kenya's M-Pesa ecosystem and regulatory realities while enabling automated reconciliation at scale.
