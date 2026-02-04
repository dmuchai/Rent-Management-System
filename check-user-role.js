import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = '84414bd5-0016-4f00-ab9f-199d29bc3f00';

const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)
  .single();

if (error) {
  console.error('Error:', error);
} else {
  console.log('User data:', JSON.stringify(data, null, 2));
  console.log('\nRole value:', data.role);
  console.log('Role type:', typeof data.role);
  console.log('Role === null?', data.role === null);
  console.log('Role === undefined?', data.role === undefined);
  console.log('!role?', !data.role);
}

process.exit(0);
