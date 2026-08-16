# Vercel Environment Variables Checklist

## Critical Variables to Update in Vercel Dashboard

These variables are used by the backend and must point to your new domain.

### TO UPDATE (Domain-Related)

| Variable | Old Value | New Value | Purpose |
|----------|-----------|-----------|---------|
| `FRONTEND_URL` | `https://property-manager-ke.vercel.app` | `https://landee.kejalink.co.ke` | Password reset links, OAuth redirects, payment callbacks |

### ALREADY CORRECT

Verify these by name and environment in Vercel. Never store their values in source control.

| Variable | Current Value | Purpose |
|----------|---------------|---------|
| `DATABASE_URL` | Configured in Vercel (value intentionally omitted) | PostgreSQL database connection |
| `VITE_SUPABASE_URL` | Configured in Vercel | Supabase frontend |
| `VITE_SUPABASE_ANON_KEY` | Configured in Vercel (value intentionally omitted) | Supabase anon key |

### PAYMENT VARIABLES (Check if Used)

- `MPESA_CALLBACK_URL` should use `https://landee.kejalink.co.ke/api/payments/mpesa/callback` in Production.
- `PESAPAL_CALLBACK_URL` should use `https://landee.kejalink.co.ke/api/payments/pesapal/ipn` in Production.
- `PAYMENT_SUCCESS_URL` should use `https://landee.kejalink.co.ke/dashboard?payment=success` in Production.

### SMS VARIABLES (Infobip Live Testing)

| Variable | Value | Purpose |
|----------|-------|---------|
| `SMS_PROVIDER` | `infobip` | Routes SMS through Infobip |
| `INFOBIP_BASE_URL` | Your Infobip API base URL, such as `xxxxx.api.infobip.com` | Infobip account endpoint |
| `INFOBIP_API_KEY` | Your active Infobip API key | API authentication |
| `INFOBIP_SENDER_ID` | Your registered sender, such as `Landee` | Sender used for Kenyan SMS traffic |

Keep the Africa's Talking variables only if you want a rollback path; they are ignored while `SMS_PROVIDER=infobip`.

## How to Update in Vercel

1. Open the project environment-variable settings.
2. Edit only the intended variable and environment assignments.
3. Redeploy, or allow the next deployment to pick up the change.

## Verify Changes

1. Check email reset links point to the intended domain.
2. Test OAuth login redirects.
3. Test payment callbacks in a non-Production environment first.

## Local Development

- Keep `.env*` files out of source control.
- Confirm `DATABASE_URL` is URL-encoded without recording its value in documentation.
- Set `FRONTEND_URL` to `https://landee.kejalink.co.ke` only for Production.

---

**Last Updated:** August 16, 2026
