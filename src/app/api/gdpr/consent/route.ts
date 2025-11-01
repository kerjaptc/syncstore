/**
 * GDPR Consent Management API
 * Handles user consent recording and retrieval
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GDPRComplianceService, ConsentType } from '@/lib/security/gdpr-compliance';
import { SecurityHeadersService } from '@/lib/security/headers';
import { InputValidationService } from '@/lib/security/input-validation';
import { AuditLoggerService, AuditEventType } from '@/lib/security/audit-logger';
import { z } from 'zod';

const consentSchema = z.object({
  consentType: z.nativeEnum(ConsentType),
  granted: z.boolean(),
  policyVersion: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's consent records
    const consents = GDPRComplianceService.getUserConsent(userId);

    // Log consent access
    await AuditLoggerService.logEvent(AuditEventType.DATA_READ, {
      userId,
      action: 'consent_records_accessed',
      outcome: 'success',
      resource: 'gdpr_consent',
      details: {
        consentCount: consents.length,
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse({
      consents: consents.map(consent => ({
        id: consent.id,
        consentType: consent.consentType,
        granted: consent.granted,
        timestamp: consent.timestamp,
        version: consent.version,
        expiresAt: consent.expiresAt,
      })),
    });

  } catch (error) {
    console.error('Consent retrieval failed:', error);

    await AuditLoggerService.logEvent(AuditEventType.SYSTEM_ERROR, {
      userId: request.headers.get('x-user-id') || undefined,
      action: 'consent_retrieval_failed',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(
      { error: 'Failed to retrieve consent records' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = await InputValidationService.validateRequest(body, consentSchema);

    if (!validation.success) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Invalid consent data', details: validation.errors },
        { status: 400 }
      );
    }

    const { consentType, granted, policyVersion } = validation.data;

    // Extract client information
    const ipAddress = request.ip || 
                     request.headers.get('x-forwarded-for')?.split(',')[0] || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Record consent
    const consentRecord = await GDPRComplianceService.recordConsent(
      userId,
      consentType,
      granted,
      {
        ipAddress,
        userAgent,
        policyVersion,
        // Set expiration for non-essential consents (2 years)
        expiresAt: consentType !== ConsentType.ESSENTIAL 
          ? new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000)
          : undefined,
      }
    );

    // Log consent recording
    await AuditLoggerService.logEvent(AuditEventType.DATA_CREATE, {
      userId,
      action: 'consent_recorded',
      outcome: 'success',
      resource: 'gdpr_consent',
      resourceId: consentRecord.id,
      details: {
        consentType,
        granted,
        policyVersion,
        ipAddress,
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse({
      success: true,
      consent: {
        id: consentRecord.id,
        consentType: consentRecord.consentType,
        granted: consentRecord.granted,
        timestamp: consentRecord.timestamp,
        version: consentRecord.version,
        expiresAt: consentRecord.expiresAt,
      },
    });

  } catch (error) {
    console.error('Consent recording failed:', error);

    await AuditLoggerService.logEvent(AuditEventType.SYSTEM_ERROR, {
      userId: request.headers.get('x-user-id') || undefined,
      action: 'consent_recording_failed',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(
      { error: 'Failed to record consent' },
      { status: 500 }
    );
  }
}