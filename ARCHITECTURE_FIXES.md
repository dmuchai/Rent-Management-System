# Payment Reconciliation Architecture - Required Fixes & Enhancements

This document outlines critical fixes and enhancements needed for the Payment Reconciliation Architecture described in PAYMENT_RECONCILIATION_ARCHITECTURE.md.

---

## 1. Configuration Management

### Issue
Hardcoded tolerances and windows throughout reconciliation logic (90-day lookback, 30-day due date window, amount tolerances: 50, 500, 100 KES).

### Solution
```typescript
// config/reconciliation.ts
export const RECONCILIATION_CONFIG = {
  MATCHING: {
    LOOKBACK_DAYS: 90,
    DUE_DATE_WINDOW_DAYS: 30,
    AMOUNT_TOLERANCE_SMALL: 50,  // KES
    AMOUNT_TOLERANCE_MEDIUM: 500,
    AMOUNT_TOLERANCE_LARGE: 100,
  },
  AUTO_APPROVE: {
    CONFIDENCE_THRESHOLD: 0.85,
    MAX_AMOUNT: 500000, // KES 500k
  },
  LEVEL3_HEURISTIC: {
    AMOUNT_TOLERANCE: 10,
    DUE_DATE_WINDOW_START: -7,
    DUE_DATE_WINDOW_END: 3,
  }
};

// Allow landlord-specific overrides
export async function getConfigForLandlord(landlordId: string) {
  const override = await db.query.landlordReconciliationConfig.findFirst({
    where: eq(landlordReconciliationConfig.landlordId, landlordId)
  });
  
  return override ? { ...RECONCILIATION_CONFIG, ...override } : RECONCILIATION_CONFIG;
}
```

---

## 2. Duplicate Payment Detection - Atomic Insert

### Issue
SELECT-then-UPDATE duplicate check is racy across processes.

### Solution
```typescript
async function createExternalPaymentEvent(data: InsertExternalPaymentEvent) {
  try {
    const [event] = await db.insert(externalPaymentEvents)
      .values(data)
      .returning();
    return { eventId: event.id, duplicate: false };
  } catch (error: any) {
    // Check for unique constraint violation (PG error code 23505)
    if (error.code === '23505' && error.constraint === 'uq_external_payment_events_provider_txn') {
      const [original] = await db.select({ id: externalPaymentEvents.id })
        .from(externalPaymentEvents)
        .where(and(
          eq(externalPaymentEvents.provider, data.provider),
          eq(externalPaymentEvents.externalTransactionId, data.externalTransactionId)
        ))
        .limit(1);
      
      return { duplicate: true, originalId: original.id };
    }
    throw error;
  }
}
```

---

## 3. Suspicious Payment Handling

### Issue
Suspicious payments only flagged but not blocked from auto-processing.

### Solution
```typescript
async function handleSuspiciousPayments(suspicious: ExternalPaymentEvent[]) {
  if (suspicious.length === 0) return;
  
  const suspiciousIds = suspicious.map(s => s.id);
  
  // 1. Block auto-reconciliation
  await db.update(externalPaymentEvents)
    .set({ reconciliationStatus: 'needs_review' })
    .where(inArray(externalPaymentEvents.id, suspiciousIds));
  
  // 2. Notify tenant immediately
  await notifyTenantPossibleDuplicate(suspicious);
  
  // 3. Flag for manual review
  await flagForReview(suspicious, 'suspected_duplicate');
}

// Guard in auto-reconcile
async function autoReconcile(event: ExternalPaymentEvent) {
  if (event.reconciliationStatus === 'needs_review') {
    console.log(`[Reconciliation] Skipping event ${event.id} - needs manual review`);
    return null;
  }
  // ... continue reconciliation
}
```

---

## 4. Level 2 Matching - Prevent Memory Overflow

### Issue
Loading all pending invoices into memory for fuzzy matching.

