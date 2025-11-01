import { NextRequest, NextResponse } from 'next/server';
import { JWTAuthService } from '@/lib/security/jwt-auth';

export async function POST(request: NextRequest) {
  try {
    // Get tokens from cookies or headers
    const accessToken = request.cookies.get('access-token')?.value || 
                       JWTAuthService.extractTokenFromRequest(request);
    const refreshToken = request.cookies.get('refresh-token')?.value;

    // Verify access token to get session info
    if (accessToken) {
      const payload = await JWTAuthService.verifyToken(accessToken);
      
      if (payload && payload.sessionId) {
        // Revoke refresh token by session ID
        await JWTAuthService.revokeRefreshToken(payload.sessionId);
      }
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    // Clear cookies
    response.cookies.delete('access-token');
    response.cookies.delete('refresh-token');

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    
    // Even if there's an error, clear cookies and return success
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    response.cookies.delete('access-token');
    response.cookies.delete('refresh-token');

    return response;
  }
}

export async function DELETE(request: NextRequest) {
  // Support DELETE method for logout as well
  return POST(request);
}