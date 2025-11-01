/**
 * Rate Limiting Service
 * Implements rate limiting for API endpoints to prevent abuse
 */

import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/env';

// Conditionally import Redis only on server side
let Redis: any = null;
if (typeof window === 'undefined' && typeof process !== 'undefined') {
  try {
    Redis = require('ioredis').Redis;
  } catch (error) {
    console.warn('ioredis not available, using memory store only');
  }
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: NextRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
}

export class RateLimiterService {
  private static redis: any | null = null;
  private static memoryStore = new Map<string, { count: number; resetTime: number }>();

  /**
   * Initialize Redis connection if available
   */
  private static getRedis(): any | null {
    // Only try to connect to Redis in Node.js environment
    if (typeof window === 'undefined' && typeof process !== 'undefined' && !this.redis && Redis) {
      try {
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
          this.redis = new Redis(redisUrl);
        }
      } catch (error) {
        console.warn('Redis connection failed, falling back to memory store:', error);
      }
    }
    return this.redis;
  }

  /**
   * Default key generator based on IP address and user ID
   */
  private static defaultKeyGenerator(request: NextRequest): string {
    const ip = request.ip || 
               request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const userId = request.headers.get('x-user-id') || 'anonymous';
    const pathname = new URL(request.url).pathname;
    
    return `rate_limit:${pathname}:${userId}:${ip}`;
  }

  /**
   * Check rate limit using Redis
   */
  private static async checkRateLimitRedis(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const redis = this.getRedis();
    if (!redis) {
      return this.checkRateLimitMemory(key, config);
    }

    const now = Date.now();
    const window = config.windowMs;
    const windowStart = now - window;

    try {
      // Use Redis sorted set to track requests in time window
      const pipeline = redis.pipeline();
      
      // Remove expired entries
      pipeline.zremrangebyscore(key, 0, windowStart);
      
      // Count current requests in window
      pipeline.zcard(key);
      
      // Add current request
      pipeline.zadd(key, now, `${now}-${Math.random()}`);
      
      // Set expiration
      pipeline.expire(key, Math.ceil(window / 1000));
      
      const results = await pipeline.exec();
      
      if (!results) {
        throw new Error('Redis pipeline failed');
      }

      const currentCount = (results[1][1] as number) || 0;
      const totalHits = currentCount + 1;
      const remaining = Math.max(0, config.maxRequests - totalHits);
      const resetTime = now + window;

      return {
        allowed: totalHits <= config.maxRequests,
        remaining,
        resetTime,
        totalHits,
      };
    } catch (error) {
      console.error('Redis rate limit check failed:', error);
      return this.checkRateLimitMemory(key, config);
    }
  }

  /**
   * Check rate limit using memory store (fallback)
   */
  private static checkRateLimitMemory(
    key: string,
    config: RateLimitConfig
  ): RateLimitResult {
    const now = Date.now();
    const current = this.memoryStore.get(key);

    if (!current || now > current.resetTime) {
      // New window or expired window
      const resetTime = now + config.windowMs;
      this.memoryStore.set(key, { count: 1, resetTime });
      
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime,
        totalHits: 1,
      };
    }

    const totalHits = current.count + 1;
    const remaining = Math.max(0, config.maxRequests - totalHits);
    const allowed = totalHits <= config.maxRequests;

    if (allowed) {
      current.count = totalHits;
      this.memoryStore.set(key, current);
    }

    return {
      allowed,
      remaining,
      resetTime: current.resetTime,
      totalHits,
    };
  }

  /**
   * Apply rate limiting to a request
   */
  static async checkRateLimit(
    request: NextRequest,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const keyGenerator = config.keyGenerator || this.defaultKeyGenerator;
    const key = keyGenerator(request);

    return this.checkRateLimitRedis(key, config);
  }

  /**
   * Create rate limiting middleware
   */
  static createMiddleware(config: RateLimitConfig) {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      const result = await this.checkRateLimit(request, config);

      // Add rate limit headers to all responses
      const headers = {
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
      };

      if (!result.allowed) {
        const message = config.message || 'Too many requests, please try again later.';
        
        return NextResponse.json(
          { 
            error: message,
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
          },
          { 
            status: 429,
            headers,
          }
        );
      }

      return null; // Allow request to continue
    };
  }

  /**
   * Predefined rate limit configurations
   */
  static configs = {
    // General API endpoints
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      message: 'Too many API requests, please try again later.',
    },

    // Authentication endpoints
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,
      message: 'Too many authentication attempts, please try again later.',
    },

    // File upload endpoints
    upload: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 20,
      message: 'Too many file uploads, please try again later.',
    },

    // Sync operations
    sync: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 10,
      message: 'Too many sync requests, please try again later.',
    },

    // Search endpoints
    search: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 30,
      message: 'Too many search requests, please slow down.',
    },

    // Export operations
    export: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 5,
      message: 'Too many export requests, please try again later.',
    },

    // Webhook endpoints
    webhook: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
      keyGenerator: (request: NextRequest) => {
        // Rate limit by webhook source
        const source = request.headers.get('x-webhook-source') || 'unknown';
        return `webhook:${source}`;
      },
    },

    // Admin operations
    admin: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 50,
      message: 'Too many admin operations, please try again later.',
    },
  };

  /**
   * Apply different rate limits based on user role
   */
  static createRoleBasedMiddleware(
    configs: Record<string, RateLimitConfig>,
    getUserRole: (request: NextRequest) => Promise<string | null>
  ) {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      const userRole = await getUserRole(request);
      const config = configs[userRole || 'default'] || configs.default;
      
      if (!config) {
        return null; // No rate limiting
      }

      return this.createMiddleware(config)(request);
    };
  }

  /**
   * Create IP-based rate limiter
   */
  static createIPRateLimiter(config: RateLimitConfig) {
    return this.createMiddleware({
      ...config,
      keyGenerator: (request: NextRequest) => {
        const ip = request.ip || 
                   request.headers.get('x-forwarded-for')?.split(',')[0] || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
        return `ip_rate_limit:${ip}`;
      },
    });
  }

  /**
   * Create user-based rate limiter
   */
  static createUserRateLimiter(config: RateLimitConfig) {
    return this.createMiddleware({
      ...config,
      keyGenerator: (request: NextRequest) => {
        const userId = request.headers.get('x-user-id') || 'anonymous';
        return `user_rate_limit:${userId}`;
      },
    });
  }

  /**
   * Clean up expired entries from memory store
   */
  static cleanupMemoryStore(): void {
    const now = Date.now();
    for (const [key, value] of this.memoryStore.entries()) {
      if (now > value.resetTime) {
        this.memoryStore.delete(key);
      }
    }
  }

  /**
   * Get current rate limit status for a key
   */
  static async getRateLimitStatus(
    request: NextRequest,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const keyGenerator = config.keyGenerator || this.defaultKeyGenerator;
    const key = keyGenerator(request);

    // Don't increment counter, just check current status
    const redis = this.getRedis();
    if (redis) {
      try {
        const now = Date.now();
        const windowStart = now - config.windowMs;
        
        await redis.zremrangebyscore(key, 0, windowStart);
        const currentCount = await redis.zcard(key);
        
        return {
          allowed: currentCount < config.maxRequests,
          remaining: Math.max(0, config.maxRequests - currentCount),
          resetTime: now + config.windowMs,
          totalHits: currentCount,
        };
      } catch (error) {
        console.error('Redis rate limit status check failed:', error);
      }
    }

    // Fallback to memory store
    const current = this.memoryStore.get(key);
    const now = Date.now();
    
    if (!current || now > current.resetTime) {
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetTime: now + config.windowMs,
        totalHits: 0,
      };
    }

    return {
      allowed: current.count < config.maxRequests,
      remaining: Math.max(0, config.maxRequests - current.count),
      resetTime: current.resetTime,
      totalHits: current.count,
    };
  }
}

// Start cleanup interval for memory store
if (typeof window === 'undefined') {
  setInterval(() => {
    RateLimiterService.cleanupMemoryStore();
  }, 5 * 60 * 1000); // Clean up every 5 minutes
}