
/**
 * Supabase Authentication Module
 * 
 * This module handles JWT-based authentication using Supabase Auth.
 * It provides middleware for protecting routes and managing user sessions.
 */

import dotenv from "dotenv";
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import type { Express, RequestHandler } from 'express';
import { requiresManagementSubscription, READ_ONLY_SUBSCRIPTION_ERROR } from '../shared/subscription/write-policy.js';
import { selectTrustedAuthority } from '../api/_lib/authority.js';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
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
      .select('role, created_by, status')
      .eq('id', userId)
      .single();

    if (roleError) {
      console.log('Error fetching user role:', roleError.message);
    }

    if (userData?.status === 'inactive' || userData?.status === 'suspended') {
      return res.status(403).json({ message: 'Account is not active' });
    }
    const { data: memberships, error: membershipsError } = await supabase.from('user_context_memberships')
      .select('role, context_owner_id, status')
      .eq('user_id', userId)
      .order('role', { ascending: true })
      .order('context_owner_id', { ascending: true });
    if (membershipsError) {
      console.error('Error fetching user memberships:', membershipsError.message);
      return res.status(503).json({ message: 'Unable to verify account context' });
    }
    const activeMemberships = (memberships || []).filter((membership: any) => membership.status === 'active');
    let authority = activeMemberships.length ? selectTrustedAuthority(
      activeMemberships,
      req.headers['x-landee-context-role']?.toString(),
      req.headers['x-landee-context-owner']?.toString(),
    ) : null;
    if (!authority && !memberships?.length && userData?.role) {
      let contextOwnerId = userData.role === 'tenant'
        ? null
        : ['caretaker', 'property_manager'].includes(userData.role) ? userData.created_by : userId;
      if (userData.role === 'tenant') {
        const { data: tenant } = await supabase.from('tenants')
          .select('landlord_id')
          .eq('user_id', userId)
          .not('landlord_id', 'is', null)
          .order('landlord_id', { ascending: true })
          .limit(1)
          .maybeSingle();
        contextOwnerId = tenant?.landlord_id || null;
      }
      authority = contextOwnerId ? { role: userData.role, context_owner_id: contextOwnerId } : null;
    }
    if (!authority?.role || !authority.context_owner_id) {
      return res.status(403).json({ message: 'No trusted account context is available' });
    }

    // Attach payload and role to request
    // Using 'appRole' to avoid collision with Supabase JWT's 'role' field
    req.user = {
      ...(payload as any),
      appRole: authority.role,
      contextOwnerId: authority.context_owner_id,
    };

    if (process.env.ENABLE_SUBSCRIPTIONS === 'true' && requiresManagementSubscription(req.method, req.originalUrl, req.user.appRole)) {
      try {
        const { getOwnerSubscriptionAccess } = await import('./utils/subscriptionAccess');
        const ownerId = req.user.contextOwnerId;
        if (!ownerId || (await getOwnerSubscriptionAccess(ownerId)).readOnly) {
          return res.status(403).json(READ_ONLY_SUBSCRIPTION_ERROR);
        }
      } catch (error) {
        console.error('Subscription access lookup failed', error);
        return res.status(503).json({ error: 'Could not verify subscription access. Please try again.' });
      }
    }
    next();
  } catch (err) {
    console.log('Token verification failed:', err instanceof Error ? err.message : 'Unknown error');
    return res.status(401).json({ message: 'Unauthorized' });
  }
};
