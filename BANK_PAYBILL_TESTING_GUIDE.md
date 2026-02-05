# M-Pesa to Bank Paybill Testing Guide

## Overview

This guide provides comprehensive testing scenarios for the **M-Pesa to Bank Paybill** payment feature, which allows landlords to receive rent payments directly into their bank accounts via M-Pesa without needing a dedicated M-Pesa paybill account.

## Feature Summary

**What It Does:**
- Landlords register their bank's paybill number (e.g., Family Bank 222111) + their account number
- Tenants pay using M-Pesa → Paybill (bank's number) → Account (landlord's account)
- System receives webhook from Safaricom when payment is made
- Heuristic matching engine auto-reconciles payments to invoices

**Benefits:**
- No need for dedicated M-Pesa paybill (~KES 5,000/year savings)
- Funds go directly to bank account
- No M-Pesa withdrawal fees
- Instant bank deposits

---

## Test Environment Setup

### Prerequisites

1. **Database Migration**
   ```bash
   # Apply migration
   psql $DATABASE_URL -f migrations/002_bank_paybill_support.sql
   ```

2. **Environment Variables**
   ```env
   # Add to .env
   MPESA_CONSUMER_KEY=your_consumer_key
   MPESA_CONSUMER_SECRET=your_consumer_secret
   MPESA_SHORTCODE=your_test_shortcode
   MPESA_PASSKEY=your_passkey
   ```

3. **Webhook Configuration**
   ```bash
   # Register C2B callback URL with Safaricom
   # URL: https://your-domain.com/api/webhooks/mpesa/c2b
   ```

---

## Testing Scenarios

### Scenario 1: Landlord Registers Bank Paybill Channel

**Objective:** Test landlord can successfully register a bank paybill payment channel

**Test Steps:**

1. **Navigate to Payment Channels**
   - Login as landlord
   - Go to Dashboard → Settings → Payment Channels

2. **Add New Channel**
   ```
   Channel Type: M-Pesa to Bank Account
   Bank: Family Bank (Paybill: 222111)
   Account Number: 1234567890
   Display Name: Family Bank Account
   Notes: Primary business account
   ```

3. **Expected Results:**
   - ✅ Channel saved successfully
   - ✅ Preview shows: "Paybill: 222111 (Family Bank), Account: 1234567890"
   - ✅ Channel appears in active channels list
   - ✅ Can be set as primary channel

**Test Data:**
```json
{
  "channelType": "mpesa_to_bank",
  "bankPaybillNumber": "222111",
  "bankAccountNumber": "1234567890",
  "displayName": "Family Bank Account",
  "isPrimary": true
}
```

**Validation Checks:**
- [ ] Duplicate bank account detection works
- [ ] Invalid bank paybill number rejected
- [ ] Account number format validated
- [ ] Preview instructions accurate

---

### Scenario 2: Tenant Views Payment Instructions

**Objective:** Verify tenant can see clear payment instructions for bank paybill

**Test Steps:**

1. **Login as Tenant**
   - Navigate to Dashboard → Pay Rent

2. **View Payment Instructions**
   - Should see landlord's active payment channels
   - Bank paybill channel should show:
     * Bank name (e.g., Family Bank)
     * Paybill number (222111)
     * Account number (1234567890)
     * Step-by-step instructions

3. **Expected Results:**
   - ✅ Payment instructions clearly displayed
   - ✅ Copy buttons work for paybill and account
   - ✅ Visual hierarchy (primary channel highlighted)
   - ✅ Instructions show specific amounts

**UI Test:**
```tsx
// Should render
<PaymentInstructions 
  landlordId="landlord-123"
  invoiceReferenceCode="INV-2024-001"
  amount={25000}
/>
```

**Expected Display:**
```
💡 Pay via M-PESA to Bank Account
1. Go to M-PESA menu
2. Select "Lipa na M-PESA"
3. Select "Paybill"
4. Enter Business No: 222111 (Family Bank)
5. Enter Account No: 1234567890
6. Enter amount: KES 25,000
7. Enter M-PESA PIN
```

