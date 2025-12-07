// Consolidated handler for all /api/auth/* endpoints
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, supabaseAdmin } from '../_lib/auth';
import { db } from '../_lib/db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Parse the endpoint from the URL
  const url = req.url || '';
  const path = url.replace('/api/auth', '').split('?')[0];

  // Route to appropriate handler based on path
  if (path === '/logout' || path === 'logout') {
    return handleLogout(req, res);
  }

  if (path === '/set-session' || path === 'set-session') {
    return handleSetSession(req, res);
  }

  if (path === '/sync-user' || path === 'sync-user') {
    return handleSyncUser(req, res);
  }

  if (path === '/user' || path === 'user' || path === '') {
    return handleGetUser(req, res);
  }

  return res.status(404).json({ error: 'Endpoint not found' });
}

// POST /api/auth/logout
async function handleLogout(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(400).json({ 
      error: 'Authorization header is required',
      message: 'Please provide an Authorization header with a Bearer token'
    });
  }

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(422).json({ 
      error: 'Invalid authorization format',
      message: 'Authorization header must use Bearer token format: "Bearer <token>"'
    });
  }

  const token = authHeader.substring(7).trim();
  
  if (!token || token.length === 0) {
    return res.status(400).json({ 
      error: 'Token is required',
      message: 'Bearer token cannot be empty'
    });
  }

  try {
    const { data: { user }, error: verifyError } = await supabaseAdmin.auth.getUser(token);
    
    if (verifyError || !user) {
      console.warn('Logout attempted with invalid token (treating as no-op)');
      return res.status(200).json({ 
        success: true,
        message: 'Already logged out or token invalid'
      });
    }

    const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(token);
    
    if (signOutError) {
      const errorMessage = signOutError.message || 'Unknown error during sign out';
      console.error('Supabase signOut error:', errorMessage);
      
      if (signOutError.message?.includes('not found') || signOutError.message?.includes('invalid')) {
        return res.status(200).json({ 
          success: true,
          message: 'Session already ended'
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to sign out',
        message: 'An error occurred while signing out. Please try again.'
      });
    }

    return res.status(200).json({ 
      success: true,
      message: 'Successfully logged out'
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Logout error:', errorMessage);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'An unexpected error occurred during logout'
    });
  }
}

// POST /api/auth/set-session
async function handleSetSession(req: VercelRequest, res: VercelResponse) {
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
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Set session: Missing Supabase configuration');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Use admin client to verify the token
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

// POST /api/auth/sync-user (requires auth)
async function handleSyncUser(req: VercelRequest, res: VercelResponse) {
  return requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
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

      const ALLOWED_ROLES = ['landlord', 'tenant', 'property_manager', 'admin'];
      if (role !== undefined && role !== null) {
        if (typeof role !== 'string' || !ALLOWED_ROLES.includes(role)) {
          return res.status(400).json({ error: `Invalid role. Allowed values: ${ALLOWED_ROLES.join(', ')}`, field: 'role' });
        }
      }

      const existingUser = await db.query.users.findFirst({
        where: eq(users.id, auth.userId)
      });

      if (existingUser) {
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
      return res.status(500).json({ error: 'Internal server error' });
    }
  })(req, res);
}

// GET /api/auth/user (requires auth)
async function handleGetUser(req: VercelRequest, res: VercelResponse) {
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
