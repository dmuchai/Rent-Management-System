// GET /api/auth/user endpoint
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // auth.user already contains the verified Supabase user from requireAuth
      const supabaseUser = auth.user;
      
      // Return minimal user data to test if basic auth works
      return res.status(200).json({
        id: supabaseUser.id,
        email: supabaseUser.email,
        firstName: supabaseUser.user_metadata?.first_name || supabaseUser.user_metadata?.name?.split(' ')[0] || 'User',
        lastName: supabaseUser.user_metadata?.last_name || supabaseUser.user_metadata?.name?.split(' ').slice(1).join(' ') || null,
        role: supabaseUser.user_metadata?.role || 'landlord',
        createdAt: supabaseUser.created_at
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error fetching user:', errorMessage);
      return res.status(500).json({ error: 'Internal server error', details: errorMessage });
    }
  })(req, res);
}
