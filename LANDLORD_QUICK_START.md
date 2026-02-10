# 📤 Quick Start: Upload Bank Statements

## For Landlords - 3 Simple Steps

### Step 1: Download Your Statement
Choose one option:

**Option A: M-Pesa**
1. Open M-Pesa app
2. Tap **My Account** → **M-Pesa Statement**
3. Select date range (e.g., Last Month)
4. Choose **Email** delivery
5. Download CSV file from email

**Option B: Bank Statement**
1. Login to online banking
2. Go to **Statements** section
3. Select your account
4. Choose date range
5. Download as **CSV format**

### Step 2: Upload to System
1. Login to your account
2. Click **Dashboard** in menu
3. Select **Payment Settings** tab
4. Scroll to **"Upload Bank Statement"**
5. Click **Choose File**
6. Select your CSV file
7. Click **Upload** button

### Step 3: Review Results
The system shows:
- ✅ **Matched** - Payments automatically linked to invoices
- ⚠️ **Unmatched** - Payments with no matching invoice
- ℹ️ **Duplicates** - Already processed (skipped)

## 📊 What to Expect

### Good Match Rate (70-90%)
Means most payments were automatically matched to invoices!

**Why it works:**
- Amounts match invoice amounts
- Dates are within ±3 days
- Phone numbers match tenants

### Low Match Rate (<50%)
Some payments couldn't be matched automatically.

**Common reasons:**
- No invoice exists for that amount
- Dates don't align
- Wrong phone number

**How to fix:**
1. Create invoices BEFORE uploading
2. Ask tenants to pay exact invoice amounts
3. Include invoice reference in payment description

## 💡 Tips for Best Results

### ✅ Do's
- Create invoices first, then upload statements
- Upload statements regularly (weekly/monthly)
- Ask tenants to include invoice number when paying
- Use consistent payment amounts
- Download statements in CSV format

### ❌ Don'ts
- Don't upload the same statement twice (duplicates!)
- Don't use Excel format (convert to CSV first)
- Don't edit CSV files (keep them original)
- Don't upload files larger than 5MB

## 🏦 Supported Banks

✅ M-Pesa (Safaricom)  
✅ Equity Bank  
✅ KCB (Kenya Commercial Bank)  
✅ Co-operative Bank  
✅ NCBA Bank  
✅ Any bank with CSV export  

## 📱 How to Get Statements

### M-Pesa
- **App**: My Account → M-Pesa Statement
- **USSD**: Dial *234# → My Account → Statement
- **Format**: Request via email (CSV)

### Equity Bank
- **Online**: EquityMobile/Online Banking → Statements
- **Format**: Download CSV

### KCB
- **Online**: KCB Mobile/Internet Banking → Statements
- **Format**: Export as CSV

### Co-op Bank
- **Online**: MCo-op Cash App → Account → Statements
- **Format**: Download CSV

### NCBA
- **Online**: NCBA Loop → Statements
- **Format**: Export CSV

## 🆘 Troubleshooting

### "Unable to detect statement format"
**Fix**: Rename file to include bank name
- Example: `equity_february_2026.csv`
- Or: `mpesa_statement.csv`

### "No transactions found"
**Fix**: Check that file has:
- Header row (column names)
- Credit/deposit transactions
- Proper CSV format

### File upload fails
**Check**:
- File size < 5MB ✓
- File format is .csv ✓
- Browser has internet connection ✓

### Low automatic matching
**Solutions**:
1. Create invoices with exact amounts
2. Ask tenants to reference invoice number
3. Manually reconcile unmatched items

## 📞 Need Help?

1. Check the full guide: `STATEMENT_UPLOAD_GUIDE.md`
2. Review sample files in `tests/sample-statements/`
3. Contact support with your CSV file and error message

## ✨ Benefits

⏱️ **Save Time** - No manual entry of payments  
✅ **Accuracy** - Automatic matching reduces errors  
📊 **Visibility** - See all payments in one place  
🔄 **Flexibility** - Works with ANY bank  
🚀 **Simple** - Just upload and go!  

---

**Remember**: Create invoices first, then upload statements for best results! 🎯
