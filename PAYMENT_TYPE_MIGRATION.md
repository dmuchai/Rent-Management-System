# Payment Type Migration Instructions

## Overview
This migration adds a `payment_type` column to the `payments` table to track different types of payments (rent, deposit, utility, maintenance, late fees, etc.).

## How to Apply the Migration

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the contents of `add-payment-type-column.sql`
5. Paste into the query editor
6. Click **Run** to execute the migration

### Option 2: Command Line (if you have direct database access)
```bash
psql <your-database-connection-string> -f add-payment-type-column.sql
```

## What This Migration Does

1. **Creates payment_type enum** with values:
   - `rent` - Monthly rent payments
   - `deposit` - Security deposit payments
   - `utility` - Utility bill payments
   - `maintenance` - Maintenance fee payments
   - `late_fee` - Late payment fees
   - `other` - Other payment types

2. **Adds payment_type column** to the payments table with a default value of `'rent'`

3. **Updates existing records** to set payment_type to `'rent'` for any NULL values

4. **Adds column documentation** for future reference

## Verification

After running the migration, verify it was successful:

```sql
-- Check if column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'payments' AND column_name = 'payment_type';

-- Check existing data
SELECT id, amount, payment_type, status 
FROM payments 
LIMIT 10;
```

## Rollback (if needed)

If you need to remove this column:

```sql
ALTER TABLE public.payments DROP COLUMN IF EXISTS payment_type;
DROP TYPE IF EXISTS payment_type;
```

⚠️ **Warning**: Rolling back will permanently delete all payment_type data!
