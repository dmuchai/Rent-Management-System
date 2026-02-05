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
 */
function verifySourceIP(req: VercelRequest): boolean {
  const clientIP = 
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
    req.headers['x-real-ip']?.toString() ||
    req.socket?.remoteAddress;

  if (!clientIP) {
    return false;
  }

  return SAFARICOM_IPS.includes(clientIP);
}

/**
 * Prevent replay attacks using timestamp validation
 */
function validateTimestamp(transTime: string): boolean {
  try {
    // TransTime format: YYYYMMDDHHmmss (e.g., "20230615143022")
    const year = parseInt(transTime.substring(0, 4));
    const month = parseInt(transTime.substring(4, 6)) - 1;
    const day = parseInt(transTime.substring(6, 8));
    const hour = parseInt(transTime.substring(8, 10));
    const minute = parseInt(transTime.substring(10, 12));
    const second = parseInt(transTime.substring(12, 14));

    const paymentTime = new Date(year, month, day, hour, minute, second);
    const now = new Date();
    const ageInMinutes = (now.getTime() - paymentTime.getTime()) / (1000 * 60);

    // Reject if payment is more than 15 minutes old (replay attack)
    // or in the future (clock skew)
    return ageInMinutes >= 0 && ageInMinutes <= 15;
  } catch (error) {
    return false;
  }
}

/**
 * Check for duplicate transaction
 */
async function isDuplicateTransaction(transId: string): Promise<boolean> {
  const [existing] = await sql`
    SELECT id FROM public.external_payment_events
    WHERE transaction_id = ${transId}
  `;
  return !!existing;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Security Layer 1: IP Whitelist
    if (!verifySourceIP(req)) {
      console.error('[M-Pesa C2B] Unauthorized IP:', req.headers['x-forwarded-for']);
      return res.status(403).json({ error: 'Forbidden' });
    }

    const callback = req.body as MPesaC2BCallback;

    // Security Layer 2: Timestamp validation (prevent replay)
    if (!validateTimestamp(callback.TransTime)) {
      console.error('[M-Pesa C2B] Invalid timestamp:', callback.TransTime);
      return res.status(400).json({ error: 'Invalid timestamp' });
    }

    // Security Layer 3: Duplicate detection
    if (await isDuplicateTransaction(callback.TransID)) {
      console.warn('[M-Pesa C2B] Duplicate transaction:', callback.TransID);
      return res.status(200).json({ 
        ResultCode: 0, 
        ResultDesc: 'Already processed' 
      });
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
      await sql`
        INSERT INTO public.external_payment_events (
          transaction_id,
          source,
          phone_number,
          amount,
          bank_paybill_number,
          bank_account_number,
          timestamp,
          raw_data,
          reconciliation_status
        ) VALUES (
          ${transactionId},
          'mpesa_c2b_bank',
          ${phoneNumber},
          ${amount},
          ${bankPaybillNumber},
          ${bankAccountNumber},
          ${timestamp.toISOString()},
          ${JSON.stringify(callback)},
          'unmatched_channel'
        )
      `;

      console.warn('[M-Pesa C2B] Unknown bank account:', {
        paybill: bankPaybillNumber,
        account: bankAccountNumber,
      });

      // Still return success to Safaricom to prevent retries
      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: 'Payment received (channel not registered)',
      });
    }

    // Store payment event
    const [paymentEvent] = await sql`
      INSERT INTO public.external_payment_events (
        transaction_id,
        source,
        phone_number,
        amount,
        bank_paybill_number,
        bank_account_number,
        timestamp,
        raw_data,
        reconciliation_status,
        landlord_id
      ) VALUES (
        ${transactionId},
        'mpesa_c2b_bank',
        ${phoneNumber},
        ${amount},
        ${bankPaybillNumber},
        ${bankAccountNumber},
        ${timestamp.toISOString()},
        ${JSON.stringify(callback)},
        'pending',
        ${channel.landlord_id}
      )
      RETURNING id
    `;

    // Attempt automatic reconciliation
    const reconciliationResult = await reconcilePayment({
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
    await recordReconciliation(paymentEvent.id, reconciliationResult);

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