### Solution
```typescript
async function level2Match(event: ExternalPaymentEvent, config: ReconciliationConfig) {
  const amountTolerance = config.MATCHING.AMOUNT_TOLERANCE_MEDIUM;
  const amountMin = parseFloat(event.amount) - amountTolerance;
  const amountMax = parseFloat(event.amount) + amountTolerance;
  
  // Pre-filter in SQL with safety limit
  const invoices = await db.select()
    .from(invoices)
    .where(and(
      eq(invoices.landlordId, event.landlordId!),
      eq(invoices.status, 'pending'),
      gte(invoices.amount, amountMin.toString()),
      lte(invoices.amount, amountMax.toString()),
      // Optional: due date window
      gte(invoices.dueDate, sql`NOW() - INTERVAL '${config.MATCHING.DUE_DATE_WINDOW_DAYS} days'`)
    ))
    .limit(100); // Safety cap
  
  // Score only the filtered subset
  const scored = invoices.map(invoice => ({
    invoice,
    score: calculateMatchScore(event, invoice)
  }));
  
  return scored.find(s => s.score > 0.7)?.invoice || null;
}
```

---

## 5. Level 3 Heuristic - Tighten Criteria

### Issue
Level 3 matching too permissive, may cause false positives.

### Solution
```typescript
async function level3Match(event: ExternalPaymentEvent, config: ReconciliationConfig) {
  const tolerance = config.LEVEL3_HEURISTIC.AMOUNT_TOLERANCE;
  
  const candidates = await db.select({
    invoice: invoices,
    tenant: tenants,
    invoiceCount: sql<number>`COUNT(*) OVER (PARTITION BY ${tenants.id})`.as('invoice_count')
  })
  .from(invoices)
  .innerJoin(tenants, eq(invoices.tenantId, tenants.id))
  .where(and(
    eq(invoices.landlordId, event.landlordId!),
    eq(invoices.status, 'pending'),
    eq(tenants.phoneVerified, true), // Only verified phones
    sql`ABS((${invoices.amount} - ${invoices.amountPaid}) - ${event.amount}) <= ${tolerance}`,
    sql`${invoices.dueDate} BETWEEN NOW() + INTERVAL '${config.LEVEL3_HEURISTIC.DUE_DATE_WINDOW_START} days' 
        AND NOW() + INTERVAL '${config.LEVEL3_HEURISTIC.DUE_DATE_WINDOW_END} days'`
  ))
  .limit(10);
  
  // Require single invoice for auto-match
  if (candidates.length > 1 || candidates[0]?.invoiceCount > 1) {
    await markAsNeedsReview(event.id, 'multiple_candidates');
    return null;
  }
  
  // Check payment history
  const onTimeRate = await calculateOnTimeRate(candidates[0].tenant.id);
  const confidence = onTimeRate > 0.8 ? 0.75 : 0.6;
  
  return { invoice: candidates[0].invoice, confidence, requiresManualReview: confidence < 0.7 };
}
```

---

## 6. Deterministic Locking for Race Conditions

### Issue
Deterministic match can race across processes during invoice selection.

### Solution
```typescript
async function level1Match(event: ExternalPaymentEvent) {
  return await db.transaction(async (tx) => {
    const [invoice] = await tx.select()
      .from(invoices)
      .where(and(
        eq(invoices.referenceCode, event.payerAccountRef!),
        eq(invoices.landlordId, event.landlordId!),
        eq(invoices.status, 'pending')
      ))
      .orderBy(invoices.dueDate)
      .limit(1)
      .for('update', { skipLocked: true }); // Pessimistic lock
    
    if (!invoice) return null;
    
    // Create reconciliation within same transaction
    await tx.insert(paymentReconciliations).values({
      externalPaymentEventId: event.id,
      invoiceId: invoice.id,
      matchedBy: 'deterministic',
      confidence: 1.0,
      status: 'auto_approved'
    });
    
    return invoice;
  });
}
```

---

## 7. Reference Code Generation - Handle 13-Char Limit

### Issue
INV-{unit_number}-{MMYY} can exceed M-Pesa's 13-char limit.

