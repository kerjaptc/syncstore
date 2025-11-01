/**
 * Security Headers Service
 * Implements comprehensive security headers for web security
 */

import { NextResponse } from 'next/server';
import { env } from '@/env';

export class SecurityHeadersService {
  /**
   * Get comprehensive security headers
   */
  static getSecurityHeaders(): Record<string, string> {
    const isDevelopment = env.NODE_ENV === 'development';
    const appUrl = env.NEXT_PUBLIC_APP_URL;
    const domain = new URL(appUrl).hostname;

    return {
      // Prevent MIME type sniffing
      'X-Content-Type-Options': 'nosniff',

      // Prevent clickjacking attacks
      'X-Frame-Options': 'DENY',

      // Enable XSS protection (legacy browsers)
      'X-XSS-Protection': '1; mode=block',

      // Control referrer information
      'Referrer-Policy': 'strict-origin-when-cross-origin',

      // Prevent DNS prefetching
      'X-DNS-Prefetch-Control': 'off',

      // Disable download of untrusted executables
      'X-Download-Options': 'noopen',

      // Prevent MIME type confusion attacks
      'X-Permitted-Cross-Domain-Policies': 'none',

      // Content Security Policy
      'Content-Security-Policy': this.getContentSecurityPolicy(isDevelopment),

      // HTTP Strict Transport Security (HTTPS only)
      ...(isDevelopment ? {} : {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      }),

      // Permissions Policy (formerly Feature Policy)
      'Permissions-Policy': this.getPermissionsPolicy(),

      // Cross-Origin policies
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',

      // Server information hiding
      'Server': 'StoreSync',
      'X-Powered-By': '', // Remove default Next.js header
    };
  }

  /**
   * Generate Content Security Policy
   */
  private static getContentSecurityPolicy(isDevelopment: boolean): string {
    const appUrl = env.NEXT_PUBLIC_APP_URL;
    const domain = new URL(appUrl).hostname;

    // Base CSP directives
    const csp = {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        "'unsafe-inline'", // Required for Next.js
        "'unsafe-eval'", // Required for development
        'https://js.clerk.dev',
        'https://js.stripe.com',
        ...(isDevelopment ? ["'unsafe-eval'"] : []),
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Required for styled-components and CSS-in-JS
        'https://fonts.googleapis.com',
      ],
      'font-src': [
        "'self'",
        'https://fonts.gstatic.com',
        'data:',
      ],
      'img-src': [
        "'self'",
        'data:',
        'blob:',
        'https:',
        // Allow images from common CDNs
        'https://*.amazonaws.com',
        'https://*.cloudfront.net',
        'https://*.supabase.co',
        'https://images.clerk.dev',
      ],
      'media-src': [
        "'self'",
        'data:',
        'blob:',
      ],
      'connect-src': [
        "'self'",
        'https://api.clerk.dev',
        'https://clerk.dev',
        'https://api.stripe.com',
        'https://*.supabase.co',
        'wss://*.supabase.co',
        ...(isDevelopment ? [
          'ws://localhost:*',
          'http://localhost:*',
          'https://localhost:*',
        ] : []),
      ],
      'frame-src': [
        "'self'",
        'https://js.stripe.com',
        'https://hooks.stripe.com',
      ],
      'worker-src': [
        "'self'",
        'blob:',
      ],
      'child-src': [
        "'self'",
        'blob:',
      ],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': isDevelopment ? [] : [''],
    };

