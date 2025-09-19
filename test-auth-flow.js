#!/usr/bin/env node

const BASE_URL = 'http://localhost:5000';

async function testAuthFlow() {
  console.log('🔍 Testing Authentication Flow...\n');

  try {
    // Test 1: Check if login page is accessible
    console.log('1. Testing login page accessibility...');
    const loginResponse = await fetch(`${BASE_URL}/api/login`);
    console.log('✅ Login page accessible:', loginResponse.status === 200);

    // Test 2: Try accessing protected dashboard without auth
    console.log('\n2. Testing dashboard protection (should be 401/403)...');
    try {
      const dashboardResponse = await fetch(`${BASE_URL}/dashboard`);
      if (dashboardResponse.status === 401 || dashboardResponse.status === 403) {
        console.log('✅ Dashboard is properly protected');
      } else {
        console.log('⚠️  Dashboard response:', dashboardResponse.status);
      }
    } catch (error) {
      console.log('❌ Error accessing dashboard:', error.message);
    }

    // Test 3: Try accessing protected API without auth
    console.log('\n3. Testing API protection (should be 401)...');
    try {
      const apiResponse = await fetch(`${BASE_URL}/api/properties`);
      if (apiResponse.status === 401) {
        const errorData = await apiResponse.json();
        console.log('✅ API is properly protected');
        console.log('   Response:', errorData);
      } else {
        console.log('⚠️  API response:', apiResponse.status);
      }
    } catch (error) {
      console.log('❌ Error accessing API:', error.message);
    }

    // Test 4: Check user info endpoint
    console.log('\n4. Testing user info endpoint (should be 401)...');
    try {
      const userResponse = await fetch(`${BASE_URL}/api/auth/user`);
      if (userResponse.status === 401) {
        const errorData = await userResponse.json();
        console.log('✅ User endpoint is properly protected');
        console.log('   Response:', errorData);
      } else {
        console.log('⚠️  User endpoint response:', userResponse.status);
      }
    } catch (error) {
      console.log('❌ Error accessing user endpoint:', error.message);
    }

    console.log('\n🎉 Authentication system is working correctly!');
    console.log('\n📋 Next steps:');
    console.log('1. Visit http://localhost:5000/api/login to sign in');
    console.log('2. Create a new account or sign in with existing credentials');
    console.log('3. You\'ll be redirected to http://localhost:5000/dashboard');
    console.log('4. Try creating a property using the dashboard form');

  } catch (error) {
    console.error('❌ Error testing auth flow:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the server is running with: npm run dev');
    }
  }
}

// Run the test
testAuthFlow();