### Solution
```typescript
import crypto from 'crypto';

function generateReferenceCode(
  unitNumber: string, 
  leaseId: string, 
  period: string
): string {
  // Try human-readable first
  const readable = `INV-${unitNumber}-${period}`;
  
  if (validateMpesaRef(readable)) {
    return readable;
  }
  
  // Fallback: deterministic hash
  const hash = crypto.createHash('sha256')
    .update(`${unitNumber}:${leaseId}:${period}`)
    .digest('base64')
    .replace(/[^A-Z0-9]/gi, '')
    .substring(0, 10);
  
  return `INV${hash}`;
}

function validateMpesaRef(ref: string): boolean {
  return ref.length <= 13 && /^[A-Z0-9-]+$/i.test(ref);
}

async function resolveReferenceCollision(
  landlordId: string, 
  candidateRef: string
): Promise<string> {
  const existing = await db.select()
    .from(invoices)
    .where(and(
      eq(invoices.landlordId, landlordId),
      eq(invoices.referenceCode, candidateRef)
    ))
    .limit(1);
  
  if (!existing.length) return candidateRef;
  
  // Add deterministic suffix
  const suffix = crypto.createHash('md5')
    .update(candidateRef + Date.now())
    .digest('hex')
    .substring(0, 3)
    .toUpperCase();
  
  return candidateRef.substring(0, 10) + suffix;
}
```

---

## 8. Levenshtein Distance Implementation

### Issue
`fuzzyReferenceMatch` references undefined `levenshtein()` function.

### Solution
```typescript
// Option 1: Use library
import { distance as levenshtein } from 'fastest-levenshtein';

// Option 2: Local implementation
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

function fuzzyReferenceMatch(ref1: string, ref2: string): number {
  const distance = levenshtein(ref1.toLowerCase(), ref2.toLowerCase());
  const maxLen = Math.max(ref1.length, ref2.length);
  return 1 - (distance / maxLen);
}
```

---

## 9. Webhook Security - Defense in Depth

### Issue
IP-whitelist-only approach insufficient for M-Pesa C2B webhooks.

### Solution
```typescript
const SAFARICOM_IP_RANGES = ['196.201.214.0/24', '196.201.213.0/24'];

async function mpesaC2BWebhookHandler(req: Request, res: Response) {
  const startTime = Date.now();
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({ ResultCode: 1, ResultDesc: 'Timeout' });
    }
  }, 25000);
  
  try {
    // 1. IP Whitelist (first line of defense)
    if (!isAllowedIp(req.ip, SAFARICOM_IP_RANGES)) {
      clearTimeout(timeout);
      await logSuspiciousWebhook({ ip: req.ip, body: req.body });
      return res.status(403).json({ ResultCode: 1, ResultDesc: 'Forbidden' });
    }
    
    // 2. Rate limiting
    await rateLimit(req.ip, { max: 100, window: 60000 });
    
    // 3. Timestamp/replay protection
    const transTime = parseTimestamp(req.body.TransTime);
    if (Date.now() - transTime.getTime() > 5 * 60 * 1000) { // 5 min
      clearTimeout(timeout);
      return res.status(400).json({ ResultCode: 1, ResultDesc: 'Request too old' });
    }
    
    // 4. BusinessShortCode ownership check
    const channel = await getPaymentChannelByPaybill(req.body.BusinessShortCode);
    if (!channel) {
      clearTimeout(timeout);
      await logSuspiciousWebhook({ shortCode: req.body.BusinessShortCode, body: req.body });
      return res.status(400).json({ ResultCode: 1, ResultDesc: 'Unknown paybill' });
    }
    
    // 5. Process event
    const result = await createExternalPaymentEvent({
      eventType: 'mpesa_c2b',
      provider: 'safaricom',
      landlordId: channel.landlordId,
      paymentChannelId: channel.id,
      externalTransactionId: req.body.TransID,
      amount: req.body.TransAmount,
      payerPhone: req.body.MSISDN,
      payerName: req.body.BillRefNumber,
      payerAccountRef: req.body.BillRefNumber,
      transactionTime: transTime,
      rawPayload: req.body,
    });
    
    if (result.duplicate) {
      clearTimeout(timeout);
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Duplicate - already processed' });
    }
    
    // Enqueue reconciliation (don't await)
    reconciliationQueue.enqueue(result.eventId).catch(err => {
      console.error('[Webhook] Failed to enqueue reconciliation:', err);
    });
    
    clearTimeout(timeout);
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error: any) {
    clearTimeout(timeout);
    console.error('[Webhook] Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ResultCode: 1, ResultDesc: 'Internal error' });
    }
  }
}
```

