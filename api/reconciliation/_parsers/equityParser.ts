import { ParsedTransaction, parseAmount, parseDate, extractPhoneNumber, extractMpesaReference } from './statementParser.js';

/**
 * Parse Equity Bank Statement (CSV format)
 * 
 * Common format:
 * "Date","Description","Debit","Credit","Balance"
 * "06/02/2026","MPESA-254712345678-PGK123","","20,000.00","85,000.00"
 */

export function parseEquityStatement(content: string): ParsedTransaction[] {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);
  
  if (lines.length < 2) {
    throw new Error('Equity Bank statement appears to be empty');
  }

  const transactions: ParsedTransaction[] = [];

  // Skip header (first line)
  for (let i = 1; i < lines.length; i++) {
    try {
      const line = lines[i];
      
      // Skip empty or summary lines
      if (!line || line.toLowerCase().includes('opening balance') || 
          line.toLowerCase().includes('closing balance') ||
          line.toLowerCase().includes('total credits') ||
          line.toLowerCase().includes('total debits')) {
        continue;
      }

      const parts = parseCSVLine(line);
      
      if (parts.length < 4) {
        console.warn(`[Equity Parser] Invalid line format (expected 4+ columns):`, line);
        continue;
      }

      const [dateStr, description, debit, credit, balance] = parts;

      const debitAmount = parseAmount(debit || '0');
      const creditAmount = parseAmount(credit || '0');
      const isCredit = creditAmount > 0;
      const amount = isCredit ? creditAmount : debitAmount;

      if (amount === 0) continue; // Skip zero-amount transactions

      // Extract additional info from description
      const phoneNumber = extractPhoneNumber(description);
      const mpesaRef = extractMpesaReference(description);

      transactions.push({
        reference: mpesaRef || `EQUITY-${dateStr.replace(/\//g, '')}-${i}`,
        date: parseDate(dateStr),
        amount,
        type: isCredit ? 'credit' : 'debit',
        description,
        balance: parseAmount(balance || '0'),
        phoneNumber,
        raw: { date: dateStr, description, debit, credit, balance }
      });

    } catch (error) {
      console.warn(`[Equity Parser] Error parsing line ${i}:`, error);
      continue;
    }
  }

  // Return only credits (money received)
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
