/**
 * Audit Logs API Endpoint
 * Provides access to security audit logs for authorized users
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { AuditLoggerService, AuditEventType, AuditSeverity } from '@/lib/security/audit-logger';
import { RBACService, Permission } from '@/lib/security/rbac';
import { SecurityHeadersService } from '@/lib/security/headers';
import { InputValidationService } from '@/lib/security/input-validation';
import { z } from 'zod';

const querySchema = z.object({
  eventType: z.nativeEnum(AuditEventType).optional(),
  severity: z.nativeEnum(AuditSeverity).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  userId: z.string().optional(),
  ipAddress: z.string().optional(),
  outcome: z.enum(['success', 'failure', 'blocked']).optional(),
  limit: z.coerce.number().min(1).max(1000).default(100),
  page: z.coerce.number().min(1).default(1),
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

    // Check permissions - only admins and owners can view audit logs
    const userRole = request.headers.get('x-user-role');
    if (!userRole || !RBACService.hasPermission(userRole as any, Permission.SYSTEM_LOGS)) {
      await AuditLoggerService.logEvent(AuditEventType.ACCESS_DENIED, {
        userId,
        action: 'audit_logs_access_denied',
        outcome: 'blocked',
        details: {
          requiredPermission: Permission.SYSTEM_LOGS,
          userRole,
        },
        request,
      });

      return SecurityHeadersService.createSecureResponse(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    const validation = await InputValidationService.validateRequest(queryParams, querySchema);
    if (!validation.success) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Invalid query parameters', details: validation.errors },
        { status: 400 }
      );
    }

    const filters = validation.data;

    // Convert string dates to Date objects
    const queryFilters: any = { ...filters };
    if (filters.startTime) {
      queryFilters.startTime = new Date(filters.startTime);
    }
    if (filters.endTime) {
      queryFilters.endTime = new Date(filters.endTime);
    }

    // Calculate offset for pagination
    const offset = (filters.page - 1) * filters.limit;
    queryFilters.limit = filters.limit;

    // Query audit events
    const events = AuditLoggerService.queryEvents(queryFilters);
    
    // Apply pagination
    const paginatedEvents = events.slice(offset, offset + filters.limit);
    const totalCount = events.length;
    const totalPages = Math.ceil(totalCount / filters.limit);

    // Log audit log access
    await AuditLoggerService.logEvent(AuditEventType.DATA_READ, {
      userId,
      action: 'audit_logs_accessed',
      outcome: 'success',
      resource: 'audit_logs',
      details: {
        filters: queryFilters,
        resultCount: paginatedEvents.length,
        totalCount,
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse({
      events: paginatedEvents,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        totalCount,
        totalPages,
        hasNext: filters.page < totalPages,
        hasPrev: filters.page > 1,
      },
    });

  } catch (error) {
    console.error('Audit logs query failed:', error);

    await AuditLoggerService.logEvent(AuditEventType.SYSTEM_ERROR, {
      userId: request.headers.get('x-user-id') || undefined,
      action: 'audit_logs_query_failed',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(
      { error: 'Failed to query audit logs' },
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

    // Check permissions - only system admins can export audit logs
    const userRole = request.headers.get('x-user-role');
    if (!userRole || !RBACService.hasPermission(userRole as any, Permission.SYSTEM_ADMIN)) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { filters, format = 'json' } = body;

    // Validate export request
    const exportSchema = z.object({
      filters: z.object({
        eventType: z.nativeEnum(AuditEventType).optional(),
        severity: z.nativeEnum(AuditSeverity).optional(),
        startTime: z.string().datetime().optional(),
        endTime: z.string().datetime().optional(),
        userId: z.string().optional(),
        limit: z.number().min(1).max(10000).default(1000),
      }).optional(),
      format: z.enum(['json', 'csv']).default('json'),
    });

    const validation = await InputValidationService.validateRequest(
      { filters, format },
      exportSchema
    );

    if (!validation.success) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Invalid export request', details: validation.errors },
        { status: 400 }
      );
    }

    const { filters: exportFilters, format: exportFormat } = validation.data;

    // Convert string dates to Date objects
    const queryFilters: any = { ...exportFilters };
    if (exportFilters?.startTime) {
      queryFilters.startTime = new Date(exportFilters.startTime);
    }
    if (exportFilters?.endTime) {
      queryFilters.endTime = new Date(exportFilters.endTime);
    }

    // Export audit logs
    const exportData = AuditLoggerService.exportLogs(queryFilters, exportFormat);

    // Log export action
    await AuditLoggerService.logEvent(AuditEventType.DATA_EXPORT, {
      userId,
      action: 'audit_logs_exported',
      outcome: 'success',
      resource: 'audit_logs',
      details: {
        format: exportFormat,
        filters: queryFilters,
        exportSize: exportData.length,
      },
      request,
    });

    const contentType = exportFormat === 'csv' ? 'text/csv' : 'application/json';
    const filename = `audit_logs_${new Date().toISOString().split('T')[0]}.${exportFormat}`;

    return new Response(exportData, {
      status: 200,
      headers: {
        ...SecurityHeadersService.getFileUploadHeaders(),
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Audit logs export failed:', error);

    await AuditLoggerService.logEvent(AuditEventType.SYSTEM_ERROR, {
      userId: request.headers.get('x-user-id') || undefined,
      action: 'audit_logs_export_failed',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(
      { error: 'Failed to export audit logs' },
      { status: 500 }
    );
  }
}