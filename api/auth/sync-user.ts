// POST /api/auth/sync-user endpoint
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Inline auth verification
async function verifyAuth(req: VercelRequest) {
  const authToken = req.cookies['supabase-auth-token'];
  if (!authToken) {
    return null;
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(authToken);
    if (error || !user) {
      return null;
    }
    return { userId: user.id, user };
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify authentication
  const auth = await verifyAuth(req);
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Create database connection
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Sync user: DATABASE_URL not configured');
    return res.status(500).json({ error: 'Database not configured' });
  }

  const sql = postgres(databaseUrl, { 
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: 'require',
  });

  try {
    // auth.user already contains the verified Supabase user from auth verification
    const supabaseUser = auth.user;
    
    console.log('Syncing user:', supabaseUser.id, supabaseUser.email);

    // Check if user exists using raw SQL (explicitly use public schema)
    const existingUsers = await sql`
      SELECT * FROM public.users WHERE id = ${supabaseUser.id}
    `;
    
    console.log('Existing users found:', existingUsers.length);

    if (existingUsers.length > 0) {
      // User exists - update their info
      const emailValue = supabaseUser.email || '';
      const fullName = supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || emailValue?.split('@')[0] || 'User';
      const parts = fullName.trim().split(/\s+/).filter((part: string) => part.length > 0);
      
      const firstPart = parts[0] || 'User';
      const lastParts = parts.slice(1);
      const lastName = lastParts.length > 0 ? lastParts.join(' ') : (existingUsers[0].last_name || '');
      const profileImageUrl = supabaseUser.user_metadata?.avatar_url || existingUsers[0].profile_image_url || '';
      
      const updatedUsers = await sql`
        UPDATE public.users
        SET 
          email = ${emailValue},
          first_name = ${firstPart},
          last_name = ${lastName},
          profile_image_url = ${profileImageUrl},
          updated_at = NOW()
        WHERE id = ${supabaseUser.id}
        RETURNING *
      `;
      
      console.log('User updated successfully');
      return res.status(200).json(updatedUsers[0]);
    } else {
      // Create new user using raw SQL
      const { email, firstName, lastName, role } = req.body || {};
      
      const emailValue = email || supabaseUser.email;
      if (!emailValue) {
        return res.status(400).json({ error: 'Email is required for new user' });
      }

      const fullName = supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || emailValue.split('@')[0] || 'User';
      const parts = fullName.trim().split(/\s+/).filter((part: string) => part.length > 0);
      
      const firstPart = parts[0] || 'User';
      const lastParts = parts.slice(1);

      console.log('Creating new user with:', { emailValue, firstPart, lastParts });

      const newUsers = await sql`
        INSERT INTO public.users (id, email, first_name, last_name, profile_image_url, role, created_at, updated_at)
        VALUES (
          ${supabaseUser.id},
          ${emailValue},
          ${firstName || firstPart},
          ${lastName || lastParts.join(' ') || null},
          ${supabaseUser.user_metadata?.avatar_url || null},
          ${role || 'landlord'},
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          profile_image_url = EXCLUDED.profile_image_url,
          updated_at = NOW()
        RETURNING *
      `;

      console.log('User created successfully');
      return res.status(201).json(newUsers[0]);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('=== Error syncing user ===');
    console.error('Error message:', errorMessage);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('Error details:', JSON.stringify(error, null, 2));
    console.error('========================');
    
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: errorMessage,
      hint: 'Check if DATABASE_URL is configured correctly in Vercel'
    });
  } finally {
    await sql.end().catch(err => console.error('Error closing connection:', err));
  }
}
