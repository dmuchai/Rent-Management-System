// GET /api/auth/user endpoint
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, supabaseAdmin } from '../_lib/auth';
import { db } from '../_lib/db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const { data: { user: supabaseUser }, error: authError } = await supabaseAdmin.auth.getUser(auth.user.id);

      if (authError || !supabaseUser) {
        console.error('Failed to fetch user from Supabase Auth:', authError);
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, supabaseUser.id)
      });

      if (!dbUser) {
        const email = supabaseUser.email;
        if (!email) {
          return res.status(401).json({ error: 'User email not found' });
        }
        
        const fullName = supabaseUser.user_metadata?.name || email.split('@')[0] || 'User';
        const parts = fullName.trim().split(/\s+/).filter((part: string) => part.length > 0);
        
        let firstName: string;
        let lastName: string | null;
        
        if (parts.length === 0) {
          firstName = 'User';
          lastName = null;
        } else if (parts.length === 1) {
          firstName = parts[0];
          lastName = null;
        } else {
          firstName = parts[0];
          lastName = parts.slice(1).join(' ');
        }
        
        const [newUser] = await db.insert(users).values({
          id: supabaseUser.id,
          email: email,
          firstName: firstName,
          lastName: lastName,
          role: 'landlord',
        })
        .onConflictDoUpdate({
          target: users.id,
          set: { 
            email: email,
            firstName: firstName,
            lastName: lastName,
          }
        })
        .returning();

        if (!newUser) {
          console.error('Failed to create or retrieve user for ID:', supabaseUser.id);
          return res.status(500).json({ error: 'Failed to create user' });
        }

        return res.status(200).json(newUser);
      }

      return res.status(200).json(dbUser);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error fetching user:', errorMessage);
      return res.status(500).json({ error: 'Internal server error' });
    }
  })(req, res);
}
