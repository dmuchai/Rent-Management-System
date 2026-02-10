# Statement Upload Feature - Testing & Usage Guide

## Overview

The Statement Upload feature allows landlords to upload bank/M-Pesa statements (CSV format) and automatically reconcile payments to invoices. This eliminates the need for webhooks and works with ANY bank or M-Pesa account.

## Supported Formats

### 1. M-Pesa Statement
- **How to Get**: 
  - M-Pesa App → My Account → M-Pesa Statement
  - Or dial `*234#` → My Account → M-Pesa Statement
  - Request via email (CSV format)
  
- **Format**: CSV with columns like:
  ```csv
  Receipt No.,Completion Time,Details,Transaction Status,Paid In,Withdrawn,Balance
  PGK1234567,06/02/2026 14:30,From 254712345678 - Rent Payment,Completed,20000.00,,85000.00
  ```

### 2. Equity Bank
- **How to Get**: Online Banking → Statements → Download CSV
- **Format**:
  ```csv
  Date,Description,Debit,Credit,Balance
  06/02/2026,MPESA-254712345678-PGK123,,20000.00,85000.00
  ```

### 3. KCB Bank
- **How to Get**: KCB Mobile Banking → Statements → Export CSV
- **Format**:
  ```csv
  Transaction Date,Value Date,Description,Debit,Credit,Running Balance
  05/02/2026,05/02/2026,MPESA PAYBILL 222111 - 254712345678,,15000.00,75000.00
  ```

### 4. Co-op Bank
- **How to Get**: MCo-op Cash App → Account → Statements
- **Format**:
  ```csv
  Date,Transaction Details,Withdrawals,Deposits,Balance
  04/02/2026,MPESA 254712345678 - Rent Payment,,25000.00,100000.00
  ```

### 5. NCBA Bank
- **How to Get**: NCBA Loop → Statements
- **Format**:
  ```csv
  Date,Narration,Debits,Credits,Balance
  03/02/2026,MPESA TRANSFER FROM 254712345678,,18000.00,92000.00
  ```

### 6. Generic CSV
- Any CSV with date, amount, and description columns
- System will auto-detect column structure

## How It Works

### 1. Auto-Detection
The parser automatically detects the statement format based on:
- Filename (e.g., "mpesa_statement.csv", "equity_feb2026.csv")
- File content patterns (bank headers, column names)
- Fallback to generic CSV parser

### 2. Transaction Parsing
For each transaction line, the parser extracts:
- **Date**: Transaction date (various formats supported)
- **Amount**: Credit amount (money received)
- **Reference**: M-Pesa code (PGK123, QAB456, etc.)
- **Phone Number**: Sender's phone (if available)
- **Description**: Full transaction details
- **Balance**: Running account balance

### 3. Auto-Reconciliation
Each parsed transaction is matched against unpaid invoices using:
- **Level 1 (Deterministic)**: Invoice reference code → 100% confidence
- **Level 2 (Heuristic)**: Landlord + Amount + Date ±3 days → 90% confidence
- **Level 3 (Enhanced)**: Level 2 + Phone number matching → Variable confidence

### 4. Duplicate Prevention
- System checks if transaction already exists (by external_transaction_id)
- Prevents duplicate reconciliation
- Shows duplicate count in results

## Usage Steps

### For Landlords

1. **Navigate to Payment Settings**
   - Login as landlord
   - Go to Dashboard → Payment Settings
   - Scroll down to "Upload Bank Statement" section

2. **Get Your Statement**
   - Choose one of the supported methods above
   - Download as CSV format
   - Save to your device

3. **Upload File**
   - Click "Choose File"
   - Select your CSV statement
   - Click "Upload" button

4. **Review Results**
   - Total transactions processed
   - Matched (auto-reconciled to invoices)
   - Unmatched (no matching invoice found)
   - Duplicates (already processed)
   - Match rate percentage

5. **Check Details**
   - Expand transaction details
   - See which invoices were matched
   - Review confidence levels
   - Identify unmatched transactions

## Testing Scenarios

### Test 1: M-Pesa Statement Upload

**Sample CSV** (`test_mpesa_statement.csv`):
```csv
Receipt No.,Completion Time,Details,Transaction Status,Paid In,Withdrawn,Balance
PGK1234567,06/02/2026 14:30,From 254712345678 John Kamau - Rent Payment,Completed,20000.00,,85000.00
QAB7654321,05/02/2026 10:15,From 254723456789 Mary Wanjiku,Completed,15000.00,,65000.00
```

**Expected Result**:
- 2 transactions parsed
- Auto-match if invoices exist for amounts 20,000 and 15,000
- Extract phone numbers: 254712345678, 254723456789

### Test 2: Equity Bank Statement

**Sample CSV** (`equity_february_2026.csv`):
```csv
Date,Description,Debit,Credit,Balance
06/02/2026,MPESA-254712345678-PGK1234567,,20000.00,85000.00
05/02/2026,MPESA-254723456789-QAB7654321,,15000.00,65000.00
04/02/2026,ATM WITHDRAWAL,500.00,,50000.00
```

**Expected Result**:
- 2 credit transactions (ATM withdrawal ignored)
- M-Pesa references extracted: PGK1234567, QAB7654321
- Phone numbers extracted

### Test 3: Generic Bank Statement

**Sample CSV** (`bank_statement.csv`):
```csv
Date,Details,Amount,Balance
06/02/2026,Payment from Catherine Njeri,20000.00,85000.00
05/02/2026,Rent - Unit A3,15000.00,65000.00
```

