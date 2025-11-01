/**
 * GDPR Data Export API
 * Handles user data export requests
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GDPRComplianceService } from '@/lib/security/gdpr-compliance';
import { SecurityHeadersService } from '@/lib/security/headers';
import { InputValidationService } from '@/lib/security/input-validation';
import { AuditLoggerService, AuditEventType } from '@/lib/security/audit-logger';
import { z } from 'zod';

const exportRequestSchema = z.object({
  format: z.enum(['json', 'csv', 'xml']).default('json'),
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

    const organizationId = request.headers.get('x-organization-id');
    if (!organizationId) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    // Get user's export requests
    // In a real implementation, you'd query the database for export requests
    const exportRequests = []; // Placeholder

    // Log export requests access
    await AuditLoggerService.logEvent(AuditEventType.DATA_READ, {
      userId,
      organizationId,
      action: 'export_requests_accessed',
      outcome: 'success',
      resource: 'gdpr_export_requests',
      details: {
        requestCount: exportRequests.length,
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse({
      exportRequests,
    });

  } catch (error) {
    console.error('Export requests retrieval failed:', error);

    await AuditLoggerService.logEvent(AuditEventType.SYSTEM_ERROR, {
      userId: request.headers.get('x-user-id') || undefined,
      action: 'export_requests_retrieval_failed',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(
      { error: 'Failed to retrieve export requests' },
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

    const organizationId = request.headers.get('x-organization-id');
    if (!organizationId) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = await InputValidationService.validateRequest(body, exportRequestSchema);

    if (!validation.success) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Invalid export request', details: validation.errors },
        { status: 400 }
      );
    }

    const { format } = validation.data;

    // Check if user already has a pending export request
    // In a real implementation, you'd check the database
    const hasPendingRequest = false; // Placeholder

    if (hasPendingRequest) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'You already have a pending export request' },
        { status: 409 }
      );
    }

    // Create export request
    const exportRequest = await GDPRComplianceService.requestDataExport(
      userId,
      organizationId,
      format
    );

    // Log export request
    await AuditLoggerService.logEvent(AuditEventType.DATA_EXPORT, {
      userId,
      organizationId,
      action: 'data_export_requested',
      outcome: 'success',
      resource: 'gdpr_data_export',
      resourceId: exportRequest.id,
      details: {
        format,
        requestId: exportRequest.id,
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse({
      success: true,
      exportRequest: {
        id: exportRequest.id,
        status: exportRequest.status,
        requestedAt: exportRequest.requestedAt,
        format: exportRequest.format,
        estimatedCompletionTime: '24 hours',
      },
      message: 'Data export request submitted successfully. You will be notified when it\'s ready.',
    });

  } catch (error) {
    console.error('Data export request failed:', error);

    await AuditLoggerService.logEvent(AuditEventType.SYSTEM_ERROR, {
      userId: request.headers.get('x-user-id') || undefined,
      action: 'data_export_request_failed',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(
      { error: 'Failed to create data export request' },
      { status: 500 }
    );
  }
}