---

### Scenario 3: C2B Webhook Receives Payment

**Objective:** Test webhook correctly processes M-Pesa payment notification

**Test Steps:**

1. **Simulate M-Pesa Callback**
   ```bash
   # Generate current timestamp in EAT (YYYYMMDDHHmmss format)
   TRANS_TIME=$(TZ='Africa/Nairobi' date +%Y%m%d%H%M%S)
   
   curl -X POST https://your-domain.com/api/webhooks/mpesa/c2b \
     -H "Content-Type: application/json" \
     -H "X-Forwarded-For: 196.201.214.200" \
     -d '{
       "TransactionType": "Pay Bill",
       "TransID": "PGK12H3456",
       "TransTime": "'"$TRANS_TIME"'",
       "TransAmount": "25000",
       "BusinessShortCode": "222111",
       "BillRefNumber": "1234567890",
       "MSISDN": "254712345678",
       "FirstName": "JOHN",
       "LastName": "DOE"
     }'
   ```
   
   **Note:** The webhook validates that `TransTime` is within 15 minutes of current time. The script above generates a current timestamp in EAT timezone (YYYYMMDDHHmmss format) to pass validation.

2. **Expected Results:**
   - ✅ Webhook returns 200 OK
   - ✅ Payment event created in `external_payment_events`
   - ✅ Landlord identified by bank account lookup
   - ✅ Reconciliation triggered automatically

**Database Checks:**
```sql
-- Verify payment event stored
SELECT * FROM external_payment_events
WHERE transaction_id = 'PGK12H3456';

-- Should contain:
-- - transaction_id: PGK12H3456
-- - source: mpesa_c2b_bank
-- - amount: 25000
-- - bank_paybill_number: 222111
-- - bank_account_number: 1234567890
-- - phone_number: 254712345678
-- - reconciliation_status: pending (or matched if auto-reconciled)
```

---

### Scenario 4: Auto-Reconciliation (Single Match)

**Objective:** Test Level 2 heuristic matching succeeds when one invoice matches

**Setup:**
```sql
-- Create landlord with bank channel
INSERT INTO landlord_payment_channels (
  landlord_id, channel_type, bank_paybill_number, 
  bank_account_number, is_active
) VALUES (
  'landlord-123', 'mpesa_to_bank', '222111', 
  '1234567890', true
);

-- Create single pending invoice
INSERT INTO invoices (
  id, tenant_id, amount, due_date, status
) VALUES (
  'INV-001', 'tenant-456', 25000, '2024-02-05', 'pending'
);

-- Link tenant to landlord's property
INSERT INTO tenants (id, property_id) 
VALUES ('tenant-456', 'prop-789');

INSERT INTO properties (id, landlord_id) 
VALUES ('prop-789', 'landlord-123');
```

**Test Steps:**

1. **Send C2B webhook** (as in Scenario 3 with amount=25000)

2. **Expected Results:**
   - ✅ Reconciliation engine finds invoice INV-001
   - ✅ Match confidence: HIGH (only one candidate)
   - ✅ Invoice status updated to 'paid'
   - ✅ `external_payment_events.reconciliation_status` = 'matched'
   - ✅ `external_payment_events.matched_invoice_id` = 'INV-001'
   - ✅ `confidence_score` ≥ 90

**Validation:**
```sql
SELECT 
  epe.transaction_id,
  epe.reconciliation_status,
  epe.matched_invoice_id,
  epe.confidence_score,
  epe.reconciliation_method,
  i.status as invoice_status
FROM external_payment_events epe
LEFT JOIN invoices i ON epe.matched_invoice_id = i.id
WHERE epe.transaction_id = 'PGK12H3456';

-- Expected:
-- reconciliation_status: matched
-- matched_invoice_id: INV-001
-- confidence_score: 90
-- reconciliation_method: heuristic_l2
-- invoice_status: paid
```

---

### Scenario 5: Auto-Reconciliation (Multiple Candidates → Phone Match)

**Objective:** Test Level 3 heuristic with phone number disambiguation

