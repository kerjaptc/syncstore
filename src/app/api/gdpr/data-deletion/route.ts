/**
 * GDPR Data Deletion API
 * Handles user data deletion requests (Right to be Forgotten)
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GDPRComplianceService } from '@/lib/security/gdpr-compliance';
import { SecurityHeadersService } from '@/lib/security/headers';
import { InputValidationService } from '@/lib/security/input-validation';
import { AuditLoggerService, AuditEventType } from '@/lib/security/audit-logger';
import { z } from 'zod';

const deletionRequestSchema = z.object({
  deletionType: z.enum(['soft', 'hard']).default('soft'),
  scheduledFor: z.string().datetime().optional(),
  reason: z.string().max(500).optional(),
  confirmationText: z.string().refine(
    (text) => text === 'DELETE MY DATA',
    'You must type "DELETE MY DATA" to confirm'
  ),
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

    // Get user's deletion requests
    // In a real implementation, you'd query the database for deletion requests
    const deletionRequests = []; // Placeholder

    // Log deletion requests access
    await AuditLoggerService.logEvent(AuditEventType.DATA_READ, {
      userId,
      organizationId,
      action: 'deletion_requests_accessed',
      outcome: 'success',
      resource: 'gdpr_deletion_requests',
      details: {
        requestCount: deletionRequests.length,
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse({
      deletionRequests,
      dataRetentionInfo: {
        message: 'Some data may be retained for legal compliance purposes',
        retentionPeriods: {
          financialRecords: '7 years (legal requirement)',
          activeOrders: 'Until order completion',
          legalDisputes: 'Until resolution',
        },
      },
    });

  } catch (error) {
    console.error('Deletion requests retrieval failed:', error);

    await AuditLoggerService.logEvent(AuditEventType.SYSTEM_ERROR, {
      userId: request.headers.get('x-user-id') || undefined,
      action: 'deletion_requests_retrieval_failed',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(
      { error: 'Failed to retrieve deletion requests' },
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
    const validation = await InputValidationService.validateRequest(body, deletionRequestSchema);

    if (!validation.success) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Invalid deletion request', details: validation.errors },
        { status: 400 }
      );
    }

    const { deletionType, scheduledFor, reason } = validation.data;

    // Check if user already has a pending deletion request
    // In a real implementation, you'd check the database
    const hasPendingRequest = false; // Placeholder

    if (hasPendingRequest) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'You already have a pending deletion request' },
        { status: 409 }
      );
    }

    // Parse scheduled date if provided
    const scheduledDate = scheduledFor ? new Date(scheduledFor) : undefined;

    // Validate scheduled date (must be at least 24 hours in the future for cooling-off period)
    if (scheduledDate && scheduledDate.getTime() < Date.now() + 24 * 60 * 60 * 1000) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Deletion must be scheduled at least 24 hours in the future' },
        { status: 400 }
      );
    }

    // Create deletion request
    const deletionRequest = await GDPRComplianceService.requestDataDeletion(
      userId,
      organizationId,
      deletionType,
      scheduledDate
    );

    // Log deletion request
    await AuditLoggerService.logEvent(AuditEventType.DATA_DELETE, {
      userId,
      organizationId,
      action: 'data_deletion_requested',
      outcome: 'success',
      resource: 'gdpr_data_deletion',
      resourceId: deletionRequest.id,
      details: {
        deletionType,
        scheduledFor: deletionRequest.scheduledFor,
        reason,
        requestId: deletionRequest.id,
      },
      request,
    });

    // Send confirmation email (in production)
    // await sendDeletionConfirmationEmail(userId, deletionRequest);

    return SecurityHeadersService.createSecureResponse({
      success: true,
      deletionRequest: {
        id: deletionRequest.id,
        status: deletionRequest.status,
        requestedAt: deletionRequest.requestedAt,
        scheduledFor: deletionRequest.scheduledFor,
        deletionType: deletionRequest.deletionType,
      },
      message: deletionType === 'hard' 
        ? 'Hard deletion request submitted. Your data will be permanently deleted on the scheduled date.'
        : 'Soft deletion request submitted. Your personal data will be anonymized on the scheduled date.',
      coolingOffPeriod: {
        message: 'You can cancel this request within 24 hours of the scheduled deletion time.',
        cancelEndpoint: `/api/gdpr/data-deletion/${deletionRequest.id}/cancel`,
      },
    });

  } catch (error) {
    console.error('Data deletion request failed:', error);

    await AuditLoggerService.logEvent(AuditEventType.SYSTEM_ERROR, {
      userId: request.headers.get('x-user-id') || undefined,
      action: 'data_deletion_request_failed',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(
      { error: 'Failed to create data deletion request' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get request ID from URL
    const url = new URL(request.url);
    const requestId = url.searchParams.get('requestId');

    if (!requestId) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Request ID is required' },
        { status: 400 }
      );
    }

    // Cancel deletion request
    // In a real implementation, you'd update the database
    console.log(`Cancelling deletion request ${requestId} for user ${userId}`);

    // Log deletion cancellation
    await AuditLoggerService.logEvent(AuditEventType.DATA_UPDATE, {
      userId,
      action: 'data_deletion_cancelled',
      outcome: 'success',
      resource: 'gdpr_data_deletion',
      resourceId: requestId,
      details: {
        requestId,
        cancelledAt: new Date().toISOString(),
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse({
      success: true,
      message: 'Data deletion request has been cancelled successfully.',
    });

  } catch (error) {
    console.error('Deletion cancellation failed:', error);

    await AuditLoggerService.logEvent(AuditEventType.SYSTEM_ERROR, {
      userId: request.headers.get('x-user-id') || undefined,
      action: 'data_deletion_cancellation_failed',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(
      { error: 'Failed to cancel deletion request' },
      { status: 500 }
    );
  }
}