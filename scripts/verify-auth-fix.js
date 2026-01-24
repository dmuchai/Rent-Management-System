/**
 * Verification script for /api/auth?action=user
 */
const BASE_URL = 'http://localhost:5000';

async function testAuth() {
    console.log("🧪 Testing /api/auth?action=user with cookie vs header...\n");

    // Note: This script is intended to be run against a local dev server.
    // We can't easily generate a real token here without triggering an actual login,
    // so we'll just check if the endpoint responds correctly (401 with logs) 
    // when given invalid tokens in both ways.

    console.log("1. Testing with invalid Authorization header...");
    const headerRes = await fetch(`${BASE_URL}/api/auth?action=user`, {
        headers: { 'Authorization': 'Bearer invalid_token' }
    });
    console.log(`Response: ${headerRes.status} ${headerRes.statusText}`);

    console.log("\n2. Testing with invalid 'supabase-auth-token' cookie...");
    const cookieRes = await fetch(`${BASE_URL}/api/auth?action=user`, {
        headers: { 'Cookie': 'supabase-auth-token=invalid_token' }
    });
    console.log(`Response: ${cookieRes.status} ${cookieRes.statusText}`);

    console.log("\n✅ Verification script completed. Check server logs for [Auth] debug statements.");
}

testAuth().catch(err => console.error("❌ Test failed:", err));
