import { ParsedTransaction, parseAmount, parseDate, extractPhoneNumber, extractMpesaReference } from './statementParser.js';

/**
 * Parse KCB Bank Statement (CSV format)
 * 
 * Common format:
 * "Transaction Date","Value Date","Description","Debit","Credit","Running Balance"
 * "05/02/2026","05/02/2026","MPESA PAYBILL 222111 - 254712345678","","15,000.00","75,000.00"
 */

export function parseKCBStatement(content: string): ParsedTransaction[] {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);
  
  if (lines.length < 2) {
    throw new Error('KCB Bank statement appears to be empty');
  }

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const line = lines[i];
      
      if (!line || line.toLowerCase().includes('opening balance') || 
          line.toLowerCase().includes('closing balance')) {
        continue;
      }

      const parts = parseCSVLine(line);
      
      if (parts.length < 5) {
        console.warn(`[KCB Parser] Invalid line format:`, line);
        continue;
      }

      const [transactionDate, valueDate, description, debit, credit, balance] = parts;

      const debitAmount = parseAmount(debit || '0');
      const creditAmount = parseAmount(credit || '0');
      const isCredit = creditAmount > 0;
      const amount = isCredit ? creditAmount : debitAmount;

      if (amount === 0) continue;

      // Extract paybill number and account from KCB format
      const paybillMatch = description.match(/PAYBILL\s+(\d+)/i);
      const paybillNumber = paybillMatch ? paybillMatch[1] : undefined;

      const phoneNumber = extractPhoneNumber(description);
      const mpesaRef = extractMpesaReference(description);

      transactions.push({
        reference: mpesaRef || `KCB-${transactionDate.replace(/\//g, '')}-${i}`,
        date: parseDate(transactionDate),
        amount,
        type: isCredit ? 'credit' : 'debit',
        description,
        balance: parseAmount(balance || '0'),
        phoneNumber,
        paybillNumber,
        raw: { transactionDate, valueDate, description, debit, credit, balance }
      });

    } catch (error) {
      console.warn(`[KCB Parser] Error parsing line ${i}:`, error);
      continue;
    }
  }

  return transactions.filter(t => t.type === 'credit');
}

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