---

## 10. Encryption for Daraja Credentials

### Issue
Schema lacks encryption implementation details for `darajaConsumerKey` and `darajaConsumerSecret`.

### Solution

**Schema Comments Update:**
```typescript
// landlord_payment_channels table
darajaConsumerKey: varchar("daraja_consumer_key"),     
// Encrypted using AES-256-GCM (application-level)
// Key management: AWS KMS or env var ENCRYPTION_KEY
// Encrypt on insert: encrypt(plaintext, ENCRYPTION_KEY)
// Decrypt on read: decrypt(ciphertext, ENCRYPTION_KEY)
// Rotation: quarterly, re-encrypt all credentials

darajaConsumerSecret: varchar("daraja_consumer_secret"), 
// Same encryption as darajaConsumerKey
```

**Implementation:**
```typescript
// lib/crypto.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY = process.env.ENCRYPTION_KEY || throwError('ENCRYPTION_KEY required');

export function encrypt(plaintext: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(KEY, salt, 100000, 32, 'sha512');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

export function decrypt(ciphertext: string): string {
  const data = Buffer.from(ciphertext, 'base64');
  const salt = data.subarray(0, SALT_LENGTH);
  const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  
  const key = crypto.pbkdf2Sync(KEY, salt, 100000, 32, 'sha512');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  return decipher.update(encrypted) + decipher.final('utf8');
}

// Usage in API
async function createPaymentChannel(data: any) {
  if (data.darajaConsumerSecret) {
    data.darajaConsumerSecret = encrypt(data.darajaConsumerSecret);
  }
  // ... insert
}

async function getPaymentChannel(id: string) {
  const channel = await db.query.landlordPaymentChannels.findFirst({ where: eq(id) });
  if (channel?.darajaConsumerSecret) {
    channel.darajaConsumerSecret = decrypt(channel.darajaConsumerSecret);
  }
  return channel;
}
```

---

## 11. Manual Match Idempotency

### Issue
`/api/reconciliation/manual-match` endpoint lacks idempotency protection.

### Solution
```typescript
// Add idempotency_keys table to schema
export const idempotencyKeys = pgTable("idempotency_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull(),
  endpoint: varchar("endpoint").notNull(),
  response: jsonb("response").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueKeyEndpoint: unique().on(table.key, table.endpoint),
  createdAtIdx: index("idx_idempotency_created").on(table.createdAt),
}));

// Middleware
async function handleIdempotency(
  req: Request, 
  res: Response, 
  handler: () => Promise<any>
) {
  const idempotencyKey = req.headers['idempotency-key'] as string;
  
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header required' });
  }
  
  const endpoint = '/api/reconciliation/manual-match';
  
  // Check for existing response (within 24h retention)
  const [existing] = await db.select()
    .from(idempotencyKeys)
    .where(and(
      eq(idempotencyKeys.key, idempotencyKey),
      eq(idempotencyKeys.endpoint, endpoint),
      sql`${idempotencyKeys.createdAt} > NOW() - INTERVAL '24 hours'`
    ))
    .limit(1);
  
  if (existing) {
    return res.status(200).json(existing.response);
  }
  
  // Execute handler
  const response = await handler();
  
  // Persist response
  await db.insert(idempotencyKeys).values({
    key: idempotencyKey,
    endpoint,
    response,
  });
  
  return res.status(200).json(response);
}

// Usage
app.post('/api/reconciliation/manual-match', async (req, res) => {
  return handleIdempotency(req, res, async () => {
    return await createManualReconciliation(req.body);
  });
});
```

---

## 12. Payment Channel Access Control & Audit

### Issue
GET /api/landlord/payment-channels returns sensitive data without proper access control or auditing.

