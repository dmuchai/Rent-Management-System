// POST /api/auth/sync-user endpoint
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

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
  });
  const db = drizzle(sql);

  try {
    // auth.user already contains the verified Supabase user from auth verification
    const supabaseUser = auth.user;

    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, supabaseUser.id)
    });

    if (existingUser) {
      // For POST, allow updates
      if (req.method === 'POST') {
        const { email, firstName, lastName, role } = req.body;
        
        const updateData: any = {};
        if (email !== undefined) updateData.email = email;
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (role !== undefined) updateData.role = role;

        if (Object.keys(updateData).length > 0) {
          const [updatedUser] = await db.update(users)
            .set(updateData)
            .where(eq(users.id, supabaseUser.id))
            .returning();

          await sql.end();
          return res.status(200).json(updatedUser);
        }
      }

      await sql.end();
      return res.status(200).json(existingUser);
    } else {
      // Create new user
      const { email, firstName, lastName, role } = req.body || {};
      
      const emailValue = email || supabaseUser.email;
      if (!emailValue) {
        await sql.end();
        return res.status(400).json({ error: 'Email is required for new user' });
      }

      const fullName = supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || emailValue.split('@')[0] || 'User';
      const parts = fullName.trim().split(/\s+/).filter((part: string) => part.length > 0);
      
      const firstPart = parts[0] || 'User';
      const lastParts = parts.slice(1);

      const [newUser] = await db.insert(users).values({
        id: supabaseUser.id,
        email: emailValue,
        firstName: firstName || firstPart,
        lastName: lastName || lastParts.join(' ') || null,
        profileImageUrl: supabaseUser.user_metadata?.avatar_url || null,
        role: role || 'landlord',
      }).returning();

      await sql.end();
      return res.status(201).json(newUser);
    }
  } catch (error) {
    await sql.end();
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error syncing user:', errorMessage);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    return res.status(500).json({ error: 'Internal server error', details: errorMessage });
  }
}
