#!/usr/bin/env node

/**
 * API Endpoint Tester for Rent Management System
 * 
 * This script tests the main API endpoints to ensure they're working correctly.
 * Make sure your server is running (npm run dev) before running this test.
 */

const BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:5000';
const parsedBaseUrl = new URL(BASE_URL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(parsedBaseUrl.hostname)) {
  throw new Error('test:api only permits an isolated loopback server');
}

// Mock JWT token for testing (you'll need a real one from Supabase Auth)
const MOCK_TOKEN = 'your_jwt_token_here';

const testEndpoints = async () => {
  console.log('🧪 Testing API Endpoints...\n');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${MOCK_TOKEN}`
  };

  const tests = [
    {
      name: 'GET /api/properties',
      method: 'GET',
      url: `${BASE_URL}/api/properties`,
      headers
    },
    {
      name: 'GET /api/tenants', 
      method: 'GET',
      url: `${BASE_URL}/api/tenants`,
      headers
    },
    {
      name: 'POST /api/properties (Create Property)',
      method: 'POST',
      url: `${BASE_URL}/api/properties`,
      headers,
      body: JSON.stringify({
        name: 'Test Property',
        address: '123 Test Street',
        propertyType: 'apartment',
        totalUnits: 10,
        description: 'A test property'
      })
    }
  ];

  let failed = 0;
  for (const test of tests) {
    try {
      console.log(`🔄 Testing: ${test.name}`);
      
      const response = await fetch(test.url, {
        method: test.method,
        headers: test.headers,
        body: test.body
      });

      const status = response.status;
      const statusText = response.statusText;
      
      if (status === 401) {
        console.log(`⚠️  ${test.name}: Authentication required (expected)`);
      } else {
        failed += 1;
        console.log(`❌ ${test.name}: Expected 401 from the isolated auth-boundary smoke test, received ${status} ${statusText}`);
      }

    } catch (error) {
      failed += 1;
      console.log(`❌ ${test.name}: Network error -`, error.message);
    }
  }

  console.log('\n📝 Test Summary:');
  console.log(`- ${tests.length - failed}/${tests.length} isolated auth-boundary probes returned the expected 401.`);
  console.log('- This smoke test does not validate authenticated endpoint behavior.');
  if (failed) process.exitCode = 1;
};

testEndpoints();
