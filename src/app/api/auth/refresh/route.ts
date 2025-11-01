import { NextRequest, NextResponse } from 'next/server';
import { JWTAuthService } from '@/lib/security/jwt-auth';

export async function POST(request: NextRequest) {
  try {
    // Get refresh token from cookie or body
    let refreshToken = request.cookies.get('refresh-token')?.value;
    
    if (!refreshToken) {
      const body = await request.json();
      refreshToken = body.refreshToken;
    }

    if (!refreshToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Refresh token not provided',
        },
        { status: 400 }
      );
    }

    // Extract metadata from request
    const userAgent = request.headers.get('user-agent') || undefined;
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ipAddress = forwarded?.split(',')[0] || realIp || undefined;

    // Refresh tokens
    const tokenPair = await JWTAuthService.refreshAccessToken(refreshToken, {
      userAgent,
      ipAddress,
    });

    if (!tokenPair) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired refresh token',
        },
        { status: 401 }
      );
    }

    // Return new tokens
    const response = NextResponse.json({
      success: true,
      expiresAt: tokenPair.expiresAt,
    });

    // Update cookies with new tokens
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
    console.error('Token refresh error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Token refresh failed',
      },
      { status: 500 }
    );
  }
}