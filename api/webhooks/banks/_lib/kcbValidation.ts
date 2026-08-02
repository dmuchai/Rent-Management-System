export interface KcbValidationResponseOptions {
  transactionId: string;
  statusCode: '0' | '1';
  statusMessage: string;
  customerName?: string;
  billAmount?: string;
  currency?: string;
  billType?: 'FIXED' | 'PARTIAL';
  creditAccountIdentifier?: string;
}

export function buildKcbValidationResponse(
  options: KcbValidationResponseOptions
): Record<string, string> {
  return {
    transactionID: options.transactionId,
    statusCode: options.statusCode,
    statusMessage: options.statusMessage,
    CustomerName: options.customerName || '',
    billAmount: options.billAmount || '0.00',
    currency: options.currency || 'KES',
    billType: options.billType || 'FIXED',
    creditAccountIdentifier: options.creditAccountIdentifier || '',
  };
}
