
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
import * as jwt from 'jsonwebtoken';
export const isAuthenticated: RequestHandler = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    // Supabase JWTs are signed with the project's JWT secret
    const payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET!);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};
