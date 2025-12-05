// POST /api/auth/sync-user - Sync user data to database
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth';
import { db } from '../_lib/db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, firstName, lastName, role } = req.body;

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, auth.userId)
    });

    if (existingUser) {
      // Update existing user
      const [updatedUser] = await db
        .update(users)
        .set({
          email: email || existingUser.email,
          firstName: firstName || existingUser.firstName,
          lastName: lastName || existingUser.lastName,
          role: role || existingUser.role,
        })
        .where(eq(users.id, auth.userId))
        .returning();

      return res.status(200).json(updatedUser);
    } else {
      // Create new user
      const fullName = auth.user.user_metadata?.name || auth.user.email.split('@')[0];
      const [first, ...lastParts] = fullName.split(' ');
      
      const [newUser] = await db.insert(users).values({
        id: auth.userId,
        email: email || auth.user.email,
        firstName: firstName || first,
        lastName: lastName || lastParts.join(' ') || null,
        role: role || 'landlord',
      }).returning();

      return res.status(201).json(newUser);
    }
  } catch (error) {
    console.error('Error syncing user:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
