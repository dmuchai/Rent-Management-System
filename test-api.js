#!/usr/bin/env node

/**
 * API Endpoint Tester for Rent Management System
 * 
 * This script tests the main API endpoints to ensure they're working correctly.
 * Make sure your server is running (npm run dev) before running this test.
 */

const BASE_URL = 'http://localhost:5000';

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
      } else if (status >= 200 && status < 300) {
        console.log(`✅ ${test.name}: Success (${status})`);
      } else {
        console.log(`❌ ${test.name}: Failed (${status} ${statusText})`);
      }

    } catch (error) {
      console.log(`❌ ${test.name}: Network error -`, error.message);
    }
  }

  console.log('\n📝 Test Summary:');
  console.log('- If you see "Authentication required", your routes are working!');
  console.log('- Set up a real JWT token from Supabase Auth to test authenticated endpoints');
  console.log('- Make sure your server is running with: npm run dev');
};

testEndpoints();