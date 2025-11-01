/**
 * Data Retention Management API
 * Provides access to data retention policies and jobs
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DataRetentionService, DataCategory, RetentionPeriod } from '@/lib/security/data-retention';
import { RBACService, Permission } from '@/lib/security/rbac';
import { SecurityHeadersService } from '@/lib/security/headers';
import { InputValidationService } from '@/lib/security/input-validation';
import { AuditLoggerService, AuditEventType } from '@/lib/security/audit-logger';
import { z } from 'zod';

const retentionPolicySchema = z.object({
  id: z.string().min(1),
  dataCategory: z.nativeEnum(DataCategory),
  retentionPeriod: z.nativeEnum(RetentionPeriod),
  reason: z.string().min(1),
  description: z.string().min(1),
  autoDelete: z.boolean().default(false),
  requiresApproval: z.boolean().default(true),
  notificationDays: z.number().min(0).default(30),
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

    // Check permissions - only admins can view retention policies
    const userRole = request.headers.get('x-user-role');
    if (!userRole || !RBACService.hasPermission(userRole as any, Permission.SYSTEM_ADMIN)) {
      await AuditLoggerService.logEvent(AuditEventType.ACCESS_DENIED, {
        userId,
        action: 'data_retention_access_denied',
        outcome: 'blocked',
        details: {
          requiredPermission: Permission.SYSTEM_ADMIN,
          userRole,
        },
        request,
      });

      return SecurityHeadersService.createSecureResponse(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get query parameters
    const url = new URL(request.url);
    const includeJobs = url.searchParams.get('includeJobs') === 'true';
    const dataCategory = url.searchParams.get('dataCategory') as DataCategory;

    // Get retention policies
    const policies = DataRetentionService.getDLPRules ? 
      DataRetentionService.getDLPRules() : 
      []; // Fallback if method doesn't exist

    // Get retention statistics
    const statistics = DataRetentionService.getRetentionStatistics();

    let jobs = [];
    if (includeJobs) {
      jobs = DataRetentionService.getRetentionJobs({
        dataCategory,
        limit: 50,
      });
    }

    // Log access
    await AuditLoggerService.logEvent(AuditEventType.DATA_READ, {
      userId,
      action: 'data_retention_policies_accessed',
      outcome: 'success',
      resource: 'data_retention',
      details: {
        policiesCount: policies.length,
        includeJobs,
        dataCategory,
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse({
      policies,
      statistics,
      jobs: includeJobs ? jobs : undefined,
    });

  } catch (error) {
    console.error('Data retention query failed:', error);

    await AuditLoggerService.logEvent(AuditEventType.SYSTEM_ERROR, {
      userId: request.headers.get('x-user-id') || undefined,
      action: 'data_retention_query_failed',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(
      { error: 'Failed to query data retention policies' },
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

    // Check permissions - only system admins can create retention policies
    const userRole = request.headers.get('x-user-role');
    if (!userRole || !RBACService.hasPermission(userRole as any, Permission.SYSTEM_ADMIN)) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = await InputValidationService.validateRequest(body, retentionPolicySchema);

    if (!validation.success) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Invalid retention policy data', details: validation.errors },
        { status: 400 }
      );
    }

    const policyData = validation.data;

    // Create retention policy
    const policy = {
      ...policyData,
      enabled: true,
    };

    DataRetentionService.setRetentionPolicy(policy as any);

    // Log policy creation
    await AuditLoggerService.logEvent(AuditEventType.DATA_CREATE, {
      userId,
      action: 'retention_policy_created',
      outcome: 'success',
      resource: 'data_retention',
      resourceId: policy.id,
      details: {
        dataCategory: policy.dataCategory,
        retentionPeriod: policy.retentionPeriod,
        autoDelete: policy.autoDelete,
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse({
      success: true,
      policy,
      message: 'Retention policy created successfully',
    });

  } catch (error) {
    console.error('Retention policy creation failed:', error);

    await AuditLoggerService.logEvent(AuditEventType.SYSTEM_ERROR, {
      userId: request.headers.get('x-user-id') || undefined,
      action: 'retention_policy_creation_failed',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(
      { error: 'Failed to create retention policy' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check permissions
    const userRole = request.headers.get('x-user-role');
    if (!userRole || !RBACService.hasPermission(userRole as any, Permission.SYSTEM_ADMIN)) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = await InputValidationService.validateRequest(body, retentionPolicySchema);

    if (!validation.success) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Invalid retention policy data', details: validation.errors },
        { status: 400 }
      );
    }

    const policyData = validation.data;

    // Update retention policy
    const policy = {
      ...policyData,
      enabled: true,
    };

    DataRetentionService.setRetentionPolicy(policy as any);

    // Log policy update
    await AuditLoggerService.logEvent(AuditEventType.DATA_UPDATE, {
      userId,
      action: 'retention_policy_updated',
      outcome: 'success',
      resource: 'data_retention',
      resourceId: policy.id,
      details: {
        dataCategory: policy.dataCategory,
        retentionPeriod: policy.retentionPeriod,
        autoDelete: policy.autoDelete,
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse({
      success: true,
      policy,
      message: 'Retention policy updated successfully',
    });

  } catch (error) {
    console.error('Retention policy update failed:', error);

    await AuditLoggerService.logEvent(AuditEventType.SYSTEM_ERROR, {
      userId: request.headers.get('x-user-id') || undefined,
      action: 'retention_policy_update_failed',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(
      { error: 'Failed to update retention policy' },
      { status: 500 }
    );
  }
}