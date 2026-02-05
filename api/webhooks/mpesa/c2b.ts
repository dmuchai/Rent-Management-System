import { VercelRequest, VercelResponse } from '@vercel/node';
import { createDbConnection } from '../../_lib/db';
import { reconcilePayment, recordReconciliation } from '../../_lib/reconciliationEngine';

const sql = createDbConnection();

/**
 * M-Pesa C2B Callback Handler for Bank Paybill Payments
 * 
 * Webhook endpoint that receives payment notifications from Safaricom
 * when customers pay to a bank's paybill using a landlord's account number.
 * 
 * Flow:
 * 1. Tenant pays: Paybill 222111 (Family Bank), Account 1234567890 (Landlord's account)
 * 2. Safaricom sends C2B notification to this webhook
 * 3. Extract bank paybill + account number from callback
 * 4. Lookup landlord by bank account
 * 5. Route to reconciliation engine for heuristic matching
 * 6. Auto-match or flag for manual review
 */

// Safaricom IP whitelist (production IPs - update based on Safaricom documentation)
const SAFARICOM_IPS = [
  '196.201.214.200',
  '196.201.214.206',
  '196.201.213.114',
  '196.201.214.207',
  '196.201.214.208',
  '196.201.213.44',
  '196.201.212.127',
  '196.201.212.128',
  '196.201.212.129',
  '196.201.212.136',
  '196.201.212.74',
  '196.201.212.69',
];

interface MPesaC2BCallback {
  TransactionType: string;
  TransID: string;
  TransTime: string;
  TransAmount: string;
  BusinessShortCode: string;
  BillRefNumber: string;
  InvoiceNumber?: string;
  OrgAccountBalance?: string;
  ThirdPartyTransID?: string;
  MSISDN: string;
  FirstName?: string;
  MiddleName?: string;
  LastName?: string;
}

/**
 * Verify request comes from Safaricom
 * Only trusts x-forwarded-for when running on Vercel to prevent IP spoofing
 */
function verifySourceIP(req: VercelRequest): boolean {
  let clientIP: string | undefined;

  // Only trust proxy headers when running on Vercel
  // Otherwise, attackers could spoof x-forwarded-for/x-real-ip headers
  if (process.env.VERCEL === '1' || process.env.VERCEL === 'true') {
    // On Vercel, trust the first IP in x-forwarded-for (original client)
    // Format: "client, proxy1, proxy2" - we want "client"
    const forwardedFor = req.headers['x-forwarded-for']?.toString();
    if (forwardedFor) {
      clientIP = forwardedFor.split(',')[0].trim();
    } else {
      // Fallback to x-real-ip on Vercel
      clientIP = req.headers['x-real-ip']?.toString()?.trim();
    }
  } else {
    // Not on Vercel - use socket remoteAddress directly (no proxy)
    clientIP = req.socket?.remoteAddress;
  }

  if (!clientIP) {
    return false;
  }

  return SAFARICOM_IPS.includes(clientIP);
}

/**
 * Prevent replay attacks using timestamp validation
 * M-Pesa TransTime is in EAT (East Africa Time, UTC+3)
 */
