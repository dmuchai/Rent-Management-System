// GET /api/auth/user - Get current authenticated user
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, supabaseAdmin } from '../_lib/auth';
import { db } from '../_lib/db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user from Supabase Auth
    const { data: { user: supabaseUser }, error: authError } = await supabaseAdmin.auth.getUser(auth.user.id);

    if (authError || !supabaseUser) {
      console.error('Failed to fetch user from Supabase Auth:', authError);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user from database
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, supabaseUser.id)
    });

    if (!dbUser) {
      // User not in database yet, create them
      const fullName = supabaseUser.user_metadata?.name || supabaseUser.email!.split('@')[0];
      const [firstName, ...lastNameParts] = fullName.split(' ');
      
      const [newUser] = await db.insert(users).values({
        id: supabaseUser.id,
        email: supabaseUser.email!,
        firstName: firstName,
        lastName: lastNameParts.join(' ') || null,
        role: 'landlord', // Default role
      }).returning();

      return res.status(200).json(newUser);
    }

    return res.status(200).json(dbUser);
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
