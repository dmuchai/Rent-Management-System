# Vercel Environment Variables Checklist

## Critical Variables to Update in Vercel Dashboard

These variables are used by the backend and must point to your new domain.

### ✅ TO UPDATE (Domain-Related)

| Variable | Old Value | New Value | Purpose |
|----------|-----------|-----------|---------|
| `FRONTEND_URL` | `https://property-manager-ke.vercel.app` | `https://landee.kejalink.co.ke` | Password reset links, OAuth redirects, payment callbacks |

### ℹ️ ALREADY CORRECT

These are set with the correct domain via `.env.production`:

| Variable | Current Value | Purpose |
|----------|---------------|---------|
| `DATABASE_URL` | `postgresql://...:x!u+&YRK4su%40e9P@...` | Database connection (@ symbol encoded) |
| `VITE_SUPABASE_URL` | `https://emdahodfztpfdjkrbnqz.supabase.co` | Supabase frontend |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Supabase anon key |

### 📋 PAYMENT VARIABLES (Check if Used)

These should also be updated if they contain domain references:

- `MPESA_CALLBACK_URL` → Should be `https://landee.kejalink.co.ke/api/payments/mpesa/callback`
- `PESAPAL_CALLBACK_URL` → Should be `https://landee.kejalink.co.ke/api/payments/pesapal/ipn`
- `PAYMENT_SUCCESS_URL` → Should be `https://landee.kejalink.co.ke/dashboard?payment=success`

## How to Update in Vercel

1. Go to: https://vercel.com/your-project/settings/environment-variables
2. For each variable to update:
   - Click the variable name
   - Click `...` menu → Edit
   - Update the value
   - Click Save
3. **Redeploy** the project (or it will auto-redeploy on next push)

## Verify Changes

After updating and redeploying:

1. Check email reset links point to new domain
2. Test OAuth login (redirects should use new domain)
3. Test payments (callbacks should use new domain)

## Local Development

For local `.env.production` (already done):
- ✅ DATABASE_URL has @ encoded as %40
- ✅ FRONTEND_URL set to https://landee.kejalink.co.ke

---

**Last Updated:** February 25, 2026
