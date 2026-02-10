#!/usr/bin/env node

/**
 * Test Statement Parsers
 * 
 * Run: node tests/test-statement-parsers.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import parsers
import { detectStatementFormat, parseStatement } from '../api/reconciliation/_parsers/statementParser.js';

const sampleFiles = [
  'mpesa_statement_sample.csv',
  'equity_statement_sample.csv',
  'kcb_statement_sample.csv',
  'coop_statement_sample.csv',
  'ncba_statement_sample.csv',
  'generic_statement_sample.csv'
];

console.log('🧪 Testing Statement Parsers\n');
console.log('='.repeat(60));

for (const file of sampleFiles) {
  const filePath = path.join(__dirname, 'sample-statements', file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`\n❌ File not found: ${file}`);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  
  console.log(`\n📄 Testing: ${file}`);
  console.log('-'.repeat(60));

  try {
    // Detect format
    const format = detectStatementFormat(content, file);
    console.log(`   Format detected: ${format}`);

    // Parse statement
    const transactions = parseStatement(content, format);
    console.log(`   Transactions found: ${transactions.length}`);

    if (transactions.length > 0) {
      console.log(`\n   Sample transaction:`);
      const tx = transactions[0];
      console.log(`   - Reference: ${tx.reference || 'N/A'}`);
      console.log(`   - Date: ${tx.date && !isNaN(tx.date.getTime()) ? tx.date.toISOString().split('T')[0] : 'N/A'}`);
      console.log(`   - Amount: KES ${typeof tx.amount === 'number' ? tx.amount.toLocaleString() : 'N/A'}`);
      console.log(`   - Type: ${tx.type || 'N/A'}`);
      console.log(`   - Description: ${tx.description ? tx.description.substring(0, 50) + '...' : 'N/A'}`);
      if (tx.phoneNumber) {
        console.log(`   - Phone: ${tx.phoneNumber}`);
      }
      if (tx.balance !== undefined && tx.balance !== null) {
        console.log(`   - Balance: KES ${typeof tx.balance === 'number' ? tx.balance.toLocaleString() : 'N/A'}`);
      }

      // Summary
      const totalAmount = transactions.reduce((sum, t) => sum + (typeof t.amount === 'number' ? t.amount : 0), 0);
      const withPhones = transactions.filter(t => t.phoneNumber).length;
      
      console.log(`\n   Summary:`);
      console.log(`   - Total credits: KES ${totalAmount.toLocaleString()}`);
      console.log(`   - With phone numbers: ${withPhones}/${transactions.length}`);
      console.log(`   ✅ PASSED`);
    } else {
      console.log(`   ⚠️  No transactions found (might be header-only file)`);
    }

  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    console.error(error.stack);
  }
}

console.log('\n' + '='.repeat(60));
console.log('✅ Parser tests completed\n');
