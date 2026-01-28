
/**
 * Supabase Authentication Module
 * 
 * This module handles JWT-based authentication using Supabase Auth.
 * It provides middleware for protecting routes and managing user sessions.
 */

import dotenv from "dotenv";
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import type { Express, RequestHandler, Request } from 'express';
// Extend Express Request type to allow 'user' property
declare module 'express-serve-static-core' {
  interface Request {
    user?: any;
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Environment check:');
console.log('SUPABASE_URL:', supabaseUrl ? 'loaded' : 'missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'loaded' : 'missing');

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing required Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function setupAuth(app: Express) {
  // No session setup needed, JWT-based auth
}

// Middleware to check Supabase JWT
import jwt from 'jsonwebtoken';
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // Check for token in Authorization header or cookie
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader) {
    token = authHeader.split(' ')[1];
    console.log('Token found in Authorization header');
  } else if (req.cookies && req.cookies['supabase-auth-token']) {
    token = req.cookies['supabase-auth-token'];
    console.log('Token found in cookie');
  }

  if (!token) {
    console.log('No token found in request');
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    // Supabase JWTs are signed with the project's JWT secret
    console.log('Verifying token...');
    const payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET!);
    const userId = (payload as any).sub;
    console.log('Token verified successfully for user:', userId);

    // Fetch user role from database to ensure role-aware routing works
    // This avoids every route having to re-query the users table
    const { data: userData, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (roleError) {
      console.log('Error fetching user role:', roleError.message);
    }

    // Attach payload and role to request
    // Using 'appRole' to avoid collision with Supabase JWT's 'role' field
    req.user = {
      ...(payload as any),
      appRole: userData?.role || (payload as any).user_metadata?.role || 'landlord' // fallback
    };

    next();
  } catch (err) {
    console.log('Token verification failed:', err instanceof Error ? err.message : 'Unknown error');
    return res.status(401).json({ message: 'Unauthorized' });
  }
};
