/**
 * Data Loss Prevention (DLP) Management API
 * Provides access to DLP rules, violations, and statistics
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DataLossPreventionService, DLPRuleType, DLPAction } from '@/lib/security/data-loss-prevention';
import { RBACService, Permission } from '@/lib/security/rbac';
import { SecurityHeadersService } from '@/lib/security/headers';
import { InputValidationService } from '@/lib/security/input-validation';
import { AuditLoggerService, AuditEventType, AuditSeverity } from '@/lib/security/audit-logger';
import { z } from 'zod';

const dlpRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.nativeEnum(DLPRuleType),
  pattern: z.string().min(1),
  action: z.nativeEnum(DLPAction),
  severity: z.nativeEnum(AuditSeverity),
  description: z.string().min(1),
  enabled: z.boolean().default(true),
});

const scanRequestSchema = z.object({
  content: z.string().min(1),
  location: z.string().min(1),
  dataClassification: z.enum(['public', 'internal', 'confidential', 'restricted']).optional(),
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

    // Check permissions - only admins can view DLP data
    const userRole = request.headers.get('x-user-role');
    if (!userRole || !RBACService.hasPermission(userRole as any, Permission.SYSTEM_MONITORING)) {
      await AuditLoggerService.logEvent(AuditEventType.ACCESS_DENIED, {
        userId,
        action: 'dlp_data_access_denied',
        outcome: 'blocked',
        details: {
          requiredPermission: Permission.SYSTEM_MONITORING,
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
    const includeViolations = url.searchParams.get('includeViolations') === 'true';
    const includeStats = url.searchParams.get('includeStats') === 'true';
    const timeWindow = parseInt(url.searchParams.get('timeWindow') || '24', 10) * 60 * 60 * 1000;

    // Get DLP rules
    const rules = DataLossPreventionService.getDLPRules();

    let violations = [];
    let statistics = {};

    if (includeViolations) {
      violations = DataLossPreventionService.getDLPViolations({
        limit: 100,
        startDate: new Date(Date.now() - timeWindow),
      });
    }

    if (includeStats) {
      statistics = DataLossPreventionService.getDLPStatistics(timeWindow);
    }

    // Log access
    await AuditLoggerService.logEvent(AuditEventType.DATA_READ, {
      userId,
      action: 'dlp_data_accessed',
      outcome: 'success',
      resource: 'data_loss_prevention',
      details: {
        rulesCount: rules.length,
        includeViolations,
        includeStats,
        timeWindow,
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse({
      rules,
      violations: includeViolations ? violations : undefined,
      statistics: includeStats ? statistics : undefined,
    });

  } catch (error) {
    console.error('DLP data query failed:', error);

    await AuditLoggerService.logEvent(AuditEventType.SYSTEM_ERROR, {
      userId: request.headers.get('x-user-id') || undefined,
      action: 'dlp_data_query_failed',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(
      { error: 'Failed to query DLP data' },
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

    // Check permissions - only system admins can create DLP rules
    const userRole = request.headers.get('x-user-role');
    if (!userRole || !RBACService.hasPermission(userRole as any, Permission.SYSTEM_ADMIN)) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = await InputValidationService.validateRequest(body, dlpRuleSchema);

    if (!validation.success) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Invalid DLP rule data', details: validation.errors },
        { status: 400 }
      );
    }

    const ruleData = validation.data;

    // Validate regex pattern
    try {
      new RegExp(ruleData.pattern);
    } catch (error) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Invalid regex pattern', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 400 }
      );
    }

    // Create DLP rule
    const rule = {
      ...ruleData,
      pattern: new RegExp(ruleData.pattern, 'g'),
      dataClassifications: ['confidential', 'restricted'], // Default classifications
    };

    DataLossPreventionService.setDLPRule(rule as any);

    // Log rule creation
    await AuditLoggerService.logEvent(AuditEventType.DATA_CREATE, {
      userId,
      action: 'dlp_rule_created',
      outcome: 'success',
      resource: 'data_loss_prevention',
      resourceId: rule.id,
      details: {
        ruleName: rule.name,
        ruleType: rule.type,
        action: rule.action,
        severity: rule.severity,
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse({
      success: true,
      rule: {
        ...rule,
        pattern: ruleData.pattern, // Return string pattern for JSON serialization
      },
      message: 'DLP rule created successfully',
    });

  } catch (error) {
    console.error('DLP rule creation failed:', error);

    await AuditLoggerService.logEvent(AuditEventType.SYSTEM_ERROR, {
      userId: request.headers.get('x-user-id') || undefined,
      action: 'dlp_rule_creation_failed',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(
      { error: 'Failed to create DLP rule' },
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

    // Parse request body for scan operation
    const body = await request.json();
    
    // Check if this is a content scan request
    if (body.content && body.location) {
      const scanValidation = await InputValidationService.validateRequest(body, scanRequestSchema);
      
      if (!scanValidation.success) {
        return SecurityHeadersService.createSecureResponse(
          { error: 'Invalid scan request', details: scanValidation.errors },
          { status: 400 }
        );
      }

      const { content, location, dataClassification } = scanValidation.data;

      // Perform DLP scan
      const scanResult = await DataLossPreventionService.scanContent(content, {
        location,
        dataClassification: dataClassification as any,
        userId,
        organizationId: request.headers.get('x-organization-id') || undefined,
        request,
      });

      // Log scan operation
      await AuditLoggerService.logEvent(AuditEventType.DATA_READ, {
        userId,
        action: 'dlp_content_scanned',
        outcome: scanResult.blocked ? 'blocked' : 'success',
        resource: 'data_loss_prevention',
        details: {
          location,
          contentLength: content.length,
          violationsFound: scanResult.violations.length,
          blocked: scanResult.blocked,
        },
        request,
      });

      return SecurityHeadersService.createSecureResponse({
        success: true,
        scanResult: {
          violations: scanResult.violations.map(v => ({
            id: v.id,
            ruleId: v.ruleId,
            ruleName: v.ruleName,
            type: v.type,
            action: v.action,
            severity: v.severity,
            location: v.location,
            timestamp: v.timestamp,
            blocked: v.blocked,
          })),
          blocked: scanResult.blocked,
          processedContent: scanResult.processedContent,
        },
      });
    }

    // Otherwise, treat as rule update
    const ruleValidation = await InputValidationService.validateRequest(body, dlpRuleSchema);

    if (!ruleValidation.success) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Invalid DLP rule data', details: ruleValidation.errors },
        { status: 400 }
      );
    }

    const ruleData = ruleValidation.data;

    // Validate regex pattern
    try {
      new RegExp(ruleData.pattern);
    } catch (error) {
      return SecurityHeadersService.createSecureResponse(
        { error: 'Invalid regex pattern', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 400 }
      );
    }

    // Update DLP rule
    const rule = {
      ...ruleData,
      pattern: new RegExp(ruleData.pattern, 'g'),
      dataClassifications: ['confidential', 'restricted'],
    };

    DataLossPreventionService.setDLPRule(rule as any);

    // Log rule update
    await AuditLoggerService.logEvent(AuditEventType.DATA_UPDATE, {
      userId,
      action: 'dlp_rule_updated',
      outcome: 'success',
      resource: 'data_loss_prevention',
      resourceId: rule.id,
      details: {
        ruleName: rule.name,
        ruleType: rule.type,
        action: rule.action,
        severity: rule.severity,
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse({
      success: true,
      rule: {
        ...rule,
        pattern: ruleData.pattern, // Return string pattern for JSON serialization
      },
      message: 'DLP rule updated successfully',
    });

  } catch (error) {
    console.error('DLP operation failed:', error);

    await AuditLoggerService.logEvent(AuditEventType.SYSTEM_ERROR, {
      userId: request.headers.get('x-user-id') || undefined,
      action: 'dlp_operation_failed',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(
      { error: 'Failed to perform DLP operation' },
      { status: 500 }
    );
  }
}