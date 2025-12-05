// POST /api/auth/logout - Logout user
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate Authorization header format
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
    // Verify the token is valid before attempting logout
    const { data: { user }, error: verifyError } = await supabaseAdmin.auth.getUser(token);
    
    if (verifyError || !user) {
      // Token is invalid or expired - treat as idempotent (already logged out)
      console.warn('Logout attempted with invalid token (treating as no-op)');
      return res.status(200).json({ 
        success: true,
        message: 'Already logged out or token invalid'
      });
    }

    // Token is valid, proceed with sign out
    const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(token);
    
    if (signOutError) {
      const errorMessage = signOutError.message || 'Unknown error during sign out';
      console.error('Supabase signOut error:', errorMessage);
      
      // Check if it's a specific known error
      if (signOutError.message?.includes('not found') || signOutError.message?.includes('invalid')) {
        // Session already ended - treat as success (idempotent)
        return res.status(200).json({ 
          success: true,
          message: 'Session already ended'
        });
      }
      
      // Unexpected error from Supabase
      return res.status(500).json({ 
        error: 'Failed to sign out',
        message: 'An error occurred while signing out. Please try again.'
      });
    }

    // Success
    return res.status(200).json({ 
      success: true,
      message: 'Successfully logged out'
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Logout error:', errorMessage);
    if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'An unexpected error occurred during logout'
    });
  }
}
