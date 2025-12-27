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
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We handle auth via cookies from our API
    autoRefreshToken: false,
  },
  realtime: {
    // Enable Realtime features
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