**Expected Result**:
- 2 transactions parsed
- Generic references created
- Match by amount + date + landlord

### Test 4: Duplicate Upload

**Steps**:
1. Upload a statement
2. Upload the same statement again

**Expected Result**:
- First upload: All transactions processed
- Second upload: All marked as duplicates
- No double-counting in payment records

### Test 5: Mixed Results

**Sample CSV with various scenarios**:
```csv
Receipt No.,Completion Time,Details,Transaction Status,Paid In,Withdrawn,Balance
PGK1111111,06/02/2026 14:30,From 254712345678 - INV-001,Completed,20000.00,,85000.00
PGK2222222,05/02/2026 10:15,From 254723456789,Completed,99999.00,,165000.00
PGK3333333,04/02/2026 08:00,From 254734567890 - INV-999,Completed,15000.00,,50000.00
```

**Expected Result**:
- Transaction 1: MATCHED (reference INV-001 found)
- Transaction 2: UNMATCHED (amount 99,999 doesn't match any invoice)
- Transaction 3: MATCHED or UNMATCHED (depending on INV-999 existence)

## API Endpoints

### Upload Statement
```
POST /api/reconciliation/upload-statement
Authorization: Required (Landlord only)

Request Body:
{
  "file": {
    "name": "mpesa_statement.csv",
    "content": "base64-encoded-file-content"
  },
  "statementType": "mpesa" // Optional, auto-detected if not provided
}

Response:
{
  "success": true,
  "format": "mpesa",
  "results": {
    "total": 10,
    "matched": 7,
    "unmatched": 2,
    "duplicates": 1,
    "errors": 0,
    "details": [...]
  },
  "summary": "Processed 10 transactions: 7 matched, 2 unmatched, 1 duplicates"
}
```

### Get Upload History
```
GET /api/reconciliation/upload-history
Authorization: Required (Landlord only)

Response:
{
  "uploads": [
    {
      "id": "uuid",
      "fileName": "mpesa_statement.csv",
      "statementType": "mpesa",
      "total": 10,
      "matched": 7,
      "unmatched": 2,
      "duplicates": 1,
      "uploadDate": "2026-02-06T14:30:00Z",
      "matchRate": 70
    }
  ]
}
```

## Database Schema

### statement_upload_history Table
```sql
CREATE TABLE public.statement_upload_history (
  id UUID PRIMARY KEY,
  landlord_id UUID REFERENCES users(id),
  file_name TEXT,
  statement_type TEXT,
  transactions_total INTEGER,
  transactions_matched INTEGER,
  transactions_unmatched INTEGER,
  transactions_duplicates INTEGER,
  upload_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);
```

## Common Issues & Troubleshooting

### Issue 1: "Unable to detect statement format"
**Solution**: 
- Ensure file is CSV format
- Check if filename includes bank name (equity, kcb, mpesa, etc.)
- Verify CSV has proper headers

### Issue 2: "No transactions found in statement"
**Solution**:
- Check if file has header row
- Ensure credit/deposit column has values
- Verify date format is supported

### Issue 3: Low match rate (< 50%)
**Possible Causes**:
- No matching invoices for the amounts/dates
- Invoice reference not included in transaction description
- Tenants using different phone numbers
**Solution**:
- Create invoices first, then upload statement
- Ask tenants to include invoice reference when paying
- Manual reconciliation for unmatched items

### Issue 4: File upload fails
**Check**:
- File size < 5MB
- File format is .csv or .txt (plain text CSV only)
- If you have Excel (.xls/.xlsx), save/export as CSV first
- Browser console for error messages

**Converting Excel to CSV**:
1. Open your Excel file
2. Click File → Save As
3. Choose "CSV (Comma delimited) (*.csv)" from format dropdown
4. Save and upload the .csv file

## Advanced Features

### Phone Number Extraction
Supports multiple formats:
- `254712345678`
- `0712345678` → converted to `254712345678`
- `+254712345678`
- Embedded in text: "From 254712345678 John"

### Date Parsing
Supports:
- DD/MM/YYYY (e.g., 06/02/2026)
- DD-MM-YYYY (e.g., 06-02-2026)
- ISO format (e.g., 2026-02-06)
- MM/DD/YYYY (US format)

### Amount Parsing
Handles:
- Commas: `20,000.00`
- Currency symbols: `KES 20000`
- Parentheses (debits): `(500.00)`
- Spaces: `20 000.00`

## Benefits

✅ **Works with ANY bank** - No partnership needed
✅ **No webhook setup** - Just upload statements
✅ **Immediate results** - See matches in seconds
✅ **Duplicate prevention** - Smart transaction tracking
✅ **Multi-level matching** - High accuracy reconciliation
✅ **Audit trail** - Upload history tracked
✅ **Bulk processing** - Handle 100s of transactions at once

## Future Enhancements

- [ ] Native Excel (.xlsx) file support (currently requires CSV conversion)
- [ ] PDF statement parsing (OCR)
- [ ] Scheduled uploads (email forwarding)
- [ ] Bank API integration (Open Banking)
- [ ] Custom mapping for unknown formats
- [ ] Batch manual reconciliation UI
- [ ] Export unmatched transactions
- [ ] Mobile app upload

## Support

For issues or questions:
1. Check this guide first
2. Review sample CSV formats above
3. Test with small sample file first
4. Contact support with error messages and sample data
