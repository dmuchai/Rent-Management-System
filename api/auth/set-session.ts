/**
 * Set Session Endpoint - Establishes authentication cookies after OAuth callback
 * 
 * IMPORTANT: Cookie Security Configuration
 * 
 * This endpoint automatically detects same-origin vs cross-origin requests and applies
 * appropriate cookie settings:
 * 
 * SAME-ORIGIN (Production - Vercel single domain):
 *   - Frontend: https://property-manager-ke.vercel.app
 *   - API: https://property-manager-ke.vercel.app/api/*
 *   - Cookies: SameSite=Lax; Secure (better CSRF protection)
 * 
 * CROSS-ORIGIN (Development or multi-domain):
 *   - Frontend: http://localhost:5173
 *   - API: http://localhost:5000
 *   - Cookies: SameSite=None; Secure (required for cross-origin)
 * 
 * DEPLOYMENT REQUIREMENTS:
 *   ✅ Single domain deployment (recommended): Works automatically
 *   ⚠️  Subdomain deployment (e.g., api.example.com vs app.example.com):
 *      - Requires HTTPS for both domains
 *      - May need cookie domain attribute adjustment
 *      - Test thoroughly before production
 *   ❌ Different domains: Consider using Authorization headers instead
 * 
 * See COOKIE_SECURITY.md for detailed documentation and troubleshooting.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create Supabase client once at module level to avoid recreating on every request
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Debug logging (only in non-production or when DEBUG flag is set)
  const isDebugMode = process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production';
  
  if (isDebugMode) {
    console.log('=== Set Session Debug ===');
    console.log('SUPABASE_URL configured:', !!supabaseUrl);
    console.log('SUPABASE_SERVICE_ROLE_KEY configured:', !!supabaseServiceKey);
    console.log('Request origin:', req.headers.origin);
    console.log('========================');
  }

  // Set CORS headers to allow credentials
  const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || '';
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { access_token, refresh_token } = req.body;

  if (!access_token) {
    console.error('❌ Missing access_token in request body');
    return res.status(400).json({ error: 'Missing access_token' });
  }

  if (isDebugMode) {
    console.log('Access token received, length:', access_token.length);
    console.log('Refresh token received:', !!refresh_token);
  }

  try {
    if (isDebugMode) {
      console.log('Verifying token with Supabase...');
    }
    
    // Verify token with timeout to prevent function timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Token verification timeout')), 25000)
    );
    
    const verifyPromise = supabaseAdmin.auth.getUser(access_token);
    
    const { data: { user }, error } = await Promise.race([
      verifyPromise,
      timeoutPromise
    ]) as any;

    if (error || !user) {
      console.error('❌ Token verification failed');
      if (isDebugMode) {
        console.error('Error details:', error?.message);
      }
      return res.status(401).json({ error: 'Invalid token', details: error?.message });
    }

    if (isDebugMode) {
      console.log('✅ Token verified successfully for user:', user.id, user.email);
    }

    // Set httpOnly cookies for the tokens
    const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
    
    // Determine if this is a cross-origin request
    // Cross-origin: Development (frontend localhost:5173, API localhost:5000)
    // Same-origin: Production (both on same Vercel domain via rewrites)
    const requestOrigin = req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/');
    const isCrossOrigin = requestOrigin && !requestOrigin.includes(req.headers.host || '');
    
    // Cookie SameSite strategy:
    // - Cross-origin (dev): SameSite=None with Secure (requires HTTPS or localhost exception)
    // - Same-origin (production): SameSite=Lax (more secure, prevents CSRF)
    // 
    // IMPORTANT: This assumes production deployment on single Vercel domain
    // If using separate domains (e.g., api.example.com vs app.example.com), 
    // you MUST use SameSite=None with Secure flag for both
    const sameSite = isCrossOrigin ? 'None' : 'Lax';
    const secure = isCrossOrigin || isProduction; // Always secure for cross-origin or production
    
    if (isDebugMode) {
      console.log('Cookie configuration:');
      console.log('- Request origin:', requestOrigin || 'none');
      console.log('- Request host:', req.headers.host);
      console.log('- Is cross-origin:', isCrossOrigin);
      console.log('- SameSite:', sameSite);
      console.log('- Secure:', secure);
    }
    
    const cookies = [];
    
    // Access token cookie (1 hour)
    cookies.push(
      `supabase-auth-token=${access_token}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=3600${secure ? '; Secure' : ''}`
    );
    
    // Refresh token cookie (30 days)
    if (refresh_token) {
      cookies.push(
        `supabase-refresh-token=${refresh_token}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=2592000${secure ? '; Secure' : ''}`
      );
    }
    
    // Set cookies - must use array for multiple Set-Cookie headers
    res.setHeader('Set-Cookie', cookies);

    if (isDebugMode) {
      console.log('✅ Session cookies set successfully for user:', user.id);
      // Log only cookie names and properties, not values
      console.log('Cookies set:', cookies.map(c => c.split('=')[0]).join(', '));
    }
    return res.status(200).json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
      }
    });
  } catch (error) {
    console.error('❌ Set session error');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    if (isDebugMode && error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    return res.status(500).json({ 
      error: 'Failed to set session',
      details: errorMessage 
    });
  }
}
