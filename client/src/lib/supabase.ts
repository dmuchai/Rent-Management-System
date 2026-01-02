/**
 * Supabase Client for Frontend
 * 
 * This module creates a Supabase client instance for use in the frontend.
 * It uses the public anon key (safe to expose in the browser).
 */

import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'loaded' : 'MISSING');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'loaded' : 'MISSING');
  throw new Error('Missing required Supabase environment variables. Please check your .env file.');
}

// Create and export the Supabase client
// 
// AUTH STRATEGY: Hybrid approach for different auth flows
// - Regular login/register: Handled by backend with httpOnly cookies
// - OAuth (Google): Uses client for OAuth flow, then syncs with backend
// - Password reset: Uses client to handle recovery tokens from email links
// - Realtime: Uses anon key for public subscription access
// 
// Session handling is enabled ONLY for:
// 1. OAuth callback processing (temporary session during redirect)
// 2. Password reset token validation (recovery flow)
// 
// Sessions are NOT persisted long-term - backend httpOnly cookies remain the source of truth
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Enable session handling for OAuth and password reset flows
    // Session is temporary and only used during auth callback/reset processing
    persistSession: true,
    autoRefreshToken: true,
    // Store in memory only to avoid conflicts with backend cookies
    storage: {
      getItem: (key: string) => {
        // Only persist auth-related items temporarily in sessionStorage (cleared on tab close)
        return sessionStorage.getItem(key);
      },
      setItem: (key: string, value: string) => {
        sessionStorage.setItem(key, value);
      },
      removeItem: (key: string) => {
        sessionStorage.removeItem(key);
      },
    },
    // Detect session from URL hash (OAuth & password reset)
    detectSessionInUrl: true,
    // Flow type for OAuth - use implicit for better compatibility
    flowType: 'implicit',
  },
  realtime: {
    // Enable Realtime features for database change subscriptions
    params: {
      eventsPerSecond: 10, // Rate limit to 10 events per second
    },
  },
});

// Log configuration in development
if (import.meta.env.MODE === 'development') {
  console.log('=== Supabase Client Configuration ===');
  console.log('URL:', supabaseUrl);
  console.log('Anon Key:', supabaseAnonKey ? '***' + supabaseAnonKey.slice(-4) : 'MISSING');
  console.log('Realtime: Enabled');
  console.log('=====================================');
}
