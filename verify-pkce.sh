#!/bin/bash
# Verify PKCE Configuration
# This script checks if your OAuth flow is using PKCE

echo "=== PKCE Configuration Verification ==="
echo ""
echo "1. Check Supabase client configuration:"
echo "   - File: client/src/lib/supabase.ts"
grep -A 2 "flowType:" client/src/lib/supabase.ts

echo ""
echo "2. Check backend auth configuration:"
echo "   - File: api/auth.ts"
grep -A 2 "flowType:" api/auth.ts

echo ""
echo "3. Environment variables:"
echo "   SUPABASE_URL: ${SUPABASE_URL:-'Not set (checking .env)'}"
echo "   VITE_SUPABASE_URL: ${VITE_SUPABASE_URL:-'Not set (checking .env)'}"

echo ""
echo "=== Next Steps ==="
echo "1. Enable PKCE toggle in Supabase dashboard"
echo "2. Test OAuth flow and check URL format:"
echo "   ✅ PKCE:     /auth-callback?code=..."
echo "   ❌ Implicit: /auth-callback#access_token=..."
echo ""
echo "3. Check browser console for logs:"
echo "   Look for: '[AuthCallback] PKCE flow detected'"
