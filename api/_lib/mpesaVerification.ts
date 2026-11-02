import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { StkQueryResponse } from './mpesaService.js';

const callbackItemSchema = z.object({ Name: z.string(), Value: z.unknown().optional() });
const callbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string().min(1),
      CheckoutRequestID: z.string().min(1),
      ResultCode: z.coerce.number().int(),
      ResultDesc: z.string(),
      CallbackMetadata: z.object({ Item: z.array(callbackItemSchema) }).optional(),
    }),
  }),
});

export type ParsedStkCallback = ReturnType<typeof parseStkCallback>;

export function parseStkCallback(body: unknown) {
  const callback = callbackSchema.parse(body).Body.stkCallback;
  const metadata = new Map(callback.CallbackMetadata?.Item.map((item) => [item.Name, item.Value]) || []);
  const amount = metadata.has('Amount') ? Number(metadata.get('Amount')) : null;
  const receipt = metadata.has('MpesaReceiptNumber') ? String(metadata.get('MpesaReceiptNumber') || '').trim() : null;
  return {
    checkoutRequestId: callback.CheckoutRequestID,
    merchantRequestId: callback.MerchantRequestID,
    resultCode: callback.ResultCode,
    resultDesc: callback.ResultDesc,
    amount: Number.isFinite(amount) ? amount : null,
    receipt: receipt || null,
    fingerprint: createHash('sha256').update(JSON.stringify(callback)).digest('hex'),
  };
}

export type ExpectedStkPayment = {
  amount: number;
  checkoutRequestId: string;
  merchantRequestId?: string | null;
  merchantId: string;
};

export function receiptConflicts(existing: string | null | undefined, incoming: string | null | undefined) {
  return Boolean(existing && incoming && existing !== incoming);
}

export function verifyStkResult(
  callback: ParsedStkCallback,
  query: StkQueryResponse,
  expected: ExpectedStkPayment,
): { verified: boolean; successful: boolean; reason?: string } {
  if (callback.checkoutRequestId !== expected.checkoutRequestId
      || query.CheckoutRequestID !== expected.checkoutRequestId) {
    return { verified: false, successful: false, reason: 'Checkout request identifier mismatch' };
  }
  if (expected.merchantRequestId
      && (callback.merchantRequestId !== expected.merchantRequestId
        || query.MerchantRequestID !== expected.merchantRequestId)) {
    return { verified: false, successful: false, reason: 'Merchant request identifier mismatch' };
  }
  const queryCode = Number(query.ResultCode);
  if (!Number.isInteger(queryCode) || queryCode !== callback.resultCode) {
    return { verified: false, successful: false, reason: 'Provider status conflicts with callback result' };
  }
  if (callback.resultCode !== 0) return { verified: true, successful: false };
  if (callback.amount === null || Math.abs(callback.amount - expected.amount) > 0.005) {
    return { verified: false, successful: false, reason: 'Callback amount does not match the payment attempt' };
  }
  if (!callback.receipt || !/^[A-Z0-9]{8,20}$/i.test(callback.receipt)) {
    return { verified: false, successful: false, reason: 'A valid M-PESA receipt identifier is required' };
  }
  if (!expected.merchantId) {
    return { verified: false, successful: false, reason: 'Expected merchant identity is unavailable' };
  }
  return { verified: true, successful: true };
}
