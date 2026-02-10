import { ParsedTransaction, parseAmount, parseDate, extractPhoneNumber, extractMpesaReference } from './statementParser.js';

/**
 * Parse M-Pesa Statement (CSV format)
 * 
 * Common formats:
 * 1. Web download: "Receipt No.","Completion Time","Details","Transaction Status","Paid In","Withdrawn","Balance"
 * 2. App export: "Date","Transaction","Details","Status","Amount","Balance"
 */

export function parseMpesaStatement(content: string): ParsedTransaction[] {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);
  
  if (lines.length < 2) {
    throw new Error('M-Pesa statement appears to be empty');
  }

  const header = lines[0].toLowerCase();
  const transactions: ParsedTransaction[] = [];

  // Detect format
  const isWebFormat = header.includes('receipt no') && header.includes('completion time');
  const isAppFormat = header.includes('date') && header.includes('transaction');

  for (let i = 1; i < lines.length; i++) {
    try {
      const line = lines[i];
      
      // Skip empty lines or summary lines
      if (!line || line.toLowerCase().includes('total') || line.toLowerCase().includes('opening balance')) {
        continue;
      }

      const parts = parseCSVLine(line);

      if (isWebFormat) {
        transactions.push(parseWebFormat(parts, i));
      } else if (isAppFormat) {
        transactions.push(parseAppFormat(parts, i));
      } else {
        // Try generic parsing
        transactions.push(parseGenericMpesa(parts, i));
      }
    } catch (error) {
      console.warn(`[M-Pesa Parser] Skipping line ${i}:`, error);
      continue;
    }
  }

  // Filter only credit transactions (money received)
  return transactions.filter(t => t.type === 'credit' && t.amount > 0);
}

function parseWebFormat(parts: string[], lineIndex: number): ParsedTransaction {
  // Format: Receipt No., Completion Time, Details, Transaction Status, Paid In, Withdrawn, Balance
  const [receiptNo, completionTime, details, status, paidIn, withdrawn, balance] = parts;

  const paidInAmount = parseAmount(paidIn || '0');
  const withdrawnAmount = parseAmount(withdrawn || '0');
  const isCredit = paidInAmount > 0;

  return {
    reference: receiptNo || extractMpesaReference(details) || `MPESA-${Date.now()}-${lineIndex}`,
    date: parseDate(completionTime),
    amount: isCredit ? paidInAmount : withdrawnAmount,
    type: isCredit ? 'credit' : 'debit',
    description: details,
    balance: parseAmount(balance || '0'),
    phoneNumber: extractPhoneNumber(details),
    raw: { receiptNo, completionTime, details, status, paidIn, withdrawn, balance }
  };
}

function parseAppFormat(parts: string[], lineIndex: number): ParsedTransaction {
  // Format: Date, Transaction, Details, Status, Amount, Balance
  const [date, transaction, details, status, amount, balance] = parts;

  const amountValue = parseAmount(amount);
  const isCredit = !amount.includes('-') && !amount.includes('(');

  return {
    reference: extractMpesaReference(details) || transaction || `MPESA-${Date.now()}-${lineIndex}`,
    date: parseDate(date),
    amount: Math.abs(amountValue),
    type: isCredit ? 'credit' : 'debit',
    description: `${transaction} - ${details}`,
    balance: parseAmount(balance || '0'),
    phoneNumber: extractPhoneNumber(details),
    raw: { date, transaction, details, status, amount, balance }
  };
}

function parseGenericMpesa(parts: string[], lineIndex: number): ParsedTransaction {
  // Fallback: Try to find date, amount, and description
  const date = parseDate(parts[0] || parts[1]);
  const description = parts.find(p => p && p.length > 10) || parts.join(' ');
  const amountPart = parts.find(p => /\d{1,3}(,?\d{3})*(\.\d{2})?/.test(p));
  const amount = amountPart ? parseAmount(amountPart) : 0;

  return {
    reference: extractMpesaReference(description) || `MPESA-${Date.now()}-${lineIndex}`,
    date,
    amount: Math.abs(amount),
    type: amount >= 0 ? 'credit' : 'debit',
    description,
    phoneNumber: extractPhoneNumber(description),
    raw: parts
  };
}

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
