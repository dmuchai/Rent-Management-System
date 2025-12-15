// GET /api/auth/user - Get current user info
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || '';
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const isDebugMode = process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production';
    
    if (isDebugMode) {
      console.log('Fetching user info...');
    }
    
    const auth = await verifyAuth(req);
    
    if (!auth) {
      console.error('❌ User fetch failed: Authentication failed');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (isDebugMode) {
      console.log('✅ User info retrieved successfully for:', auth.user.email);
    }
    
    return res.status(200).json({
      id: auth.user.id,
      email: auth.user.email,
      user_metadata: auth.user.user_metadata,
    });
  } catch (error) {
    console.error('❌ Error fetching user');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    
    const isDebugMode = process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production';
    if (isDebugMode && error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    
    return res.status(500).json({ 
      error: 'Internal server error',
      details: errorMessage 
    });
  }
}
