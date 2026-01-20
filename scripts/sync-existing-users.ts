import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncExistingUsers() {
    console.log('🔄 Starting bulk metadata sync for existing users...');

    // 1. Fetch all users from public.users
    const { data: publicUsers, error: fetchError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email');

    if (fetchError) {
        console.error('❌ Failed to fetch users from public.users:', fetchError.message);
        return;
    }

    if (!publicUsers || publicUsers.length === 0) {
        console.log('ℹ️ No users found in public.users to sync.');
        return;
    }

    console.log(`📊 Found ${publicUsers.length} users to process.`);

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (const user of publicUsers) {
        try {
            // 2. Get current auth metadata
            const { data: { user: authUser }, error: getUserError } = await supabase.auth.admin.getUserById(user.id);

            if (getUserError || !authUser) {
                console.warn(`⚠️ User ${user.email} (${user.id}) not found in Auth or error occurred:`, getUserError?.message);
                failCount++;
                continue;
            }

            const metadata = authUser.user_metadata || {};

            // 3. Update if first_name is missing
            if (!metadata.first_name || !metadata.firstName) {
                console.log(`🔧 Syncing metadata for ${user.email}...`);

                const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
                    user_metadata: {
                        ...metadata,
                        first_name: user.first_name,
                        last_name: user.last_name,
                        firstName: user.first_name,
                        lastName: user.last_name,
                    }
                });

                if (updateError) {
                    console.error(`❌ Failed to update ${user.email}:`, updateError.message);
                    failCount++;
                } else {
                    console.log(`✅ Successfully updated ${user.email}`);
                    successCount++;
                }
            } else {
                console.log(`⏭️ Skipping ${user.email} (already has metadata)`);
                skipCount++;
            }
        } catch (err) {
            console.error(`💥 Unexpected error for ${user.email}:`, err);
            failCount++;
        }
    }

    console.log('\n--- Sync Summary ---');
    console.log(`✅ Successfully updated: ${successCount}`);
    console.log(`⏭️ Already correct: ${skipCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📊 Total processed: ${publicUsers.length}`);
    console.log('--------------------\n');
}

syncExistingUsers();
