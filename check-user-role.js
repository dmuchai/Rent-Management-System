import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get userId from command-line argument or environment variable
// Usage: node check-user-role.js <user-id>
// Or set USER_ID environment variable
const userId = process.argv[2] || process.env.USER_ID;

if (!userId) {
  console.error('Error: USER_ID is required');
  console.error('Usage: node check-user-role.js <user-id>');
  console.error('Or set USER_ID environment variable');
  process.exit(1);
}

console.log('Checking user:', userId);

const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)
  .single();

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

console.log('User ID:', data.id);
console.log('\nRole value:', data.role);
console.log('Role type:', typeof data.role);
console.log('Role === null?', data.role === null);
console.log('Role === undefined?', data.role === undefined);
console.log('!role?', !data.role);

process.exit(0);
