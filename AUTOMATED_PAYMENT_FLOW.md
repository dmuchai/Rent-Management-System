# Automated Payment Flow - Implementation Guide

## Current vs. Ideal Payment Flow

### ❌ Current Flow (Manual)
1. Landlord manually records payment after receiving it offline
2. Risk of human error (wrong tenant, property, amount)
3. No real-time validation
4. Tenant has no proof of payment

### ✅ Ideal Flow (Automated)
1. **Tenant** logs in to tenant portal
2. **Tenant** sees active lease(s) with rent due
3. **Tenant** clicks "Pay Rent" → redirected to Pesapal
4. **Pesapal** processes payment
5. **Pesapal** sends IPN (Instant Payment Notification) webhook to your backend
6. **Backend** verifies payment and auto-creates payment record
7. **Landlord** sees payment appear instantly via Supabase Realtime
8. **Tenant** receives email confirmation

---

## Implementation Steps

### 1. Database Schema (Already Done ✅)

Your `payments` table already has the correct structure:
```sql
payments (
  id UUID PRIMARY KEY,
  lease_id UUID REFERENCES leases(id),  -- Links to tenant, property, unit
  amount NUMERIC,
  status VARCHAR (pending, completed, failed),
  payment_method VARCHAR,
  transaction_id VARCHAR,  -- Pesapal transaction ID
  paid_date TIMESTAMP,
  created_at TIMESTAMP
)
```

### 2. Pesapal Integration (Partially Done ⚠️)

#### A. Tenant Initiates Payment

