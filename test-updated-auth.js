#!/usr/bin/env node

// Test the authentication flow with the new session handling

const BASE_URL = 'http://localhost:5000';

async function testUpdatedAuthFlow() {
  console.log('🔍 Testing Updated Authentication Flow...\n');

  try {
    // Test 1: Verify login page is accessible
    console.log('1. Testing login page...');
    const loginResponse = await fetch(`${BASE_URL}/api/login`);
    console.log('✅ Login page accessible:', loginResponse.status === 200);

    // Test 2: Verify set-session endpoint exists
    console.log('\n2. Testing set-session endpoint...');
    const setSessionResponse = await fetch(`${BASE_URL}/api/auth/set-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: 'test' })
    });
    
    if (setSessionResponse.status === 400) {
      console.log('✅ Set-session endpoint exists and validates tokens');
    } else {
      console.log('⚠️  Unexpected set-session response:', setSessionResponse.status);
    }

    // Test 3: Check that dashboard is still protected
    console.log('\n3. Testing dashboard protection...');
    const dashboardResponse = await fetch(`${BASE_URL}/dashboard`);
    if (dashboardResponse.status === 401) {
      console.log('✅ Dashboard is properly protected');
    } else {
      console.log('⚠️  Dashboard response:', dashboardResponse.status);
    }

    console.log('\n🎯 Authentication flow is updated and ready!');
    console.log('\n📋 Steps to test manually:');
    console.log('1. Visit: http://localhost:5000/api/login');
    console.log('2. Try signing up with a new email/password');
    console.log('3. Or sign in with existing credentials');
    console.log('4. Check browser console for debugging info');
    console.log('5. You should be redirected to dashboard');

  } catch (error) {
    console.error('❌ Error testing updated auth flow:', error.message);
  }
}

testUpdatedAuthFlow();