function validateTimestamp(transTime: string): boolean {
  try {
    // TransTime format: YYYYMMDDHHmmss (e.g., "20230615143022")
    // This is in EAT (East Africa Time = UTC+3)
    const year = parseInt(transTime.substring(0, 4));
    const month = parseInt(transTime.substring(4, 6)) - 1;
    const day = parseInt(transTime.substring(6, 8));
    const hour = parseInt(transTime.substring(8, 10));
    const minute = parseInt(transTime.substring(10, 12));
    const second = parseInt(transTime.substring(12, 14));

    // Convert EAT to UTC by subtracting 3 hours
    // Create UTC timestamp then subtract 3 hours (EAT = UTC+3)
    const paymentTimeUtc = new Date(Date.UTC(year, month, day, hour - 3, minute, second));
    const nowUtc = Date.now(); // Already in UTC (milliseconds since epoch)
    const ageInMinutes = (nowUtc - paymentTimeUtc.getTime()) / (1000 * 60);

    // Reject if payment is more than 15 minutes old (replay attack)
    // or in the future (clock skew)
    return ageInMinutes >= 0 && ageInMinutes <= 15;
  } catch (error) {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Security Layer 1: IP Whitelist
    if (!verifySourceIP(req)) {
    const callback = req.body as MPesaC2BCallback;

    // Basic validation
    if (!callback.TransID || !callback.TransTime || !callback.TransAmount || 
        !callback.BusinessShortCode || !callback.BillRefNumber || !callback.MSISDN) {
      console.error('[M-Pesa C2B] Missing required fields:', callback);
      return res.status(400).json({ error: 'Missing required fields' });
    }
      return res.status(403).json({ error: 'Forbidden' });
    }

    const callback = req.body as MPesaC2BCallback;

    // Security Layer 2: Timestamp validation (prevent replay)
    if (!validateTimestamp(callback.TransTime)) {
      console.error('[M-Pesa C2B] Invalid timestamp:', callback.TransTime);
      return res.status(400).json({ error: 'Invalid timestamp' });
    }

    // Parse payment details
    const phoneNumber = callback.MSISDN;
    const amount = parseFloat(callback.TransAmount);
    const bankPaybillNumber = callback.BusinessShortCode;
    const bankAccountNumber = callback.BillRefNumber;
    const transactionId = callback.TransID;

    // Parse timestamp
    const year = parseInt(callback.TransTime.substring(0, 4));
    const month = parseInt(callback.TransTime.substring(4, 6)) - 1;
    const day = parseInt(callback.TransTime.substring(6, 8));
    const hour = parseInt(callback.TransTime.substring(8, 10));
    const minute = parseInt(callback.TransTime.substring(10, 12));
    const second = parseInt(callback.TransTime.substring(12, 14));
    const timestamp = new Date(year, month, day, hour, minute, second);

    // Lookup landlord payment channel
    const [channel] = await sql`
      SELECT landlord_id, bank_name, display_name
      FROM public.landlord_payment_channels
      WHERE bank_paybill_number = ${bankPaybillNumber}
        AND bank_account_number = ${bankAccountNumber}
        AND channel_type = 'mpesa_to_bank'
        AND is_active = true
    `;

    if (!channel) {
      // Bank account not registered - store as unmatched
      // Use ON CONFLICT to make this idempotent (handle duplicate webhooks)
      const result = await sql`
        INSERT INTO public.external_payment_events (
          event_type,
          provider,
          external_transaction_id,
          amount,
          payer_phone,
          payer_account_ref,
          transaction_time,
          raw_payload,
          reconciliation_status
        ) VALUES (
          'mpesa_c2b',
          'safaricom',
          ${transactionId},
          ${amount},
          ${phoneNumber},
          ${bankAccountNumber},
          ${timestamp.toISOString()},
          ${JSON.stringify(callback)},
          'unmatched'
        )
        ON CONFLICT ON CONSTRAINT uq_external_payment_events_provider_txn DO NOTHING
      `;

      // Check if insert succeeded (new transaction) or was duplicate
      if (result.count === 0) {
        console.warn('[M-Pesa C2B] Duplicate transaction (unmatched):', transactionId);
      } else {
        console.warn('[M-Pesa C2B] Unknown bank account:', {
          paybill: bankPaybillNumber,
          account: bankAccountNumber,
        });
      }

      // Always return success to Safaricom to prevent retries
      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: result.count === 0 ? 'Already processed' : 'Payment received (channel not registered)',
      });
    }

    // Store payment event (idempotent insert with ON CONFLICT)
    const result = await sql`
      INSERT INTO public.external_payment_events (
        event_type,
        provider,
        landlord_id,
        payment_channel_id,
        external_transaction_id,
        amount,
        payer_phone,
        payer_account_ref,
        transaction_time,
        raw_payload,
        reconciliation_status
      ) VALUES (
        'mpesa_c2b',
        'safaricom',
        ${channel.landlord_id},
        NULL,
        ${transactionId},
        ${amount},
        ${phoneNumber},
        ${bankAccountNumber},
        ${timestamp.toISOString()},
        ${JSON.stringify(callback)},
        'unmatched'
      )
      ON CONFLICT ON CONSTRAINT uq_external_payment_events_provider_txn DO NOTHING
      RETURNING id
    `;

    // Check if this is a duplicate transaction
    if (result.count === 0) {
      console.warn('[M-Pesa C2B] Duplicate transaction:', transactionId);
      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: 'Already processed',
      });
    }

    const [paymentEvent] = result;

    // Attempt automatic reconciliation
    const reconciliationResult = await reconcilePayment(sql, {
      id: paymentEvent.id,
      transactionId,
      phoneNumber,
      amount,
      timestamp,
      bankPaybillNumber,
      bankAccountNumber,
      rawData: callback,
    });

    // Record reconciliation result
    await recordReconciliation(sql, paymentEvent.id, reconciliationResult);

    // Log outcome
    if (reconciliationResult.matched) {
      console.log('[M-Pesa C2B] Auto-matched:', {
        transactionId,
        invoiceId: reconciliationResult.invoiceId,
        confidence: reconciliationResult.confidence,
        method: reconciliationResult.method,
      });
    } else {
      console.warn('[M-Pesa C2B] Manual review required:', {
        transactionId,
        reasons: reconciliationResult.reasons,
      });
    }

    // Return success to Safaricom
    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: 'Payment processed successfully',
    });
  } catch (error) {
    console.error('[M-Pesa C2B] Error:', error);
    
    // Return success to Safaricom to prevent retries
    // Log error for manual investigation
    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: 'Payment received (processing error)',
    });
  }
}