**Frontend: Tenant Dashboard**
```tsx
// client/src/pages/dashboard/tenant.tsx
const { data: activeLease } = useQuery({
  queryKey: ['/api/leases/my-lease'],
  // Returns tenant's active lease with rent amount
});

const handlePayRent = async () => {
  // Create payment intent
  const response = await apiRequest('POST', '/api/payments/initiate', {
    leaseId: activeLease.id,
    amount: activeLease.monthlyRent,
    description: `${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Rent`
  });
  
  // Redirect to Pesapal
  window.location.href = response.redirectUrl;
};
```

#### B. Backend Payment Initiation

**Backend: /api/payments/initiate.ts**
```typescript
import { requireAuth } from '../_lib/auth';
import { createDbConnection } from '../_lib/db';

export default requireAuth(async (req, res, auth) => {
  const sql = createDbConnection();
  const { leaseId, amount, description } = req.body;
  
  // Verify lease belongs to this tenant
  const lease = await sql`
    SELECT l.*, t.email as tenant_email, t.first_name, t.last_name
    FROM leases l
    JOIN tenants t ON l.tenant_id = t.id
    WHERE l.id = ${leaseId} AND t.user_id = ${auth.userId}
  `;
  
  if (!lease[0]) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  // Create pending payment record
  const payment = await sql`
    INSERT INTO payments (
      lease_id, amount, status, description, payment_method, created_at
    ) VALUES (
      ${leaseId}, ${amount}, 'pending', ${description}, 'pesapal', NOW()
    )
    RETURNING id
  `;
  
  // Initiate Pesapal payment
  const pesapalResponse = await fetch('https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${await getPesapalToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: payment[0].id,  // Your payment ID
      currency: 'KES',
      amount: amount,
      description: description,
      callback_url: `${process.env.API_BASE_URL}/api/payments/callback`,
      notification_id: process.env.PESAPAL_IPN_ID,  // Register this in Pesapal
      billing_address: {
        email_address: lease[0].tenant_email,
        first_name: lease[0].first_name,
        last_name: lease[0].last_name
      }
    })
  });
  
  const pesapalData = await pesapalResponse.json();
  
  // Update payment with Pesapal transaction ID
  await sql`
    UPDATE payments 
    SET transaction_id = ${pesapalData.order_tracking_id}
    WHERE id = ${payment[0].id}
  `;
  
  return res.json({ 
    redirectUrl: pesapalData.redirect_url,
    paymentId: payment[0].id 
  });
});
```

#### C. Pesapal Webhook Handler (CRITICAL 🔥)

**Backend: /api/payments/webhook.ts**
```typescript
import { VercelRequest, VercelResponse } from '@vercel/node';
import { createDbConnection } from '../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const sql = createDbConnection();
  
  try {
    // Pesapal sends IPN with transaction details
    const { OrderTrackingId, OrderMerchantReference } = req.body;
    
    // Get payment status from Pesapal
    const statusResponse = await fetch(
      `https://pay.pesapal.com/v3/api/Transactions/GetTransactionStatus?orderTrackingId=${OrderTrackingId}`,
      {
        headers: {
          'Authorization': `Bearer ${await getPesapalToken()}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const statusData = await statusResponse.json();
    
    // Update payment record based on status
    if (statusData.payment_status_description === 'Completed') {
      await sql`
        UPDATE payments
        SET 
          status = 'completed',
          paid_date = NOW(),
          transaction_id = ${OrderTrackingId}
        WHERE id = ${OrderMerchantReference}
      `;
      
      console.log(`✅ Payment ${OrderMerchantReference} completed automatically`);
      
      // Optional: Send email confirmation to tenant
      // await sendPaymentConfirmationEmail(OrderMerchantReference);
    } else if (statusData.payment_status_description === 'Failed') {
      await sql`
        UPDATE payments
        SET status = 'failed'
        WHERE id = ${OrderMerchantReference}
      `;
    }
    
    // Respond to Pesapal (must be 200 OK)
    return res.status(200).json({ message: 'Webhook processed' });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

// Helper function to get Pesapal OAuth token
async function getPesapalToken(): Promise<string> {
  const response = await fetch('https://pay.pesapal.com/v3/api/Auth/RequestToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      consumer_key: process.env.PESAPAL_CONSUMER_KEY,
      consumer_secret: process.env.PESAPAL_CONSUMER_SECRET
    })
  });
  
  const data = await response.json();
  return data.token;
}
```

### 3. Register IPN URL in Pesapal Dashboard

1. Go to Pesapal Dashboard → Settings → IPN Settings
2. Register your webhook URL:
   ```
   https://property-manager-ke.vercel.app/api/payments/webhook
   ```
3. Save the IPN ID in environment variables:
   ```env
   PESAPAL_IPN_ID=your-ipn-id-here
   ```

### 4. Real-Time Updates (Already Implemented ✅)

Your Supabase Realtime is already set up! When the webhook updates the payment:
```typescript
// Landlord dashboard automatically refetches when payment is inserted/updated
useRealtimeSubscription("payments", ["/api/payments", "/api/dashboard/stats"]);
```

---

## Security Considerations

1. **Webhook Validation:** Verify Pesapal signature (implement HMAC validation)
2. **Idempotency:** Check if payment already processed (prevent double-processing)
3. **Amount Verification:** Verify webhook amount matches your payment record
4. **HTTPS Only:** Webhooks must use HTTPS in production

---

## Testing Workflow

### Pesapal Sandbox
1. Use sandbox credentials for testing
2. Sandbox URL: `https://cybqa.pesapal.com/pesapalv3/`
3. Test webhook with ngrok locally:
   ```bash
   ngrok http 5000
   # Use ngrok URL for webhook during development
   ```

---

## Benefits of Automated Flow

✅ **Zero Human Error:** No manual entry mistakes  
✅ **Instant Updates:** Landlord sees payment immediately  
✅ **Audit Trail:** Complete transaction history  
✅ **Tenant Proof:** Automatic email receipts  
✅ **Scalability:** Handles 100s of payments automatically  
✅ **Reconciliation:** Easy month-end reconciliation  

---

## Next Steps

1. ✅ Refactor payment form to use lease-based selection (DONE)
2. ⚠️ Implement `/api/payments/initiate` endpoint
3. ⚠️ Implement `/api/payments/webhook` endpoint
4. ⚠️ Register IPN URL in Pesapal dashboard
5. ⚠️ Test with Pesapal sandbox
6. ⚠️ Build tenant payment portal UI
7. ✅ Supabase Realtime already working!

---

## File Structure

```
api/
├── payments/
│   ├── index.ts           # List payments (existing)
│   ├── initiate.ts        # NEW: Initiate Pesapal payment
│   ├── webhook.ts         # NEW: Receive Pesapal IPN
│   └── callback.ts        # NEW: Redirect URL after payment
```
