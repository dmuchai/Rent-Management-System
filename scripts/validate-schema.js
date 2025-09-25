import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function validateSchema() {
  console.log('🔍 Validating database schema...\n');
  
  try {
    // Test payments table structure
    console.log('📋 Checking payments table...');
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .limit(1);
    
    if (error && error.code === 'PGRST116') {
      console.log('✅ Payments table exists (empty table)');
    } else if (error) {
      console.log('❌ Error checking payments table:', error.message);
      return false;
    } else {
      console.log('✅ Payments table exists and accessible');
      if (data && data.length > 0) {
        console.log('📊 Sample payment structure:', Object.keys(data[0]));
      }
    }
    
    // Test payment creation with description field
    console.log('\n💾 Testing payment creation with description...');
    const testPayment = {
      lease_id: '00000000-0000-0000-0000-000000000000', // Dummy ID for test
      amount: '100.00',
      due_date: new Date().toISOString(),
      status: 'pending',
      description: 'Schema validation test payment'
    };
    
    const { data: testData, error: testError } = await supabase
      .from('payments')
      .insert([testPayment])
      .select()
      .single();
    
    if (testError) {
      if (testError.message.includes('description')) {
        console.log('❌ Description field issue:', testError.message);
        return false;
      } else if (testError.message.includes('foreign key')) {
        console.log('✅ Description field works! (Foreign key error expected with dummy lease_id)');
        return true;
      } else {
        console.log('⚠️  Unexpected error:', testError.message);
        return false;
      }
    } else {
      console.log('✅ Payment creation successful!');
      // Clean up test payment
      await supabase.from('payments').delete().eq('id', testData.id);
      console.log('🧹 Test payment cleaned up');
      return true;
    }
    
  } catch (error) {
    console.log('❌ Validation failed:', error.message);
    return false;
  }
}

// Run validation
validateSchema().then(success => {
  if (success) {
    console.log('\n🎉 Schema validation successful! Payment system should work correctly.');
  } else {
    console.log('\n💥 Schema validation failed! Please check the database configuration.');
  }
  process.exit(success ? 0 : 1);
});