### Solution
```typescript
app.get('/api/landlord/payment-channels', requireAuth, async (req, res) => {
  const requestingUser = req.user;
  const channels = await db.query.landlordPaymentChannels.findMany({
    where: eq(landlordPaymentChannels.landlordId, requestingUser.id)
  });
  
  const response = channels.map(channel => {
    const isOwner = requestingUser.id === channel.landlordId;
    const isAdmin = requestingUser.role === 'admin';
    const canViewSensitive = isOwner || isAdmin;
    
    // Audit log
    db.insert(auditLogs).values({
      userId: requestingUser.id,
      action: 'view_payment_channel',
      resourceId: channel.id,
      sensitiveDataAccessed: canViewSensitive,
    }).catch(console.error);
    
    if (!canViewSensitive) {
      return {
        ...channel,
        paybillNumber: channel.paybillNumber ? '****' + channel.paybillNumber.slice(-4) : null,
        darajaConsumerKey: undefined,
        darajaConsumerSecret: undefined,
      };
    }
    
    return channel;
  });
  
  res.json(response);
});
```

---

## 13. Pagination for List Endpoints

### Issue
No pagination on list endpoints (GET /api/invoices, GET /api/reconciliation/unmatched-events, GET /api/reconciliation/history).

### Solution
```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const ALLOWED_SORT_FIELDS = ['created_at', 'amount', 'due_date', 'status'];

async function paginatedQuery<T>(
  query: any,
  page: number = 1,
  limit: number = 50,
  sortBy: string = 'created_at',
  order: 'asc' | 'desc' = 'desc'
): Promise<PaginatedResponse<T>> {
  // Validate and sanitize
  page = Math.max(1, parseInt(String(page)));
  limit = Math.min(100, Math.max(1, parseInt(String(limit))));
  
  if (!ALLOWED_SORT_FIELDS.includes(sortBy)) {
    sortBy = 'created_at';
  }
  
  const offset = (page - 1) * limit;
  
  // Get total count
  const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` }).from(query);
  const total = Number(count);
  const totalPages = Math.ceil(total / limit);
  
  // Get page data
  const data = await query
    .orderBy(order === 'desc' ? desc(sortBy) : asc(sortBy))
    .limit(limit)
    .offset(offset);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
```

---

## 14. Reconciliation Status Enum

### Issue
`reconciliationStatus` using varchar instead of Postgres enum.

### Solution
```typescript
// Add enum definition
export const reconciliationStatusEnum = pgEnum('reconciliation_status', [
  'unmatched',
  'auto_matched',
  'manually_matched',
  'needs_review',
  'ignored',
  'duplicate'
]);

