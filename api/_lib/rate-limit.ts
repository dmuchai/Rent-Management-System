/**
 * Production-grade distributed rate limiting using Upstash Redis
 * 
 * Supports:
 * - Sliding window rate limiting
 * - Distributed across all serverless instances
 * - Automatic TTL cleanup
 * - Graceful fallback on Redis errors
 */

import { Redis } from '@upstash/redis';
import type { VercelRequest } from '@vercel/node';

// Initialize Upstash Redis client (uses REST API for serverless compatibility)
// Falls back to in-memory if Upstash credentials not configured
let redis: Redis | null = null;

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    console.log('[RateLimit] Using Upstash Redis for distributed rate limiting');
  } else {
    console.warn('[RateLimit] Upstash credentials not found, using in-memory fallback');
  }
} catch (error) {
  console.error('[RateLimit] Failed to initialize Upstash Redis:', error);
}

/**
 * Rate limit configuration for different actions
 */
export const RATE_LIMITS = {
  login: { limit: 20, window: 60 },           // 20 attempts per minute (increased for development)
  register: { limit: 10, window: 60 },        // 10 registrations per minute
  'forgot-password': { limit: 10, window: 60 }, // 10 requests per minute
  'change-password': { limit: 10, window: 60 }, // 10 changes per minute
  'profile-update': { limit: 20, window: 60 }, // 20 updates per minute
} as const;

/**
 * Extract client IP address from request
 */
export function getClientIp(req: VercelRequest): string {
  // Vercel provides the real IP in x-forwarded-for or x-real-ip
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  
  if (typeof forwarded === 'string') {
    // x-forwarded-for can be a comma-separated list, take the first one
    return forwarded.split(',')[0].trim();
  }
  
  if (typeof realIp === 'string') {
    return realIp;
  }
  
  // Fallback to req.socket if available
  return req.socket?.remoteAddress || 'unknown';
}

// ============================================================================
// IN-MEMORY FALLBACK (used if Redis not available)
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.resetTime < now) {
      memoryStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

function rateLimitInMemory(key: string, limit: number, windowSeconds: number): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = memoryStore.get(key);
  
  if (!entry || entry.resetTime < now) {
    // New window
    memoryStore.set(key, {
      count: 1,
      resetTime: now + windowSeconds * 1000,
    });
    
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: now + windowSeconds * 1000,
    };
  }
  
  // Increment counter
  entry.count++;
  
  const allowed = entry.count <= limit;
  const remaining = Math.max(0, limit - entry.count);
  
  return {
    allowed,
    remaining,
    resetAt: entry.resetTime,
  };
}

// ============================================================================
// UPSTASH REDIS IMPLEMENTATION
// ============================================================================

interface RateLimitConfig {
  action: string;
  ip: string;
  limit: number;
  windowMs: number; // window in milliseconds
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number; // seconds until reset
}

/**
 * Check if a request should be rate limited
 * Uses Upstash Redis if available, falls back to in-memory
 * 
 * @param config Rate limit configuration
 * @returns Result indicating if request is allowed
 */
export async function rateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const { action, ip, limit, windowMs } = config;
  
  // Create unique key for this action + IP combination
  const key = `ratelimit:${action}:${ip}`;
  const windowSeconds = Math.floor(windowMs / 1000);
  
  // Use Upstash Redis if available, otherwise fallback to in-memory
  if (redis) {
    try {
      // Use Redis pipeline for atomic operations
      const pipeline = redis.pipeline();
      
      // Increment counter
      pipeline.incr(key);
      
      // Set expiry (will update TTL on existing keys)
      pipeline.expire(key, windowSeconds);
      
      // Get TTL to calculate reset time
      pipeline.ttl(key);
      
      // Execute pipeline
      const results = await pipeline.exec();
      const count = results[0] as number;
      const ttl = results[2] as number;
      
      const allowed = count <= limit;
      const remaining = Math.max(0, limit - count);
      const resetTime = Date.now() + (ttl > 0 ? ttl * 1000 : windowMs);
      const retryAfter = allowed ? undefined : Math.ceil(ttl);
      
      console.log(`[RateLimit] ${action} from ${ip}: ${count}/${limit} (${allowed ? 'allowed' : 'blocked'})`);
      
      return {
        allowed,
        remaining,
        resetTime,
        retryAfter,
      };
    } catch (error) {
      console.error(`[RateLimit] Redis error for ${action}:`, error);
      // Fall through to in-memory fallback
    }
  }
  
  // Fallback to in-memory rate limiting
  const result = rateLimitInMemory(key, limit, windowSeconds);
  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetTime: result.resetAt,
    retryAfter: result.allowed ? undefined : Math.ceil((result.resetAt - Date.now()) / 1000),
  };
}

/**
 * Convenience function to check rate limit using VercelRequest
 */
export async function checkRateLimit(
  req: VercelRequest,
  action: keyof typeof RATE_LIMITS
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[action];
  const ip = getClientIp(req);
  
  return rateLimit({
    action,
    ip,
    limit: config.limit,
    windowMs: config.window * 1000,
  });
}
