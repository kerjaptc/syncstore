/**
 * CSRF Protection Service
 * Implements CSRF protection for all state-changing operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/env';

export class CSRFProtectionService {
  private static readonly TOKEN_LENGTH = 32;
  private static readonly TOKEN_LIFETIME = 60 * 60 * 1000; // 1 hour
  private static readonly HEADER_NAME = 'x-csrf-token';
  private static readonly COOKIE_NAME = 'csrf-token';

  /**
   * Generate a CSRF token
   */
  static async generateToken(): Promise<string> {
    // Use Web Crypto API for Edge Runtime compatibility
    const randomBytes = new Uint8Array(this.TOKEN_LENGTH);
    crypto.getRandomValues(randomBytes);
    const randomToken = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    
    const timestamp = Date.now().toString();
    const payload = `${randomToken}.${timestamp}`;
    
    const signature = await this.createSignature(payload);
    
    return `${payload}.${signature}`;
  }

  /**
   * Create HMAC signature using Web Crypto API
   */
  private static async createSignature(payload: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(env.ENCRYPTION_KEY),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate a CSRF token
   */
  static async validateToken(token: string): Promise<boolean> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return false;
      }

      const [randomToken, timestamp, signature] = parts;
      const payload = `${randomToken}.${timestamp}`;
      
      // Verify signature
      const expectedSignature = await this.createSignature(payload);
      
      if (signature !== expectedSignature) {
        return false;
      }

      // Check if token is expired
      const tokenTime = parseInt(timestamp, 10);
      const now = Date.now();
      
      if (now - tokenTime > this.TOKEN_LIFETIME) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('CSRF token validation error:', error);
      return false;
    }
  }

  /**
   * Extract CSRF token from request
   */
  static extractToken(request: NextRequest): string | null {
    // Try header first
    const headerToken = request.headers.get(this.HEADER_NAME);
    if (headerToken) {
      return headerToken;
    }

    // Try cookie
    const cookieToken = request.cookies.get(this.COOKIE_NAME)?.value;
    if (cookieToken) {
      return cookieToken;
    }

    // Try form data for POST requests
    if (request.method === 'POST') {
      try {
        const formData = request.formData();
        return formData.then(data => data.get('csrf-token') as string | null);
      } catch {
        // Ignore form data parsing errors
      }
    }

    return null;
  }

  /**
   * Middleware to protect against CSRF attacks
   */
  static async middleware(request: NextRequest): Promise<NextResponse | null> {
    const { method, pathname } = request;

    // Skip CSRF protection for safe methods and specific paths
    if (this.shouldSkipCSRFProtection(method, pathname)) {
      return null;
    }

    const token = await this.extractToken(request);
    
    if (!token || !(await this.validateToken(token))) {
      return NextResponse.json(
        { 
          error: 'CSRF token missing or invalid',
          code: 'CSRF_PROTECTION_FAILED'
        },
        { status: 403 }
      );
    }

    return null;
  }

  /**
   * Check if CSRF protection should be skipped
   */
  private static shouldSkipCSRFProtection(method: string, pathname: string): boolean {
    // Skip for safe HTTP methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(method)) {
      return true;
    }

    // Skip for webhook endpoints
    const webhookPaths = [
      '/api/webhooks/',
      '/api/auth/',
    ];
    
    if (webhookPaths.some(path => pathname.startsWith(path))) {
      return true;
    }

    return false;
  }

  /**
   * Set CSRF token in response headers and cookies
   */
  static async setTokenInResponse(response: NextResponse): Promise<NextResponse> {
    const token = await this.generateToken();
    
    // Set in header for client-side access
    response.headers.set(this.HEADER_NAME, token);
    
    // Set in cookie for automatic inclusion in requests
    response.cookies.set(this.COOKIE_NAME, token, {
      httpOnly: false, // Allow client-side access
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: this.TOKEN_LIFETIME / 1000,
      path: '/',
    });

    return response;
  }

  /**
   * Generate CSRF token for client-side use
   */
  static async generateTokenForClient(): Promise<string> {
    return await this.generateToken();
  }

  /**
   * Validate CSRF token from client request
   */
  static async validateClientToken(token: string): Promise<boolean> {
    return await this.validateToken(token);
  }

  /**
   * Create CSRF protection headers for API responses
   */
  static createProtectionHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };
  }

  /**
   * Verify request origin for additional CSRF protection
   */
  static verifyOrigin(request: NextRequest): boolean {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const host = request.headers.get('host');

    // Allow requests without origin/referer for same-origin requests
    if (!origin && !referer) {
      return true;
    }

    const allowedOrigins = [
      env.NEXT_PUBLIC_APP_URL,
      `https://${host}`,
      `http://${host}`, // For development
    ];

    if (origin && !allowedOrigins.includes(origin)) {
      return false;
    }

    if (referer) {
      const refererUrl = new URL(referer);
      const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
      
      if (!allowedOrigins.includes(refererOrigin)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Enhanced CSRF protection with origin verification
   */
  static async enhancedMiddleware(request: NextRequest): Promise<NextResponse | null> {
    // First check origin
    if (!this.verifyOrigin(request)) {
      return NextResponse.json(
        { 
          error: 'Invalid request origin',
          code: 'INVALID_ORIGIN'
        },
        { status: 403 }
      );
    }

    // Then check CSRF token
    return this.middleware(request);
  }
}