import { ParsedTransaction, parseAmount, parseDate, extractPhoneNumber } from './statementParser.js';

/**
 * Parse NCBA Bank Statement (CSV format)
 * 
 * Common format:
 * "Date","Narration","Debits","Credits","Balance"
 */

export function parseNCBAStatement(content: string): ParsedTransaction[] {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);
  
  if (lines.length < 2) {
    throw new Error('NCBA Bank statement appears to be empty');
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
      
      if (parts.length < 4) continue;

      const [dateStr, narration, debits, credits, balance] = parts;

      const debitAmount = parseAmount(debits || '0');
      const creditAmount = parseAmount(credits || '0');
      const isCredit = creditAmount > 0;
      const amount = isCredit ? creditAmount : debitAmount;

      if (amount === 0) continue;

      transactions.push({
        reference: `NCBA-${dateStr.replace(/\//g, '')}-${i}`,
        date: parseDate(dateStr),
        amount,
        type: isCredit ? 'credit' : 'debit',
        description: narration,
        balance: parseAmount(balance || '0'),
        phoneNumber: extractPhoneNumber(narration),
        raw: { date: dateStr, narration, debits, credits, balance }
      });

    } catch (error) {
      console.warn(`[NCBA Parser] Error parsing line ${i}:`, error);
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