**Setup:**
```sql
-- Create TWO pending invoices with same amount
INSERT INTO invoices (id, tenant_id, amount, due_date, status) VALUES
('INV-001', 'tenant-001', 25000, '2024-02-05', 'pending'),
('INV-002', 'tenant-002', 25000, '2024-02-06', 'pending');

-- Tenant 1 has matching phone
UPDATE tenants SET phone_number = '254712345678' 
WHERE id = 'tenant-001';

-- Tenant 2 has different phone
UPDATE tenants SET phone_number = '254798765432' 
WHERE id = 'tenant-002';
```

**Test Steps:**

1. **Send C2B webhook**
   ```json
   {
     "TransAmount": "25000",
     "MSISDN": "254712345678",
     ...
   }
   ```

2. **Expected Results:**
   - ✅ Reconciliation finds 2 candidates
   - ✅ Phone match boosts INV-001 score (+30 points)
   - ✅ INV-001 selected with confidence: MEDIUM/HIGH
   - ✅ Score ≥ 85 (auto-match threshold)
   - ✅ INV-001 marked as paid

**Scoring Breakdown:**
```
INV-001:
- Base score: 60 (amount + date match)
- Phone match: +30
- Total: 90 → AUTO-MATCH ✅

INV-002:
- Base score: 60
- No phone match: 0
- Total: 60 → NOT SELECTED
```

---

### Scenario 6: Manual Review Required (Ambiguous Match)

**Objective:** Test payments requiring manual review are flagged correctly

**Setup:**
```sql
-- Create TWO invoices with same amount, close due dates, NO phone numbers
INSERT INTO invoices (id, tenant_id, amount, due_date, status) VALUES
('INV-001', 'tenant-001', 25000, '2024-02-05', 'pending'),
('INV-002', 'tenant-002', 25000, '2024-02-05', 'pending');

-- No phone numbers
UPDATE tenants SET phone_number = NULL;
```

**Test Steps:**

1. **Send C2B webhook** (amount=25000, no phone match possible)

2. **Expected Results:**
   - ✅ Reconciliation finds 2 candidates
   - ✅ Cannot disambiguate (scores tied)
   - ✅ `reconciliation_status` = 'pending_review'
   - ✅ `reconciliation_method` = 'manual_review'
   - ✅ `confidence_score` < 85
   - ✅ Landlord notified (future: email/SMS alert)

**Manual Review UI:**
- Payment appears in "Pending Reconciliation" list
- Landlord can see:
  * Transaction details (amount, phone, time)
  * Candidate invoices (2 options)
  * Manual match button

---

### Scenario 7: Security - IP Whitelist

**Objective:** Verify webhook rejects unauthorized IPs

**Test Steps:**

1. **Send webhook from unknown IP**
   ```bash
   curl -X POST https://your-domain.com/api/webhooks/mpesa/c2b \
     -H "X-Forwarded-For: 1.2.3.4" \
     -d '{"TransID": "TEST123"}'
   ```

2. **Expected Results:**
   - ✅ Returns 403 Forbidden
   - ✅ No database entry created
   - ✅ Error logged: "Unauthorized IP: 1.2.3.4"

**Safaricom IPs (whitelist):**
```
196.201.214.200
196.201.214.206
196.201.213.114
... (see webhook handler for full list)
```

---

### Scenario 8: Security - Replay Attack Prevention

**Objective:** Test duplicate transaction detection

**Test Steps:**

1. **Send webhook first time**
   ```json
   {"TransID": "PGK12H3456", "TransTime": "20240205143022", ...}
   ```
   - Result: 200 OK, payment processed

2. **Send SAME transaction again** (replay attack)
   ```json
   {"TransID": "PGK12H3456", "TransTime": "20240205143022", ...}
   ```

3. **Expected Results:**
   - ✅ Returns 200 OK (to prevent Safaricom retries)
   - ✅ Response: `{"ResultDesc": "Already processed"}`
   - ✅ No duplicate database entry
   - ✅ Original payment unchanged

