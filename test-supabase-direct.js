import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    const supabase = createClient(
      process.env.SUPABASE_URL, 
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Test 1: Simple query using Supabase client
    console.log('Test 1: Simple auth user fetch...');
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) {
      console.log('Auth users error:', usersError);
    } else {
      console.log('✓ Auth users count:', users.users.length);
    }
    
    // Test 2: Try to create a simple table using Supabase
    console.log('Test 2: Creating table via Supabase...');
    const { data, error } = await supabase.rpc('create_users_table');
    if (error) {
      console.log('RPC error (expected):', error.message);
    }
    
    // Test 3: Try using SQL via Supabase
    console.log('Test 3: Raw SQL via Supabase...');
    const { data: sqlData, error: sqlError } = await supabase
      .from('pg_tables')
      .select('tablename')
      .limit(5);
      
    if (sqlError) {
      console.log('SQL error:', sqlError);
    } else {
      console.log('✓ Found tables:', sqlData?.map(t => t.tablename));
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testSupabaseConnection();