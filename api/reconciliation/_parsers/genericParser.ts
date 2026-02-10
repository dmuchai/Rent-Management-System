import { ParsedTransaction, parseAmount, parseDate, extractPhoneNumber } from './statementParser.js';

/**
 * Generic CSV Parser for Unknown Bank Formats
 * 
 * Attempts to intelligently parse CSV statements by detecting:
 * - Date columns (various formats)
 * - Amount columns (debit/credit or single amount)
 * - Description/details columns
 * - Balance columns
 */

export function parseGenericCSV(content: string): ParsedTransaction[] {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);
  
  if (lines.length < 2) {
    throw new Error('CSV file appears to be empty');
  }

  // Parse header to detect column types
  const headerParts = parseCSVLine(lines[0]);
  const columnTypes = detectColumnTypes(headerParts);

  // Validate that we found a date column
  if (columnTypes.date === undefined) {
    throw new Error('Cannot detect date column');
  }

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const line = lines[i];
      if (!line) continue;

      const parts = parseCSVLine(line);
      const transaction = parseGenericRow(parts, columnTypes, i);

      if (transaction && transaction.amount > 0 && transaction.type === 'credit') {
        transactions.push(transaction);
      }

    } catch (error) {
      console.warn(`[Generic Parser] Error parsing line ${i}:`, error);
      continue;
    }
  }

  return transactions;
}

interface ColumnMapping {
  date?: number;
  description?: number;
  debit?: number;
  credit?: number;
  amount?: number;
  balance?: number;
}

function detectColumnTypes(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  headers.forEach((header, index) => {
    const lower = header.toLowerCase();

    // Date column
    if (lower.includes('date') || lower.includes('time')) {
      if (!mapping.date) mapping.date = index;
    }

    // Description column
    if (lower.includes('description') || lower.includes('details') || 
        lower.includes('narration') || lower.includes('transaction')) {
      if (!mapping.description) mapping.description = index;
    }

    // Debit column
    if (lower.includes('debit') || lower.includes('withdrawal')) {
      mapping.debit = index;
    }

    // Credit column
    if (lower.includes('credit') || lower.includes('deposit') || lower.includes('paid in')) {
      mapping.credit = index;
    }

    // Single amount column (if no debit/credit split)
    if ((lower.includes('amount') && !mapping.amount) || lower === 'amt') {
      mapping.amount = index;
    }

    // Balance column
    if (lower.includes('balance')) {
      mapping.balance = index;
    }
  });

  return mapping;
}

function parseGenericRow(parts: string[], columns: ColumnMapping, rowIndex: number): ParsedTransaction | null {
  const dateStr = parts[columns.date!];  // Safe to use ! since we validated earlier
  const description = columns.description !== undefined ? 
    parts[columns.description] : 
    parts.find(p => p && p.length > 5) || '';

  // Determine amount and type
  let amount = 0;
  let type: 'credit' | 'debit' = 'credit';

  if (columns.debit !== undefined && columns.credit !== undefined) {
    // Separate debit/credit columns
    const debitAmount = parseAmount(parts[columns.debit] || '0');
    const creditAmount = parseAmount(parts[columns.credit] || '0');
    
    if (creditAmount > 0) {
      amount = creditAmount;
      type = 'credit';
    } else if (debitAmount > 0) {
      amount = debitAmount;
      type = 'debit';
    }
  } else if (columns.amount !== undefined) {
    // Single amount column
    const amountStr = parts[columns.amount];
    amount = Math.abs(parseAmount(amountStr));
    type = amountStr.includes('-') || amountStr.includes('(') ? 'debit' : 'credit';
  } else {
    // Try to find any number in the row
    const numericPart = parts.find(p => /\d{1,3}(,?\d{3})*(\.\d{2})?/.test(p));
    if (numericPart) {
      amount = Math.abs(parseAmount(numericPart));
      type = numericPart.includes('-') ? 'debit' : 'credit';
    }
  }

  if (amount === 0) return null;

  const balance = columns.balance !== undefined ? 
    parseAmount(parts[columns.balance] || '0') : 
    undefined;

  return {
    reference: `GENERIC-${dateStr.replace(/\D/g, '')}-${rowIndex}`,
    date: parseDate(dateStr),
    amount,
    type,
    description,
    balance,
    phoneNumber: extractPhoneNumber(description),
    raw: parts
  };
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
