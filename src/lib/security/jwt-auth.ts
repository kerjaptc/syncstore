/**
 * JWT Authentication Service
 * Implements JWT token management with refresh token rotation
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { NextRequest } from 'next/server';
import { env } from '@/env';
import { randomBytes } from 'crypto';

interface TokenPayload extends JWTPayload {
  userId: string;
  organizationId: string;
  role: string;
  sessionId: string;
  tokenType: 'access' | 'refresh';
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface RefreshTokenData {
  userId: string;
  organizationId: string;
  role: string;
  sessionId: string;
  createdAt: number;
  lastUsed: number;
  isRevoked: boolean;
}

export class JWTAuthService {
  private static readonly ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
  private static readonly REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days
  private static readonly ALGORITHM = 'HS256';
  
  // Database-backed token storage
  private static async getRefreshTokenData(sessionId: string): Promise<RefreshTokenData | null> {
    try {
      const { db } = await import('@/lib/db');
      const { refreshTokens } = await import('@/lib/db/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const result = await db
        .select()
        .from(refreshTokens)
        .where(
          and(
            eq(refreshTokens.sessionId, sessionId),
            eq(refreshTokens.isRevoked, false)
          )
        )
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const token = result[0];
      return {
        userId: token.userId,
        organizationId: token.organizationId,
        role: 'member', // We'll need to join with users table to get role
        sessionId: token.sessionId,
        createdAt: Math.floor(token.createdAt.getTime() / 1000),
        lastUsed: token.lastUsedAt ? Math.floor(token.lastUsedAt.getTime() / 1000) : Math.floor(token.createdAt.getTime() / 1000),
        isRevoked: token.isRevoked,
      };
    } catch (error) {
      console.error('Error fetching refresh token data:', error);
      return null;
    }
  }

  private static async updateRefreshTokenLastUsed(sessionId: string): Promise<void> {
    try {
      const { db } = await import('@/lib/db');
      const { refreshTokens } = await import('@/lib/db/schema');
      const { eq } = await import('drizzle-orm');
      
      await db
        .update(refreshTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(refreshTokens.sessionId, sessionId));
    } catch (error) {
      console.error('Error updating refresh token last used:', error);
    }
  }

  private static async isTokenRevoked(token: string): Promise<boolean> {
    try {
      const { db } = await import('@/lib/db');
      const { revokedTokens } = await import('@/lib/db/schema');
      const { eq, gt } = await import('drizzle-orm');
      const { createHash } = await import('crypto');
      
      const tokenHash = createHash('sha256').update(token).digest('hex');
      
      const result = await db
        .select()
        .from(revokedTokens)
        .where(
          and(
            eq(revokedTokens.tokenHash, tokenHash),
            gt(revokedTokens.expiresAt, new Date())
          )
        )
        .limit(1);

      return result.length > 0;
    } catch (error) {
      console.error('Error checking token revocation:', error);
      return false;
    }
  }

  private static async revokeToken(token: string, reason: string = 'manual'): Promise<void> {
    try {
      const { db } = await import('@/lib/db');
      const { revokedTokens } = await import('@/lib/db/schema');
      const { createHash } = await import('crypto');
      
      // Decode token to get expiry and user info
      const payload = await this.verifyToken(token);
      if (!payload) return;

      const tokenHash = createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(payload.exp! * 1000);
      
      await db.insert(revokedTokens).values({
        tokenHash,
        userId: payload.userId,
        expiresAt,
        reason,
      }).onConflictDoNothing();
    } catch (error) {
      console.error('Error revoking token:', error);
    }
  }

  /**
   * Get JWT secret as Uint8Array
   */
  private static getSecret(): Uint8Array {
    return new TextEncoder().encode(env.ENCRYPTION_KEY);
  }

  /**
   * Generate a unique session ID
   */
  private static generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Create access token
   */
  static async createAccessToken(payload: {
    userId: string;
    organizationId: string;
    role: string;
    sessionId: string;
  }): Promise<string> {
    const secret = this.getSecret();
    const now = Math.floor(Date.now() / 1000);

    return await new SignJWT({
      ...payload,
      tokenType: 'access',
    })
      .setProtectedHeader({ alg: this.ALGORITHM })
      .setIssuedAt(now)
      .setExpirationTime(now + this.ACCESS_TOKEN_EXPIRY)
      .setIssuer('storesync')
      .setAudience('storesync-api')
      .sign(secret);
  }

  /**
   * Create refresh token
   */
  static async createRefreshToken(payload: {
    userId: string;
    organizationId: string;
    role: string;
    sessionId: string;
  }, metadata?: {
    userAgent?: string;
    ipAddress?: string;
  }): Promise<string> {
    const secret = this.getSecret();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = new Date((now + this.REFRESH_TOKEN_EXPIRY) * 1000);

    const refreshToken = await new SignJWT({
      ...payload,
      tokenType: 'refresh',
    })
      .setProtectedHeader({ alg: this.ALGORITHM })
      .setIssuedAt(now)
      .setExpirationTime(now + this.REFRESH_TOKEN_EXPIRY)
      .setIssuer('storesync')
      .setAudience('storesync-api')
      .sign(secret);

    // Store refresh token in database
    try {
      const { db } = await import('@/lib/db');
      const { refreshTokens } = await import('@/lib/db/schema');
      const { createHash } = await import('crypto');
      
      const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
      
      await db.insert(refreshTokens).values({
        sessionId: payload.sessionId,
        userId: payload.userId,
        organizationId: payload.organizationId,
        tokenHash,
        expiresAt,
        userAgent: metadata?.userAgent,
        ipAddress: metadata?.ipAddress,
      });
    } catch (error) {
      console.error('Failed to store refresh token:', error);
      // Continue anyway - token will work but won't be tracked in DB
    }

    return refreshToken;
  }

  /**
   * Create token pair (access + refresh)
   */
  static async createTokenPair(payload: {
    userId: string;
    organizationId: string;
    role: string;
  }, metadata?: {
    userAgent?: string;
    ipAddress?: string;
  }): Promise<TokenPair> {
    const sessionId = this.generateSessionId();
    const tokenPayload = { ...payload, sessionId };

    const [accessToken, refreshToken] = await Promise.all([
      this.createAccessToken(tokenPayload),
      this.createRefreshToken(tokenPayload, metadata),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + (this.ACCESS_TOKEN_EXPIRY * 1000),
    };
  }

  /**
   * Verify and decode JWT token
   */
  static async verifyToken(token: string): Promise<TokenPayload | null> {
    try {
      // Check if token is revoked in database
      const isRevoked = await this.isTokenRevoked(token);
      if (isRevoked) {
        return null;
      }

      const secret = this.getSecret();
      const { payload } = await jwtVerify(token, secret, {
        issuer: 'storesync',
        audience: 'storesync-api',
      });

      return payload as TokenPayload;
    } catch (error) {
      console.error('JWT verification failed:', error);
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(refreshToken: string, metadata?: {
    userAgent?: string;
    ipAddress?: string;
  }): Promise<TokenPair | null> {
    try {
      const payload = await this.verifyToken(refreshToken);
      
      if (!payload || payload.tokenType !== 'refresh') {
        return null;
      }

      // Check if refresh token exists and is not revoked in database
      const refreshData = await this.getRefreshTokenData(payload.sessionId);
      if (!refreshData || refreshData.isRevoked) {
        return null;
      }

      // Update last used timestamp
      await this.updateRefreshTokenLastUsed(payload.sessionId);

      // Create new token pair with same session ID
      const newTokenPair = await this.createTokenPair({
        userId: payload.userId,
        organizationId: payload.organizationId,
        role: payload.role,
      }, metadata);

      // Revoke old refresh token
      await this.revokeToken(refreshToken, 'refresh');

      return newTokenPair;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }

  /**
   * Revoke refresh token by session ID
   */
  static async revokeRefreshToken(sessionId: string): Promise<void> {
    try {
      const { db } = await import('@/lib/db');
      const { refreshTokens } = await import('@/lib/db/schema');
      const { eq } = await import('drizzle-orm');
      
      await db
        .update(refreshTokens)
        .set({ isRevoked: true })
        .where(eq(refreshTokens.sessionId, sessionId));
    } catch (error) {
      console.error('Error revoking refresh token:', error);
    }
  }

  /**
   * Revoke all tokens for a user
   */
  static async revokeAllUserTokens(userId: string): Promise<void> {
    try {
      const { db } = await import('@/lib/db');
      const { refreshTokens } = await import('@/lib/db/schema');
      const { eq } = await import('drizzle-orm');
      
      await db
        .update(refreshTokens)
        .set({ isRevoked: true })
        .where(eq(refreshTokens.userId, userId));
    } catch (error) {
      console.error('Error revoking all user tokens:', error);
    }
  }

  /**
   * Extract token from request
   */
  static extractTokenFromRequest(request: NextRequest): string | null {
    // Try Authorization header first
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try cookie as fallback
    const cookieToken = request.cookies.get('access-token')?.value;
    if (cookieToken) {
      return cookieToken;
    }

    return null;
  }

  /**
   * Authenticate request and return user info
   */
  static async authenticateRequest(request: NextRequest): Promise<{
    success: boolean;
    user?: {
      userId: string;
      organizationId: string;
      role: string;
      sessionId: string;
    };
    error?: string;
  }> {
    const token = this.extractTokenFromRequest(request);
    
    if (!token) {
      return { success: false, error: 'No authentication token provided' };
    }

    const payload = await this.verifyToken(token);
    
    if (!payload || payload.tokenType !== 'access') {
      return { success: false, error: 'Invalid or expired token' };
    }

    return {
      success: true,
      user: {
        userId: payload.userId,
        organizationId: payload.organizationId,
        role: payload.role,
        sessionId: payload.sessionId,
      },
    };
  }

  /**
   * Check if user has required role
   */
  static hasRole(userRole: string, requiredRole: string): boolean {
    const roleHierarchy = {
      'viewer': 0,
      'member': 1,
      'admin': 2,
      'owner': 3,
    };

    const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] ?? -1;
    const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] ?? 999;

    return userLevel >= requiredLevel;
  }

  /**
   * Middleware for JWT authentication
   */
  static createAuthMiddleware(options: {
    requiredRole?: string;
    optional?: boolean;
  } = {}) {
    return async (request: NextRequest) => {
      const auth = await this.authenticateRequest(request);

      if (!auth.success) {
        if (options.optional) {
          return null; // Allow request to continue without auth
        }
        
        return new Response(
          JSON.stringify({ 
            error: auth.error || 'Authentication required',
            code: 'AUTHENTICATION_REQUIRED'
          }),
          { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Check role if required
      if (options.requiredRole && !this.hasRole(auth.user!.role, options.requiredRole)) {
        return new Response(
          JSON.stringify({ 
            error: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            required: options.requiredRole,
            current: auth.user!.role,
          }),
          { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Add user info to request headers for downstream handlers
      const response = new Response(null);
      response.headers.set('x-user-id', auth.user!.userId);
      response.headers.set('x-organization-id', auth.user!.organizationId);
      response.headers.set('x-user-role', auth.user!.role);
      response.headers.set('x-session-id', auth.user!.sessionId);

      return null; // Allow request to continue
    };
  }

  /**
   * Clean up expired tokens
   */
  static async cleanupExpiredTokens(): Promise<void> {
    try {
      const { db } = await import('@/lib/db');
      const { refreshTokens, revokedTokens } = await import('@/lib/db/schema');
      const { lt } = await import('drizzle-orm');
      
      const now = new Date();
      
      // Delete expired refresh tokens
      await db
        .delete(refreshTokens)
        .where(lt(refreshTokens.expiresAt, now));
      
      // Delete expired revoked tokens
      await db
        .delete(revokedTokens)
        .where(lt(revokedTokens.expiresAt, now));
        
    } catch (error) {
      console.error('Error cleaning up expired tokens:', error);
    }
  }

  /**
   * Get token statistics
   */
  static async getTokenStats(): Promise<{
    activeRefreshTokens: number;
    revokedRefreshTokens: number;
    expiredRefreshTokens: number;
    revokedAccessTokens: number;
  }> {
    try {
      const { db } = await import('@/lib/db');
      const { refreshTokens, revokedTokens } = await import('@/lib/db/schema');
      const { eq, lt, and, count } = await import('drizzle-orm');
      
      const now = new Date();
      
      const [
        activeRefreshResult,
        revokedRefreshResult,
        expiredRefreshResult,
        revokedAccessResult,
      ] = await Promise.all([
        db
          .select({ count: count() })
          .from(refreshTokens)
          .where(
            and(
              eq(refreshTokens.isRevoked, false),
              lt(now, refreshTokens.expiresAt)
            )
          ),
        db
          .select({ count: count() })
          .from(refreshTokens)
          .where(eq(refreshTokens.isRevoked, true)),
        db
          .select({ count: count() })
          .from(refreshTokens)
          .where(
            and(
              eq(refreshTokens.isRevoked, false),
              lt(refreshTokens.expiresAt, now)
            )
          ),
        db
          .select({ count: count() })
          .from(revokedTokens)
          .where(lt(now, revokedTokens.expiresAt)),
      ]);

      return {
        activeRefreshTokens: activeRefreshResult[0]?.count || 0,
        revokedRefreshTokens: revokedRefreshResult[0]?.count || 0,
        expiredRefreshTokens: expiredRefreshResult[0]?.count || 0,
        revokedAccessTokens: revokedAccessResult[0]?.count || 0,
      };
    } catch (error) {
      console.error('Error getting token stats:', error);
      return {
        activeRefreshTokens: 0,
        revokedRefreshTokens: 0,
        expiredRefreshTokens: 0,
        revokedAccessTokens: 0,
      };
    }
  }

  /**
   * Validate token format without verification
   */
  static isValidTokenFormat(token: string): boolean {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    // Each part should be base64url encoded
    try {
      parts.forEach(part => {
        if (!part || part.length === 0) {
          throw new Error('Empty part');
        }
        // Basic base64url validation
        if (!/^[A-Za-z0-9_-]+$/.test(part)) {
          throw new Error('Invalid characters');
        }
      });
      return true;
    } catch {
      return false;
    }
  }
}

// Start cleanup interval (only on server)
if (typeof window === 'undefined') {
  let cleanupInterval: NodeJS.Timeout;
  
  const startCleanup = () => {
    cleanupInterval = setInterval(async () => {
      try {
        await JWTAuthService.cleanupExpiredTokens();
      } catch (error) {
        console.error('Token cleanup failed:', error);
      }
    }, 60 * 60 * 1000); // Clean up every hour
  };

  // Start cleanup
  startCleanup();

  // Clean up interval on process exit
  process.on('SIGINT', () => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
    }
  });

  process.on('SIGTERM', () => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
    }
  });
}