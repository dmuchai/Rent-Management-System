import { ParsedTransaction, parseAmount, parseDate, extractPhoneNumber } from './statementParser.js';

/**
 * Parse Co-op Bank Statement (CSV format)
 * 
 * Common format:
 * "Date","Transaction Details","Withdrawals","Deposits","Balance"
 * "04/02/2026","MPESA 254712345678 - Rent Payment","","25,000.00","100,000.00"
 */

export function parseCoopStatement(content: string): ParsedTransaction[] {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);
  
  if (lines.length < 2) {
    throw new Error('Co-op Bank statement appears to be empty');
  }

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const line = lines[i];
      
      if (!line || line.toLowerCase().includes('opening') || 
          line.toLowerCase().includes('closing')) {
        continue;
      }

      const parts = parseCSVLine(line);
      
      if (parts.length < 5) {
        console.warn(`[Co-op Parser] Invalid line format:`, line);
        continue;
      }

      const [dateStr, details, withdrawals, deposits, balance] = parts;

      const withdrawalAmount = parseAmount(withdrawals || '0');
      const depositAmount = parseAmount(deposits || '0');
      const isCredit = depositAmount > 0;
      const amount = isCredit ? depositAmount : withdrawalAmount;

      if (amount === 0) continue;

      const phoneNumber = extractPhoneNumber(details);

      transactions.push({
        reference: `COOP-${dateStr.replace(/\//g, '')}-${i}`,
        date: parseDate(dateStr),
        amount,
        type: isCredit ? 'credit' : 'debit',
        description: details,
        balance: parseAmount(balance || '0'),
        phoneNumber,
        raw: { date: dateStr, details, withdrawals, deposits, balance }
      });

    } catch (error) {
      console.warn(`[Co-op Parser] Error parsing line ${i}:`, error);
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