// Update table definition
export const externalPaymentEvents = pgTable("external_payment_events", {
  // ... other fields
  reconciliationStatus: reconciliationStatusEnum("reconciliation_status").default("unmatched"),
  // ... rest
});
```

---

## 15. Auto-Approval Amount Cap

### Issue
Missing KES 500k cap on auto-approvals.

### Solution
```typescript
async function shouldAutoApprovePayment(
  event: ExternalPaymentEvent,
  invoice: Invoice,
  confidence: number
): Promise<boolean> {
  const MAX_AUTO_APPROVE_AMOUNT = 500000; // KES
  const amount = parseFloat(event.amount);
  
  // Check amount cap
  if (amount > MAX_AUTO_APPROVE_AMOUNT) {
    console.log(`[Auto-Approve] Rejected: amount ${amount} exceeds cap ${MAX_AUTO_APPROVE_AMOUNT}`);
    await db.update(externalPaymentEvents)
      .set({ reconciliationStatus: 'needs_review' })
      .where(eq(externalPaymentEvents.id, event.id));
    return false;
  }
  
  // Check confidence threshold
  if (confidence < RECONCILIATION_CONFIG.AUTO_APPROVE.CONFIDENCE_THRESHOLD) {
    return false;
  }
  
  // Check overpayment
  const invoiceBalance = parseFloat(invoice.amount) - parseFloat(invoice.amountPaid);
  if (amount > invoiceBalance) {
    console.log(`[Auto-Approve] Overpayment detected: ${amount} > ${invoiceBalance}`);
    return false;
  }
  
  return true;
}
```

---

## 16. Manual Match Validation

### Issue
Amount allocation input lacks validation in UI and backend.

### Solution

**Frontend:**
```typescript
function ManualMatchModal({ selectedEvent, selectedInvoice }) {
  const [allocatedAmount, setAllocatedAmount] = useState(selectedEvent.amount);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  
  const remainingBalance = parseFloat(selectedInvoice.amount) - parseFloat(selectedInvoice.amountPaid);
  
  const handleAmountChange = (value: string) => {
    const amount = parseFloat(value);
    setAllocatedAmount(value);
    setError('');
    setWarning('');
    
    if (amount <= 0) {
      setError('Amount must be greater than 0');
    } else if (amount > parseFloat(selectedEvent.amount)) {
      setError(`Amount cannot exceed payment amount (${selectedEvent.amount})`);
    } else if (amount > remainingBalance) {
      setWarning(`Amount exceeds remaining invoice balance (${remainingBalance}). This will create an overpayment.`);
    }
  };
  
  return (
    <div>
      <Label>Amount to Allocate</Label>
      <Input
        type="number"
        min="0"
        step="0.01"
        max={selectedEvent.amount}
        value={allocatedAmount}
        onChange={(e) => handleAmountChange(e.target.value)}
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {warning && <p className="text-yellow-600 text-sm">{warning}</p>}
    </div>
  );
}
```

**Backend:**
```typescript
app.post('/api/reconciliation/manual-match', requireAuth, async (req, res) => {
  const { eventId, invoiceId, allocatedAmount } = req.body;
  
  const event = await getEventById(eventId);
  const invoice = await getInvoiceById(invoiceId);
  
  // Validate amount
  const amount = parseFloat(allocatedAmount);
  const eventAmount = parseFloat(event.amount);
  
  if (amount <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than 0' });
  }
  
  if (amount > eventAmount) {
    return res.status(400).json({ error: 'Amount cannot exceed payment amount' });
  }
  
  const invoiceBalance = parseFloat(invoice.amount) - parseFloat(invoice.amountPaid);
  if (amount > invoiceBalance) {
    // Optional: allow with warning
    console.warn(`[Manual Match] Overpayment: ${amount} > ${invoiceBalance}`);
  }
  
  // ... create reconciliation
});
```

---

## 17. Data Privacy & Compliance

### Issue
Missing GDPR/CCPA compliance and data retention policies.

### Solution
```typescript
// Data retention configuration
const DATA_RETENTION_POLICY = {
  RAW_WEBHOOKS: 90, // days
  ANONYMIZE_PII: 365, // days after transaction
  AUDIT_LOGS: 2555, // 7 years (compliance)
};

// Scheduled job
async function enforceDataRetention() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DATA_RETENTION_POLICY.RAW_WEBHOOKS);
  
  // Scrub raw webhook payloads
  await db.update(externalPaymentEvents)
    .set({ rawPayload: sql`'{}'::jsonb` })
    .where(lt(externalPaymentEvents.createdAt, cutoffDate));
  
  // Anonymize PII after retention period
  const anonymizeCutoff = new Date();
  anonymizeCutoff.setDate(anonymizeCutoff.getDate() - DATA_RETENTION_POLICY.ANONYMIZE_PII);
  
  await db.update(externalPaymentEvents)
    .set({
      payerName: '[REDACTED]',
      payerPhone: '[REDACTED]',
    })
    .where(lt(externalPaymentEvents.transactionTime, anonymizeCutoff));
}

// GDPR data export endpoint
app.get('/api/tenant/data-export', requireAuth, async (req, res) => {
  const userId = req.user.id;
  
  const data = {
    user: await db.query.users.findFirst({ where: eq(users.id, userId) }),
    tenantProfiles: await db.query.tenants.findMany({ where: eq(tenants.userId, userId) }),
    leases: await db.query.leases.findMany({ where: eq(leases.tenantId, userId) }),
    payments: await db.query.externalPaymentEvents.findMany({ 
      where: eq(externalPaymentEvents.payerPhone, req.user.phone) 
    }),
  };
  
  res.json(data);
});