    // Convert to CSP string
    return Object.entries(csp)
      .filter(([_, values]) => values.length > 0)
      .map(([directive, values]) => {
        if (values.length === 1 && values[0] === '') {
          return directive;
        }
        return `${directive} ${values.join(' ')}`;
      })
      .join('; ');
  }

  /**
   * Generate Permissions Policy
   */
  private static getPermissionsPolicy(): string {
    const policies = {
      'accelerometer': '()',
      'ambient-light-sensor': '()',
      'autoplay': '(self)',
      'battery': '()',
      'camera': '(self)',
      'cross-origin-isolated': '()',
      'display-capture': '()',
      'document-domain': '()',
      'encrypted-media': '()',
      'execution-while-not-rendered': '()',
      'execution-while-out-of-viewport': '()',
      'fullscreen': '(self)',
      'geolocation': '()',
      'gyroscope': '()',
      'keyboard-map': '()',
      'magnetometer': '()',
      'microphone': '(self)',
      'midi': '()',
      'navigation-override': '()',
      'payment': '(self)',
      'picture-in-picture': '()',
      'publickey-credentials-get': '(self)',
      'screen-wake-lock': '()',
      'sync-xhr': '()',
      'usb': '()',
      'web-share': '(self)',
      'xr-spatial-tracking': '()',
    };

    return Object.entries(policies)
      .map(([directive, value]) => `${directive}=${value}`)
      .join(', ');
  }

  /**
   * Apply security headers to response
   */
  static applySecurityHeaders(response: NextResponse): NextResponse {
    const headers = this.getSecurityHeaders();
    
    Object.entries(headers).forEach(([key, value]) => {
      if (value) {
        response.headers.set(key, value);
      }
    });

    return response;
  }

  /**
   * Create security headers for API responses
   */
  static createAPISecurityHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Get CORS headers for API endpoints
   */
  static getCORSHeaders(origin?: string): Record<string, string> {
    const allowedOrigins = [
      env.NEXT_PUBLIC_APP_URL,
      'https://dashboard.stripe.com', // For Stripe webhooks
    ];

    const isDevelopment = env.NODE_ENV === 'development';
    if (isDevelopment) {
      allowedOrigins.push('http://localhost:3000', 'http://localhost:3001');
    }

    const isAllowedOrigin = origin && allowedOrigins.includes(origin);

    return {
      'Access-Control-Allow-Origin': isAllowedOrigin ? origin : allowedOrigins[0],
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400', // 24 hours
    };
  }

  /**
   * Security headers for file uploads
   */
  static getFileUploadHeaders(): Record<string, string> {
    return {
      ...this.createAPISecurityHeaders(),
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'attachment', // Force download for unknown types
    };
  }

  /**
   * Security headers for webhook endpoints
   */
  static getWebhookHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    };
  }

  /**
   * Validate and sanitize custom headers
   */
  static validateCustomHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const allowedHeaders = [
      'x-organization-id',
      'x-user-role',
      'x-request-id',
      'x-api-version',
    ];

    Object.entries(headers).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();
      
      if (allowedHeaders.includes(lowerKey)) {
        // Sanitize header value
        const sanitizedValue = value.replace(/[^\w\-\.]/g, '');
        if (sanitizedValue.length > 0 && sanitizedValue.length <= 255) {
          sanitized[key] = sanitizedValue;
        }
      }
    });

    return sanitized;
  }

  /**
   * Create response with security headers
   */
  static createSecureResponse(
    data: any,
    options: {
      status?: number;
      headers?: Record<string, string>;
      cors?: boolean;
      origin?: string;
    } = {}
  ): NextResponse {
    const { status = 200, headers = {}, cors = false, origin } = options;

    const securityHeaders = this.createAPISecurityHeaders();
    const corsHeaders = cors ? this.getCORSHeaders(origin) : {};
    const customHeaders = this.validateCustomHeaders(headers);

    const allHeaders = {
      ...securityHeaders,
      ...corsHeaders,
      ...customHeaders,
    };

    return NextResponse.json(data, {
      status,
      headers: allHeaders,
    });
  }

  /**
   * Middleware to apply security headers
   */
  static middleware() {
    return (response: NextResponse): NextResponse => {
      return this.applySecurityHeaders(response);
    };
  }

  /**
   * Check if request has required security headers
   */
  static validateRequestHeaders(headers: Headers): {
    valid: boolean;
    missing: string[];
    warnings: string[];
  } {
    const required = ['user-agent', 'accept'];
    const recommended = ['accept-language', 'accept-encoding'];
    
    const missing: string[] = [];
    const warnings: string[] = [];

    required.forEach(header => {
      if (!headers.get(header)) {
        missing.push(header);
      }
    });

    recommended.forEach(header => {
      if (!headers.get(header)) {
        warnings.push(`Recommended header missing: ${header}`);
      }
    });

    // Check for suspicious headers
    const suspiciousHeaders = ['x-forwarded-host', 'x-original-url', 'x-rewrite-url'];
    suspiciousHeaders.forEach(header => {
      if (headers.get(header)) {
        warnings.push(`Potentially suspicious header detected: ${header}`);
      }
    });

    return {
      valid: missing.length === 0,
      missing,
      warnings,
    };
  }
}