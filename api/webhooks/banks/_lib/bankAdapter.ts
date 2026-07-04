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

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (!acc || typeof acc !== 'object') {
      return undefined;
    }
    return (acc as Record<string, unknown>)[segment];
  }, obj);
}

function pickStringByPaths(obj: Record<string, unknown>, paths: string[]): string | undefined {
  for (const path of paths) {
    const value = getByPath(obj, path);
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

    const transactionId = pickStringByPaths(body, [
      'transaction_id',
      'transactionId',
      'reference',
      'trans_id',
      'transId',
      'transactionReference',
      'transactionID',
      'requestId',
      'requestPayload.primaryData.transactionId',
      'requestPayload.primaryData.transactionID',
      'requestPayload.primaryData.transactionReference',
      'requestPayload.primaryData.requestId',
      'requestPayload.additionalData.transactionId',
      'requestPayload.additionalData.transactionID',
      'requestPayload.additionalData.transactionReference',
      'responsePayload.transactionInfo.transactionId',
      'responsePayload.transactionInfo.transactionID',
      'id',
    ]);

    if (!transactionId) {
      throw new Error('Missing transaction id');
    }

    const amountValue =
      body.amount ??
      body.transaction_amount ??
      body.transAmount ??
      body.credit ??
      getByPath(body, 'transactionAmount') ??
      getByPath(body, 'requestPayload.primaryData.transactionAmount') ??
      getByPath(body, 'requestPayload.primaryData.amount') ??
      getByPath(body, 'requestPayload.additionalData.amount') ??
      getByPath(body, 'requestPayload.additionalData.transactionAmount') ??
      getByPath(body, 'responsePayload.transactionInfo.amount');
    const amount = parseAmount(amountValue);

    const timestampValue =
      body.transaction_time ??
      body.transactionTime ??
      body.transTime ??
      body.value_date ??
      body.created_at ??
      getByPath(body, 'timestamp') ??
      getByPath(body, 'timeStamp') ??
      getByPath(body, 'header.timeStamp') ??
      getByPath(body, 'header.timestamp') ??
      getByPath(body, 'requestPayload.primaryData.timestamp') ??
      getByPath(body, 'requestPayload.primaryData.timeStamp') ??
      getByPath(body, 'requestPayload.additionalData.timestamp') ??
      getByPath(body, 'requestPayload.additionalData.timeStamp');
    const transactionTime = parseTimestamp(timestampValue);

    const currency =
      pickStringByPaths(body, [
        'currency',
        'transaction_currency',
        'requestPayload.primaryData.currency',
        'requestPayload.additionalData.currency',
      ]) || 'KES';

    const destinationAccount = pickStringByPaths(body, [
      'destination_account',
      'destinationAccount',
      'account_number',
      'accountNumber',
      'beneficiary_account',
      'bank_account_number',
      'accountNo',
      'creditAccountIdentifier',
      'requestPayload.primaryData.accountNumber',
      'requestPayload.primaryData.accountNo',
      'requestPayload.primaryData.destinationAccount',
      'requestPayload.primaryData.creditAccountIdentifier',
      'requestPayload.additionalData.accountNumber',
      'requestPayload.additionalData.accountNo',
      'requestPayload.additionalData.creditAccountIdentifier',
    ]);

    const destinationPaybill = pickStringByPaths(body, [
      'paybill_number',
      'paybillNumber',
      'business_short_code',
      'businessShortCode',
      'businessNo',
      'organizationShortCode',
      'requestPayload.primaryData.paybillNumber',
      'requestPayload.primaryData.businessNo',
      'requestPayload.primaryData.organizationShortCode',
      'requestPayload.additionalData.paybillNumber',
      'requestPayload.additionalData.businessNo',
      'requestPayload.additionalData.organizationShortCode',
      'requestPayload.primaryData.tillNumber',
      'requestPayload.additionalData.tillNumber',
    ]);

    const payerPhone = normalizePhone(
      pickStringByPaths(body, [
        'payer_phone',
        'payerPhone',
        'phone',
        'msisdn',
        'customerMobileNumber',
        'requestPayload.primaryData.phoneNumber',
        'requestPayload.primaryData.msisdn',
        'requestPayload.primaryData.customerMobileNumber',
        'requestPayload.additionalData.phoneNumber',
        'requestPayload.additionalData.msisdn',
        'requestPayload.additionalData.customerMobileNumber',
      ])
    );

    const payerName = pickStringByPaths(body, [
      'payer_name',
      'payerName',
      'customer_name',
      'customerName',
      'requestPayload.primaryData.customerName',
      'requestPayload.additionalData.customerName',
    ]);
    const payerAccountRef = pickStringByPaths(body, [
      'payer_account_ref',
      'payerAccountRef',
      'account_ref',
      'accountRef',
      'customerReference',
      'narration',
      'requestPayload.primaryData.accountReference',
      'requestPayload.primaryData.customerReference',
      'requestPayload.primaryData.narration',
      'requestPayload.additionalData.accountReference',
      'requestPayload.additionalData.customerReference',
      'requestPayload.additionalData.narration',
    ]);
    const referenceCode = pickStringByPaths(body, [
      'reference_code',
      'referenceCode',
      'invoice_reference',
      'invoiceReference',
      'transactionReference',
      'customerReference',
      'requestPayload.primaryData.referenceCode',
      'requestPayload.primaryData.invoiceReference',
      'requestPayload.primaryData.transactionReference',
      'requestPayload.primaryData.customerReference',
      'requestPayload.additionalData.referenceCode',
      'requestPayload.additionalData.transactionReference',
      'requestPayload.additionalData.customerReference',
    ]);

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
