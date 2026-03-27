export type BankProvider = 'kcb' | 'equity' | 'coop';

export interface NormalizedBankPayment {
  provider: BankProvider;
  transactionId: string;
  amount: number;
  currency: string;
  transactionTime: Date;
  payerPhone?: string;
  payerName?: string;
  payerAccountRef?: string;
  destinationAccount?: string;
  destinationPaybill?: string;
  referenceCode?: string;
  rawPayload: unknown;
}

export interface BankWebhookAdapter {
  provider: BankProvider;
  normalize: (payload: unknown) => NormalizedBankPayment;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
}

function parseAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    throw new Error('Invalid amount');
  }

  const cleaned = value.replace(/,/g, '').trim();
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Invalid amount');
  }

  return parsed;
}

function parseTimestamp(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value !== 'string') {
    throw new Error('Invalid transaction time');
  }

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  // Supports compact format: YYYYMMDDHHmmss
  const compact = value.trim();
  if (/^\d{14}$/.test(compact)) {
    const year = Number(compact.slice(0, 4));
    const month = Number(compact.slice(4, 6)) - 1;
    const day = Number(compact.slice(6, 8));
    const hour = Number(compact.slice(8, 10));
    const minute = Number(compact.slice(10, 12));
    const second = Number(compact.slice(12, 14));
    const parsed = new Date(Date.UTC(year, month, day, hour, minute, second));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  throw new Error('Invalid transaction time');
}

function normalizePhone(phone: string | undefined): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return undefined;

  if (digits.startsWith('254') && digits.length === 12) {
    return `+${digits}`;
  }

  if (digits.startsWith('0') && digits.length === 10) {
    return `+254${digits.slice(1)}`;
  }

  return phone;
}

export const kcbAdapter: BankWebhookAdapter = {
  provider: 'kcb',
  normalize: (payload: unknown): NormalizedBankPayment => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid payload');
    }

    const body = payload as Record<string, unknown>;

    const transactionId = pickString(body, [
      'transaction_id',
      'transactionId',
      'reference',
      'trans_id',
      'transId',
      'id',
    ]);

    if (!transactionId) {
      throw new Error('Missing transaction id');
    }

    const amountValue = body.amount ?? body.transaction_amount ?? body.transAmount ?? body.credit;
    const amount = parseAmount(amountValue);

    const timestampValue =
      body.transaction_time ?? body.transactionTime ?? body.transTime ?? body.value_date ?? body.created_at;
    const transactionTime = parseTimestamp(timestampValue);

    const currency = pickString(body, ['currency', 'transaction_currency']) || 'KES';

    const destinationAccount = pickString(body, [
      'destination_account',
      'destinationAccount',
      'account_number',
      'accountNumber',
      'beneficiary_account',
      'bank_account_number',
    ]);

    const destinationPaybill = pickString(body, [
      'paybill_number',
      'paybillNumber',
      'business_short_code',
      'businessShortCode',
    ]);

    const payerPhone = normalizePhone(
      pickString(body, ['payer_phone', 'payerPhone', 'phone', 'msisdn'])
    );

    const payerName = pickString(body, ['payer_name', 'payerName', 'customer_name', 'customerName']);
    const payerAccountRef = pickString(body, ['payer_account_ref', 'payerAccountRef', 'account_ref', 'accountRef']);
    const referenceCode = pickString(body, ['reference_code', 'referenceCode', 'invoice_reference', 'invoiceReference']);

    return {
      provider: 'kcb',
      transactionId,
      amount,
      currency,
      transactionTime,
      payerPhone,
      payerName,
      payerAccountRef,
      destinationAccount,
      destinationPaybill,
      referenceCode,
      rawPayload: payload,
    };
  },
};

