import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { access_token, refresh_token } = req.body;

  if (!access_token) {
    console.error('Set session: No access token provided');
    return res.status(400).json({ error: 'Access token required' });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Set session: Missing Supabase configuration', { 
        hasUrl: !!supabaseUrl, 
        hasKey: !!supabaseServiceKey 
      });
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Create admin client to verify the token
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(access_token);
    
    if (error) {
      console.error('Set session: Token verification failed:', error.message);
      return res.status(401).json({ error: 'Invalid token', details: error.message });
    }
    
    if (!user) {
      console.error('Set session: No user found for token');
      return res.status(401).json({ error: 'Invalid token - no user' });
    }

    // Set httpOnly cookies for security
    const cookies = [
      `supabase-auth-token=${access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`
    ];
    
    if (refresh_token) {
      cookies.push(`supabase-refresh-token=${refresh_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`);
    }
    
    res.setHeader('Set-Cookie', cookies);

    // Sync user to database
    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        console.error('Set session: DATABASE_URL not configured');
      } else {
        const sql = postgres(databaseUrl, { 
          prepare: false,
          max: 1,
        });
        const db = drizzle(sql);

        const existingUser = await db.query.users.findFirst({
          where: eq(users.id, user.id)
        });

        if (!existingUser) {
          // Create new user record
          const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User';
          const parts = fullName.trim().split(/\s+/).filter((part: string) => part.length > 0);
          
          const firstName = parts[0] || 'User';
          const lastName = parts.slice(1).join(' ') || null;

          await db.insert(users).values({
            id: user.id,
            email: user.email || '',
            firstName: firstName,
            lastName: lastName,
            profileImageUrl: user.user_metadata?.avatar_url || null,
            role: 'landlord',
          });

          console.log('Set session: Created new user in database:', user.id);
        } else {
          console.log('Set session: User already exists in database:', user.id);
        }
        
        await sql.end();
      }
    } catch (dbError) {
      console.error('Set session: Failed to sync user to database:', dbError);
      // Don't fail the session if DB sync fails - user can still authenticate
    }

    console.log('Set session: Success for user', user.id);
    return res.status(200).json({ 
      success: true,
      message: 'Session established',
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Set session error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'Failed to set session', details: errorMsg });
  }
}
