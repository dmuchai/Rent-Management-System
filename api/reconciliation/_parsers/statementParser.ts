import { parseEquityStatement } from './equityParser.js';
import { parseKCBStatement } from './kcbParser.js';
import { parseCoopStatement } from './coopParser.js';
import { parseMpesaStatement } from './mpesaParser.js';
import { parseNCBAStatement } from './ncbaParser.js';
import { parseGenericCSV } from './genericParser.js';

export interface ParsedTransaction {
  reference: string;
  date: Date;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  balance?: number;
  phoneNumber?: string;
  accountRef?: string;
  paybillNumber?: string;
  accountNumber?: string;
  invoiceRef?: string;
  raw: any;
}

export type StatementFormat = 
  | 'equity'
  | 'kcb'
  | 'coop'
  | 'ncba'
  | 'mpesa'
  | 'absa'
  | 'family'
  | 'generic';

/**
 * Auto-detect statement format from file content and filename
 */
export function detectStatementFormat(content: string, filename: string): StatementFormat | null {
  const lowerContent = content.toLowerCase();
  const lowerFilename = filename.toLowerCase();

  // Check by filename first
  if (lowerFilename.includes('equity')) return 'equity';
  if (lowerFilename.includes('kcb')) return 'kcb';
  if (lowerFilename.includes('coop') || lowerFilename.includes('co-op')) return 'coop';
  if (lowerFilename.includes('ncba')) return 'ncba';
  if (lowerFilename.includes('mpesa') || lowerFilename.includes('m-pesa')) return 'mpesa';
  if (lowerFilename.includes('absa')) return 'absa';
  if (lowerFilename.includes('family')) return 'family';

  // Check by content patterns
  if (lowerContent.includes('equity bank') || lowerContent.includes('equity group')) {
    return 'equity';
  }
  
  if (lowerContent.includes('kcb bank') || lowerContent.includes('kenya commercial bank')) {
    return 'kcb';
  }
  
  if (lowerContent.includes('co-operative bank') || lowerContent.includes('cooperative bank')) {
    return 'coop';
  }
  
  if (lowerContent.includes('ncba bank') || lowerContent.includes('nic bank')) {
    return 'ncba';
  }
  
  if (lowerContent.includes('m-pesa statement') || lowerContent.includes('safaricom')) {
    return 'mpesa';
  }

  // Fallback to generic CSV parser
  if (content.includes(',') || content.includes('\t')) {
    return 'generic';
  }

  return null;
}

/**
 * Parse statement based on detected format
 */
export function parseStatement(content: string, format: StatementFormat): ParsedTransaction[] {
  switch (format) {
    case 'equity':
      return parseEquityStatement(content);
    case 'kcb':
      return parseKCBStatement(content);
    case 'coop':
      return parseCoopStatement(content);
    case 'ncba':
      return parseNCBAStatement(content);
    case 'mpesa':
      return parseMpesaStatement(content);
    case 'generic':
      return parseGenericCSV(content);
    default:
      throw new Error(`Unsupported statement format: ${format}`);
  }
}

/**
 * Extract phone number from transaction description
 * Common patterns:
 * - "MPESA-254712345678-PGK123"
 * - "From 0712345678"
 * - "254712345678 JOHN DOE"
 */
export function extractPhoneNumber(description: string): string | undefined {
  // Remove spaces for easier matching
  const clean = description.replace(/\s+/g, '');
  
  // Pattern 1: 254XXXXXXXXX (10 digits after 254)
  const match254 = clean.match(/254(\d{9})/);
  if (match254) {
    return `254${match254[1]}`;
  }
  
  // Pattern 2: 07XXXXXXXX or 01XXXXXXXX (10 digits starting with 0)
  const match07 = clean.match(/0([17]\d{8})/);
  if (match07) {
    return `254${match07[1]}`;
  }
  
  // Pattern 3: +254XXXXXXXXX
  const matchPlus = clean.match(/\+254(\d{9})/);
  if (matchPlus) {
    return `254${matchPlus[1]}`;
  }
  
  return undefined;
}

/**
 * Extract M-Pesa transaction reference
 * Patterns: PGK123456, QAB123456, etc.
 */
export function extractMpesaReference(description: string): string | undefined {
  const match = description.match(/([A-Z]{3}\d{7,10})/);
  return match ? match[1] : undefined;
}

/**
 * Parse amount from string (handles commas, currency symbols)
 */
export function parseAmount(amountStr: string): number {
  const cleaned = amountStr
    .replace(/[KES$,\s]/g, '')
    .replace(/[()]/g, '')  // Remove parentheses (used for debits)
    .trim();
  
  return parseFloat(cleaned) || 0;
}

/**
 * Parse date from various formats
 */
export function parseDate(dateStr: string): Date {
  // Try ISO format first
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  
  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = dateStr.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1]);
    const month = parseInt(dmyMatch[2]) - 1;
    let year = parseInt(dmyMatch[3]);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }
  
  // Try MM/DD/YYYY
  const mdyMatch = dateStr.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (mdyMatch) {
    const month = parseInt(mdyMatch[1]) - 1;
    const day = parseInt(mdyMatch[2]);
    const year = parseInt(mdyMatch[3]);
    return new Date(year, month, day);
  }
  
  throw new Error(`Unable to parse date: ${dateStr}`);
}
