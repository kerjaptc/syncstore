/**
 * CSRF Token API Endpoint
 * Provides CSRF tokens for client-side requests
 */

import { NextRequest } from 'next/server';
import { CSRFProtectionService } from '@/lib/security/csrf-protection';
import { SecurityHeadersService } from '@/lib/security/headers';
import { AuditLoggerService, AuditEventType } from '@/lib/security/audit-logger';

export async function GET(request: NextRequest) {
  try {
    // Generate CSRF token
    const token = await CSRFProtectionService.generateTokenForClient();

    // Log token generation
    await AuditLoggerService.logEvent(AuditEventType.TOKEN_REFRESH, {
      action: 'csrf_token_generated',
      outcome: 'success',
      details: {
        tokenLength: token.length,
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(
      { 
        token,
        expiresIn: 3600, // 1 hour
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('CSRF token generation failed:', error);

    await AuditLoggerService.logEvent(AuditEventType.SYSTEM_ERROR, {
      action: 'csrf_token_generation_failed',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Validate CSRF token
    const isValid = await CSRFProtectionService.validateClientToken(token);

    // Log validation attempt
    await AuditLoggerService.logEvent(AuditEventType.TOKEN_REFRESH, {
      action: 'csrf_token_validated',
      outcome: isValid ? 'success' : 'failure',
      details: {
        tokenValid: isValid,
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(
      { 
        valid: isValid,
        message: isValid ? 'Token is valid' : 'Token is invalid or expired',
      },
      { status: isValid ? 200 : 400 }
    );

  } catch (error) {
    console.error('CSRF token validation failed:', error);

    await AuditLoggerService.logEvent(AuditEventType.SYSTEM_ERROR, {
      action: 'csrf_token_validation_failed',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(
      { error: 'Failed to validate CSRF token' },
      { status: 500 }
    );
  }
}