// Data deletion workflow
async function handleDataDeletionRequest(userId: string) {
  await db.transaction(async (tx) => {
    // Pseudonymize instead of delete (preserve financial records)
    await tx.update(users)
      .set({
        email: `deleted-${userId}@example.com`,
        phone: null,
        fullName: '[DELETED USER]',
      })
      .where(eq(users.id, userId));
    
    // Log deletion
    await tx.insert(auditLogs).values({
      action: 'user_deletion',
      userId,
      details: { reason: 'GDPR request', timestamp: new Date() },
    });
  });
}
```

---

## 18. API Security Section

### Issue
Architecture lacks comprehensive API security controls.

### Solution - Add to PAYMENT_RECONCILIATION_ARCHITECTURE.md:

```markdown
## API Security

### Authentication
- **JWT Access Tokens**: 1-hour expiry
- **Refresh Tokens**: 30-day expiry
- **Header**: `Authorization: Bearer <token>`

### Webhook Protection
- **M-Pesa C2B** (`POST /api/webhooks/mpesa/c2b`):
  - IP whitelist (Safaricom ranges)
  - Timestamp validation (5-min window)
  - BusinessShortCode ownership verification
  - Rate limiting: 100 req/min per IP
  
- **Pesapal IPN** (`POST /api/webhooks/pesapal/ipn`):
  - Signature verification (HMAC-SHA256)
  - Merchant ID validation
  - Rate limiting: 50 req/min

### Authorization (RBAC)
```typescript
// Middleware
const requireLandlordOwnership = async (req, res, next) => {
  const resource = await getResource(req.params.id);
  if (resource.landlordId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// Applied to endpoints
app.get('/api/landlord/payment-channels', requireAuth, requireLandlordOwnership);
app.put('/api/invoices/:id', requireAuth, requireLandlordOwnership);
```

### Rate Limiting
- `/api/webhooks/*`: 100 req/min per IP
- `/api/landlord/*`: 60 req/min per user
- `/api/invoices/*`: 120 req/min per user
- `/api/reconciliation/*`: 30 req/min per user

### CORS Policy
```typescript
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
};
```

### API Versioning
- Current: `/api/v1/*`
- Sunset policy: 6 months notice for breaking changes
- Deprecated endpoints return `X-Deprecated: true` header
```

---

## 19. Feature Flags for Gradual Rollout

### Issue
No feature flags for canary testing and safe rollbacks.

### Solution
```typescript
// Feature flag system
export enum FeatureFlag {
  NEW_INVOICE_SYSTEM = 'new_invoice_system',
  AUTO_RECONCILIATION = 'auto_reconciliation',
  WEBHOOK_RECONCILIATION = 'webhook_reconciliation',
}

interface FeatureFlagConfig {
  enabled: boolean;
  rolloutPercentage: number;
  allowlist?: string[];
  blocklist?: string[];
}

const featureFlags: Record<FeatureFlag, FeatureFlagConfig> = {
  [FeatureFlag.NEW_INVOICE_SYSTEM]: {
    enabled: true,
    rolloutPercentage: 10, // Start with 10%
    allowlist: ['landlord-id-1', 'landlord-id-2'], // Internal testing
  },
  [FeatureFlag.AUTO_RECONCILIATION]: {
    enabled: true,
    rolloutPercentage: 50,
  },
  [FeatureFlag.WEBHOOK_RECONCILIATION]: {
    enabled: true,
    rolloutPercentage: 100, // Full rollout
  },
};

function isFeatureEnabled(flag: FeatureFlag, context: { userId?: string; landlordId?: string }): boolean {
  const config = featureFlags[flag];
  
  if (!config.enabled) return false;
  
  // Check allowlist
  if (config.allowlist?.includes(context.landlordId!)) return true;
  
  // Check blocklist
  if (config.blocklist?.includes(context.landlordId!)) return false;
  
  // Rollout percentage (deterministic hash)
  const hash = crypto.createHash('md5')
    .update(context.landlordId + flag)
    .digest('hex');
  const percentage = parseInt(hash.substring(0, 8), 16) % 100;
  
  return percentage < config.rolloutPercentage;
}