export const equityAdapter: BankWebhookAdapter = {
  provider: 'equity',
  normalize: (payload: unknown): NormalizedBankPayment => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid payload');
    }

    const body = payload as Record<string, unknown>;

    const transactionId = pickString(body, [
      'transaction_id',
      'transactionId',
      'reference',
      'txn_ref',
      'txnRef',
      'trans_id',
      'id',
    ]);

    if (!transactionId) {
      throw new Error('Missing transaction id');
    }

    const amountValue =
      body.amount ?? body.transaction_amount ?? body.credit_amount ?? body.transAmount ?? body.credit;
    const amount = parseAmount(amountValue);

    const timestampValue =
      body.transaction_time ??
      body.transactionTime ??
      body.transTime ??
      body.value_date ??
      body.posted_at ??
      body.created_at;
    const transactionTime = parseTimestamp(timestampValue);

    const currency = pickString(body, ['currency', 'transaction_currency']) || 'KES';

    const destinationAccount = pickString(body, [
      'destination_account',
      'destinationAccount',
      'account_number',
      'accountNumber',
      'beneficiary_account',
      'bank_account_number',
    ]);

    const destinationPaybill = pickString(body, [
      'paybill_number',
      'paybillNumber',
      'business_short_code',
      'businessShortCode',
    ]);

    const payerPhone = normalizePhone(
      pickString(body, ['payer_phone', 'payerPhone', 'phone', 'msisdn', 'customer_phone'])
    );

    const payerName = pickString(body, [
      'payer_name',
      'payerName',
      'customer_name',
      'customerName',
      'sender_name',
    ]);
    const payerAccountRef = pickString(body, [
      'payer_account_ref',
      'payerAccountRef',
      'account_ref',
      'accountRef',
      'narration',
    ]);
    const referenceCode = pickString(body, ['reference_code', 'referenceCode', 'invoice_reference', 'invoiceReference']);

    return {
      provider: 'equity',
      transactionId,
      amount,
      currency,
      transactionTime,
      payerPhone,
      payerName,
      payerAccountRef,
      destinationAccount,
      destinationPaybill,
      referenceCode,
      rawPayload: payload,
    };
  },
};

export const coopAdapter: BankWebhookAdapter = {
  provider: 'coop',
  normalize: (payload: unknown): NormalizedBankPayment => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid payload');
    }

    const body = payload as Record<string, unknown>;

    const transactionId = pickString(body, [
      'transaction_id',
      'transactionId',
      'reference',
      'trans_id',
      'transId',
      'bank_ref',
      'bankRef',
      'id',
    ]);

    if (!transactionId) {
      throw new Error('Missing transaction id');
    }

    const amountValue = body.amount ?? body.transaction_amount ?? body.credit ?? body.transAmount;
    const amount = parseAmount(amountValue);

    const timestampValue =
      body.transaction_time ?? body.transactionTime ?? body.transTime ?? body.value_date ?? body.created_at;
    const transactionTime = parseTimestamp(timestampValue);

    const currency = pickString(body, ['currency', 'transaction_currency']) || 'KES';

    const destinationAccount = pickString(body, [
      'destination_account',
      'destinationAccount',
      'account_number',
      'accountNumber',
      'beneficiary_account',
      'bank_account_number',
      'receiving_account',
    ]);

    const destinationPaybill = pickString(body, [
      'paybill_number',
      'paybillNumber',
      'business_short_code',
      'businessShortCode',
      'shortcode',
    ]);

    const payerPhone = normalizePhone(
      pickString(body, ['payer_phone', 'payerPhone', 'phone', 'msisdn', 'customer_phone'])
    );

    const payerName = pickString(body, ['payer_name', 'payerName', 'customer_name', 'customerName', 'sender_name']);
    const payerAccountRef = pickString(body, ['payer_account_ref', 'payerAccountRef', 'account_ref', 'accountRef', 'narration']);
    const referenceCode = pickString(body, ['reference_code', 'referenceCode', 'invoice_reference', 'invoiceReference']);

    return {
      provider: 'coop',
      transactionId,
      amount,
      currency,
      transactionTime,
      payerPhone,
      payerName,
      payerAccountRef,
      destinationAccount,
      destinationPaybill,
      referenceCode,
      rawPayload: payload,
    };
  },
};

export const bankWebhookAdapters: Record<string, BankWebhookAdapter> = {
  kcb: kcbAdapter,
  equity: equityAdapter,
  coop: coopAdapter,
};
