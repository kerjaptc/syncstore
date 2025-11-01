import { NextRequest, NextResponse } from 'next/server';
import { JWTAuthService } from '@/lib/security/jwt-auth';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';
import { rateLimiters } from '@/lib/middleware/rate-limit';

const loginSchema = z.object({
  // For JWT-based login, we might need additional fields
  // For now, we'll use Clerk authentication as the source of truth
});

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting for auth endpoints
    const rateLimitResponse = await rateLimiters.auth(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Get authenticated user from Clerk
    const user = await requireAuth();
    
    // Extract metadata from request
    const userAgent = request.headers.get('user-agent') || undefined;
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ipAddress = forwarded?.split(',')[0] || realIp || undefined;

    // Create JWT token pair
    const tokenPair = await JWTAuthService.createTokenPair(
      {
        userId: user.id,
        organizationId: user.organizationId,
        role: user.role,
      },
      {
        userAgent,
        ipAddress,
      }
    );

    // Set secure cookies
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        organizationId: user.organizationId,
        role: user.role,
      },
      expiresAt: tokenPair.expiresAt,
    });

    // Set HTTP-only cookies for tokens
    response.cookies.set('access-token', tokenPair.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60, // 15 minutes
      path: '/',
    });

    response.cookies.set('refresh-token', tokenPair.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication failed',
      },
      { status: 401 }
    );
  }
}