**Database Check:**
```sql
SELECT COUNT(*) FROM external_payment_events
WHERE transaction_id = 'PGK12H3456';
-- Expected: 1 (not 2)
```

---

### Scenario 9: Edge Case - Unregistered Bank Account

**Objective:** Test graceful handling of payments to unknown accounts

**Test Steps:**

1. **Send webhook with unregistered account**
   ```json
   {
     "BusinessShortCode": "222111",
     "BillRefNumber": "9999999999",  // Not in database
     ...
   }
   ```

2. **Expected Results:**
   - ✅ Payment event stored
   - ✅ `reconciliation_status` = 'unmatched_channel'
   - ✅ Webhook returns 200 OK
   - ✅ Admin notification (future)
   - ✅ No invoice matched

**Use Case:**
- Tenant pays to wrong account
- Payment visible in admin panel for investigation

---

### Scenario 10: Performance - Concurrent Webhooks

**Objective:** Test system handles multiple simultaneous payments

**Load Test:**
```bash
# Send 10 concurrent webhooks
for i in {1..10}; do
  curl -X POST https://your-domain.com/api/webhooks/mpesa/c2b \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: 196.201.214.200" \
    -d "{
      \"TransID\": \"TEST$i\",
      \"TransAmount\": \"25000\",
      \"BusinessShortCode\": \"222111\",
      \"BillRefNumber\": \"1234567890\",
      \"TransTime\": \"$(date +%Y%m%d%H%M%S)\"
    }" &
done
wait
```

**Expected Results:**
- ✅ All 10 webhooks return 200 OK
- ✅ All 10 payment events stored
- ✅ No race conditions
- ✅ No duplicate reconciliations
- ✅ Response time < 2 seconds each

---

## Manual Testing Checklist

### Landlord Workflows

- [ ] Register bank paybill channel
- [ ] Edit bank paybill channel
- [ ] Set bank channel as primary
- [ ] Deactivate bank channel
- [ ] View reconciliation dashboard
- [ ] Manually match ambiguous payment
- [ ] View payment history (filtered by bank channel)

### Tenant Workflows

- [ ] View payment instructions (bank paybill)
- [ ] Copy paybill number
- [ ] Copy account number
- [ ] See visual step-by-step guide
- [ ] Multiple payment options displayed correctly
- [ ] Responsive design (mobile view)

### Admin/Reconciliation

- [ ] View all unmatched payments
- [ ] View reconciliation confidence scores
- [ ] Filter by reconciliation status
- [ ] Export reconciliation report
- [ ] Manual override/match

---

## Automated Test Suite

### Unit Tests

```typescript
// tests/reconciliationEngine.test.ts

describe('Reconciliation Engine', () => {
  it('matches by reference code (Level 1)', async () => {
    const result = await reconcilePayment({
      referenceCode: 'INV2024001',
      amount: 25000,
      ...
    });
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe('exact');
  });

  it('matches by bank account + amount (Level 2)', async () => {
    // Setup: 1 invoice, matching amount
    const result = await reconcilePayment({
      bankAccountNumber: '1234567890',
      amount: 25000,
      ...
    });
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe('high');
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it('requires manual review for ambiguous matches', async () => {
    // Setup: 2 invoices, same amount, no phone
    const result = await reconcilePayment({
      bankAccountNumber: '1234567890',
      amount: 25000,
      ...
    });
    expect(result.matched).toBe(false);
    expect(result.method).toBe('manual_review');
  });
});
```

### Integration Tests

```typescript
// tests/webhooks/mpesa-c2b.test.ts

describe('M-Pesa C2B Webhook', () => {
  it('rejects unauthorized IP', async () => {
    const response = await request(app)
      .post('/api/webhooks/mpesa/c2b')
      .set('X-Forwarded-For', '1.2.3.4')
      .send({...});
    expect(response.status).toBe(403);
  });

  it('prevents replay attacks', async () => {
    const payload = { TransID: 'DUP123', ... };
    
    // First request
    await request(app).post('/api/webhooks/mpesa/c2b').send(payload);
    
    // Duplicate request
    const response = await request(app).post('/api/webhooks/mpesa/c2b').send(payload);
    expect(response.body.ResultDesc).toContain('Already processed');
  });
});
```