// Usage in invoice generation
async function generateMonthlyInvoices() {
  for (const lease of activeLeases) {
    if (isFeatureEnabled(FeatureFlag.NEW_INVOICE_SYSTEM, { landlordId: lease.landlordId })) {
      await generateInvoicesV2(lease);
    } else {
      await generatePaymentsV1(lease);
    }
  }
}
```

---

## 20. Metrics & Monitoring

### Issue
Success criteria lacks concrete monitoring infrastructure.

### Solution
```typescript
// Metrics table
export const reconciliationMetrics = pgTable("reconciliation_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull(),
  totalEvents: integer("total_events").notNull(),
  autoMatched: integer("auto_matched").notNull(),
  manualMatched: integer("manual_matched").notNull(),
  unmatched: integer("unmatched").notNull(),
  level1Matches: integer("level1_matches").notNull(),
  level2Matches: integer("level2_matches").notNull(),
  level3Matches: integer("level3_matches").notNull(),
  avgConfidenceScore: decimal("avg_confidence_score", { precision: 3, scale: 2 }),
  falsePositives: integer("false_positives").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Daily aggregation job
async function calculateDailyMetrics() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const metrics = await db.select({
    totalEvents: sql<number>`COUNT(*)`,
    autoMatched: sql<number>`COUNT(*) FILTER (WHERE reconciliation_status = 'auto_matched')`,
    manualMatched: sql<number>`COUNT(*) FILTER (WHERE reconciliation_status = 'manually_matched')`,
    unmatched: sql<number>`COUNT(*) FILTER (WHERE reconciliation_status = 'unmatched')`,
    avgConfidence: sql<number>`AVG(confidence_score)`,
  })
  .from(externalPaymentEvents)
  .where(and(
    gte(externalPaymentEvents.createdAt, yesterday),
    lt(externalPaymentEvents.createdAt, new Date())
  ));
  
  const autoMatchRate = metrics[0].autoMatched / metrics[0].totalEvents;
  
  await db.insert(reconciliationMetrics).values({
    date: yesterday,
    ...metrics[0],
  });
  
  // Alert on thresholds
  if (autoMatchRate < 0.7) {
    await alertOps({
      level: 'warning',
      message: `Auto-match rate dropped to ${(autoMatchRate * 100).toFixed(1)}%`,
      context: metrics[0],
    });
  }
}

// Expose metrics endpoint
app.get('/api/admin/metrics/reconciliation', requireAuth, requireAdmin, async (req, res) => {
  const metrics = await db.select()
    .from(reconciliationMetrics)
    .orderBy(desc(reconciliationMetrics.date))
    .limit(30);
  
  res.json(metrics);
});
```

---

## Implementation Priority

### Phase 1 (Critical - Week 2)
1. Configuration management (#1)
2. Atomic duplicate detection (#2)
3. Suspicious payment blocking (#3)
4. Reference code generation (#7)
5. Webhook security (#9)

### Phase 2 (High - Week 3)
6. Level 2 memory optimization (#4)
7. Level 3 tightening (#5)
8. Deterministic locking (#6)
9. Encryption implementation (#10)
10. Enum types (#14)

### Phase 3 (Medium - Week 4)
11. Idempotency (#11)
12. Access control & audit (#12)
13. Pagination (#13)
14. Auto-approval cap (#15)
15. Manual match validation (#16)

### Phase 4 (Compliance - Ongoing)
17. Data privacy (#17)
18. API security documentation (#18)
19. Feature flags (#19)
20. Metrics & monitoring (#20)

---

## Testing Requirements

Each fix must include:
- Unit tests for core logic
- Integration tests for API endpoints
- Load tests for performance-critical paths (#4, #5, #13)
- Security tests for auth/encryption (#9, #10, #12, #18)
- Compliance tests for data retention (#17)

---

## Migration Strategy

1. **Database Changes**: Create migration scripts for schema additions (enums, tables, constraints)
2. **Feature Flags**: Deploy behind flags with gradual rollout
3. **Monitoring**: Add metrics before full rollout
4. **Rollback Plan**: Document revert procedures for each change
5. **Documentation**: Update API docs and deployment guides

---

**Last Updated**: February 4, 2026
**Status**: Ready for implementation
**Owner**: Engineering Team
