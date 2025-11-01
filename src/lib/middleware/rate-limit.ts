import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store (use Redis in production)
const store: RateLimitStore = {};

// Cleanup expired entries - less frequent in development
const cleanupInterval = process.env.NODE_ENV === 'development' ? 10 * 60 * 1000 : 5 * 60 * 1000; // 10 min vs 5 min
setInterval(() => {
  const now = Date.now();
  const keys = Object.keys(store);
  
  // Only cleanup if there are many entries to avoid unnecessary work
  if (keys.length > 100) {
    keys.forEach(key => {
      if (store[key].resetTime < now) {
        delete store[key];
      }
    });
  }
}, cleanupInterval);

export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = config;

  return async (request: NextRequest): Promise<NextResponse | null> => {
    // Get client identifier (IP address or user ID)
    const clientId = getClientId(request);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Initialize or get existing record
    if (!store[clientId] || store[clientId].resetTime < now) {
      store[clientId] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    const record = store[clientId];

    // Check if limit exceeded
    if (record.count >= maxRequests) {
      const resetTimeSeconds = Math.ceil((record.resetTime - now) / 1000);
      
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message,
            retryAfter: resetTimeSeconds,
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': record.resetTime.toString(),
            'Retry-After': resetTimeSeconds.toString(),
          },
        }
      );
    }

    // Increment counter
    record.count++;

    // Add rate limit headers to response
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', (maxRequests - record.count).toString());
    response.headers.set('X-RateLimit-Reset', record.resetTime.toString());

    return null; // Allow request to continue
  };
}

function getClientId(request: NextRequest): string {
  // Try to get user ID from JWT token first
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      // You could decode the JWT here to get user ID
      // For now, we'll use IP address
    } catch {
      // Fall back to IP address
    }
  }

  // Get IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || request.ip || 'unknown';

  return `ip:${ip}`;
}

// Predefined rate limiters for different use cases
export const rateLimiters = {
  // General API rate limiting
  api: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // 100 requests per 15 minutes
  }),

  // Strict rate limiting for authentication endpoints
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    message: 'Too many authentication attempts, please try again later.',
  }),

  // Rate limiting for password reset
  passwordReset: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 attempts per hour
    message: 'Too many password reset attempts, please try again later.',
  }),

  // Rate limiting for file uploads
  upload: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 uploads per minute
    message: 'Too many upload attempts, please slow down.',
  }),

  // Rate limiting for search endpoints
  search: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 searches per minute
  }),

  // Rate limiting for data export
  export: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5, // 5 exports per hour
    message: 'Too many export requests, please try again later.',
  }),
};

// Middleware factory for specific rate limits
export function withRateLimit(limiter: (request: NextRequest) => Promise<NextResponse | null>) {
  return async (request: NextRequest) => {
    const rateLimitResponse = await limiter(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    return NextResponse.next();
  };
}

// Helper to apply rate limiting to API routes
export function applyRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  limiter: (request: NextRequest) => Promise<NextResponse | null>
) {
  return async (request: NextRequest) => {
    const rateLimitResponse = await limiter(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    return handler(request);
  };
}