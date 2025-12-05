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

    // Validate email format if provided
    if (email !== undefined && email !== null) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (typeof email !== 'string' || !emailRegex.test(email)) {
        return res.status(400).json({ 
          error: 'Invalid email format',
          field: 'email'
        });
      }
    }

    // Validate firstName if provided
    if (firstName !== undefined && firstName !== null) {
      if (typeof firstName !== 'string' || firstName.length < 1 || firstName.length > 100) {
        return res.status(400).json({ 
          error: 'First name must be between 1 and 100 characters',
          field: 'firstName'
        });
      }
      // Check for invalid characters (allow letters, spaces, hyphens, apostrophes)
      if (!/^[a-zA-Z\s'-]+$/.test(firstName)) {
        return res.status(400).json({ 
          error: 'First name contains invalid characters',
          field: 'firstName'
        });
      }
    }

    // Validate lastName if provided
    if (lastName !== undefined && lastName !== null) {
      if (typeof lastName !== 'string' || lastName.length < 1 || lastName.length > 100) {
        return res.status(400).json({ 
          error: 'Last name must be between 1 and 100 characters',
          field: 'lastName'
        });
      }
      // Check for invalid characters (allow letters, spaces, hyphens, apostrophes)
      if (!/^[a-zA-Z\s'-]+$/.test(lastName)) {
        return res.status(400).json({ 
          error: 'Last name contains invalid characters',
          field: 'lastName'
        });
      }
    }

    // Validate role if provided
    const ALLOWED_ROLES = ['landlord', 'tenant', 'property_manager', 'admin'];
    if (role !== undefined && role !== null) {
      if (typeof role !== 'string' || !ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({ 
          error: `Invalid role. Allowed values: ${ALLOWED_ROLES.join(', ')}`,
          field: 'role',
          allowedValues: ALLOWED_ROLES
        });
      }
    }

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
      const fullName = auth.user.user_metadata?.name || auth.user.email?.split('@')[0] || 'User';
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error syncing user:', errorMessage);
    if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});