---

## Monitoring & Alerts

### Key Metrics

1. **Auto-Match Rate**
   ```sql
   SELECT 
     COUNT(CASE WHEN reconciliation_status = 'matched' THEN 1 END) * 100.0 / COUNT(*) as match_rate
   FROM external_payment_events
   WHERE source = 'mpesa_c2b_bank'
     AND created_at >= NOW() - INTERVAL '30 days';
   ```

2. **Confidence Distribution**
   ```sql
   SELECT 
     CASE 
       WHEN confidence_score >= 95 THEN 'Very High'
       WHEN confidence_score >= 85 THEN 'High'
       WHEN confidence_score >= 70 THEN 'Medium'
       ELSE 'Low'
     END as confidence_level,
     COUNT(*)
   FROM external_payment_events
   WHERE source = 'mpesa_c2b_bank'
   GROUP BY confidence_level;
   ```

3. **Average Reconciliation Time**
   ```sql
   SELECT AVG(EXTRACT(EPOCH FROM (reconciled_at - created_at))) as avg_seconds
   FROM external_payment_events
   WHERE reconciliation_status = 'matched'
     AND source = 'mpesa_c2b_bank';
   ```

### Alerts

- **High unmatched rate** (>20% pending review in last 24h)
- **Webhook errors** (>5% return non-200)
- **Unknown bank accounts** (new unregistered accounts)
- **Slow reconciliation** (avg time >30 seconds)

---

## Production Deployment Checklist

- [ ] Migration 002 applied to production DB
- [ ] Webhook URL registered with Safaricom
- [ ] Safaricom IP whitelist configured
- [ ] Environment variables set (MPESA keys)
- [ ] Monitoring dashboards created
- [ ] Alert rules configured
- [ ] Documentation updated
- [ ] Support team trained
- [ ] Rollback plan prepared
- [ ] A/B testing plan (if gradual rollout)

---

## Troubleshooting Guide

### Issue: Payments not auto-matching

**Diagnosis:**
```sql
SELECT 
  reconciliation_status, 
  reconciliation_notes 
FROM external_payment_events 
WHERE id = 'payment-id';
```

**Common Causes:**
1. No invoices match amount + date window → **Widen date window in config**
2. Multiple candidates, no phone match → **Request tenants update phone numbers**
3. Tenant phone format mismatch → **Normalize phone numbers**

### Issue: Webhook returning 403

**Diagnosis:** Check request IP
```
curl -v https://your-domain.com/api/webhooks/mpesa/c2b
```

**Fix:** Update IP whitelist if Safaricom added new IPs

### Issue: Duplicate payments

**Diagnosis:**
```sql
SELECT transaction_id, COUNT(*) 
FROM external_payment_events 
GROUP BY transaction_id 
HAVING COUNT(*) > 1;
```

**Fix:** Investigate duplicate detection logic, check timestamp validation

---

## Success Criteria

- ✅ **Auto-match rate ≥ 80%** (Level 2/3 heuristics)
- ✅ **Zero false positives** (wrong invoice matched)
- ✅ **99.9% webhook uptime**
- ✅ **< 5 second reconciliation time**
- ✅ **Zero security incidents** (IP bypass, replay attacks)
- ✅ **Manual review queue < 50 items** (daily)

---

## Next Steps

1. **Week 2 Features:**
   - Manual reconciliation UI for landlords
   - Bulk payment import (CSV)
   - Payment history export

2. **Week 3 Enhancements:**
   - SMS notifications on payment (Twilio/Africa's Talking)
   - Email receipts with PDF
   - Tenant payment reminders

3. **Future Optimizations:**
   - Machine learning match scoring (payment patterns)
   - Multi-currency support
   - Bank statement auto-import

---

**Test Owner:** QA Team  
**Last Updated:** 2024-02-05  
**Version:** 1.0
