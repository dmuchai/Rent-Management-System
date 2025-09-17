import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Please set the following in your .env file:');
  console.log('- SUPABASE_URL');
  console.log('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabaseConnection() {
  console.log('🔄 Testing Supabase connection...\n');

  try {
    // Test 1: Basic connection
    const { data, error } = await supabase.from('properties').select('count').limit(1);
    
    if (error) {
      console.log('❌ Connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Database connection successful');

    // Test 2: Check if tables exist
    const tables = ['properties', 'units', 'tenants', 'leases', 'payments'];
    
    for (const table of tables) {
      const { error: tableError } = await supabase.from(table).select('count').limit(1);
      if (tableError) {
        console.log(`❌ Table '${table}' not found:`, tableError.message);
      } else {
        console.log(`✅ Table '${table}' exists`);
      }
    }

    // Test 3: Test authentication
    const { data: authData, error: authError } = await supabase.auth.getUser();
    console.log(`ℹ️  Auth test: ${authError ? 'No active session (expected)' : 'Active session found'}`);

    console.log('\n🎉 Supabase setup test completed!');
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
testSupabaseConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Test script error:', error);
    process.exit(1);
  });