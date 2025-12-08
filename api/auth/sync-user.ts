// POST /api/auth/sync-user endpoint
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { db } from '../_lib/db';
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, firstName, lastName, role } = req.body;

    // Validate inputs
    if (email !== undefined && email !== null) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (typeof email !== 'string' || !emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format', field: 'email' });
      }
    }

    if (firstName !== undefined && firstName !== null) {
      if (typeof firstName !== 'string' || firstName.length < 1 || firstName.length > 100) {
        return res.status(400).json({ error: 'First name must be between 1 and 100 characters', field: 'firstName' });
      }
      if (!/^[a-zA-Z\s'-]+$/.test(firstName)) {
        return res.status(400).json({ error: 'First name contains invalid characters', field: 'firstName' });
      }
    }

    if (lastName !== undefined && lastName !== null) {
      if (typeof lastName !== 'string' || lastName.length < 1 || lastName.length > 100) {
        return res.status(400).json({ error: 'Last name must be between 1 and 100 characters', field: 'lastName' });
      }
      if (!/^[a-zA-Z\s'-]+$/.test(lastName)) {
        return res.status(400).json({ error: 'Last name contains invalid characters', field: 'lastName' });
      }
    }

    if (role !== undefined && role !== null) {
      const validRoles = ['landlord', 'tenant', 'property_manager'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: `Role must be one of: ${validRoles.join(', ')}`, field: 'role' });
      }
    }

    // auth.user already contains the verified Supabase user from auth verification
    const supabaseUser = auth.user;

      const existingUser = await db.query.users.findFirst({
        where: eq(users.id, supabaseUser.id)
      });

      if (existingUser) {
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

          return res.status(200).json(updatedUser);
        }

        return res.status(200).json(existingUser);
      } else {
        const emailValue = email || supabaseUser.email;
        if (!emailValue) {
          return res.status(400).json({ error: 'Email is required for new user' });
        }

        const fullName = supabaseUser.user_metadata?.name || emailValue.split('@')[0] || 'User';
        const parts = fullName.trim().split(/\s+/).filter((part: string) => part.length > 0);
        
        const firstPart = parts[0] || 'User';
        const lastParts = parts.slice(1);

        const [newUser] = await db.insert(users).values({
          id: supabaseUser.id,
          email: emailValue,
          firstName: firstName || firstPart,
          lastName: lastName || lastParts.join(' ') || null,
          role: role || 'landlord',
        }).returning();

        return res.status(201).json(newUser);
      }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error syncing user:', errorMessage);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
