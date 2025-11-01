/**
 * Edge Runtime Compatible Rate Limiter
 * Simple in-memory rate limiting for Edge Runtime environments
 */

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: NextRequest) => string;
  message?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
}

export class EdgeRateLimiterService {
  private static memoryStore = new Map<string, { count: number; resetTime: number }>();

  /**
   * Default key generator based on IP address
   */
  private static defaultKeyGenerator(request: NextRequest): string {
    const ip = request.ip || 
               request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const pathname = request.nextUrl?.pathname || '/';
    return `rate_limit:${pathname}:${ip}`;
  }

  /**
   * Check rate limit using memory store
   */
  private static checkRateLimit(
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

    return this.checkRateLimit(key, config);
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
  };

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
}