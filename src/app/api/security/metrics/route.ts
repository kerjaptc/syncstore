/**
 * Security Metrics API Endpoint
 * Provides security metrics and statistics for monitoring
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { AuditLoggerService, AuditEventType } from '@/lib/security/audit-logger';
import { RBACService, Permission } from '@/lib/security/rbac';
import { SecurityHeadersService } from '@/lib/security/headers';
import { RateLimiterService } from '@/lib/security/rate-limiter';
import { JWTAuthService } from '@/lib/security/jwt-auth';

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

    // Check permissions - only admins and owners can view security metrics
    const userRole = request.headers.get('x-user-role');
    if (!userRole || !RBACService.hasPermission(userRole as any, Permission.SYSTEM_MONITORING)) {
      await AuditLoggerService.logEvent(AuditEventType.ACCESS_DENIED, {
        userId,
        action: 'security_metrics_access_denied',
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

    // Get time window from query params (default to 24 hours)
    const url = new URL(request.url);
    const timeWindowHours = parseInt(url.searchParams.get('timeWindow') || '24', 10);
    const timeWindowMs = timeWindowHours * 60 * 60 * 1000;

    // Collect security metrics
    const auditMetrics = AuditLoggerService.getSecurityMetrics(timeWindowMs);
    const tokenStats = JWTAuthService.getTokenStats();

    // Get rate limiting statistics (simplified)
    const rateLimitStats = {
      totalRequests: auditMetrics.totalEvents,
      blockedRequests: auditMetrics.eventsByType[AuditEventType.RATE_LIMIT_EXCEEDED] || 0,
      blockRate: auditMetrics.totalEvents > 0 
        ? ((auditMetrics.eventsByType[AuditEventType.RATE_LIMIT_EXCEEDED] || 0) / auditMetrics.totalEvents) * 100 
        : 0,
    };

    // Calculate security score (0-100)
    const securityScore = calculateSecurityScore(auditMetrics, tokenStats);

    // Identify security threats
    const threats = identifyThreats(auditMetrics);

    // Get recent security incidents
    const recentIncidents = AuditLoggerService.queryEvents({
      severity: 'high' as any,
      startTime: new Date(Date.now() - timeWindowMs),
      limit: 10,
    });

    const metrics = {
      timeWindow: {
        hours: timeWindowHours,
        startTime: new Date(Date.now() - timeWindowMs).toISOString(),
        endTime: new Date().toISOString(),
      },
      overview: {
        securityScore,
        totalEvents: auditMetrics.totalEvents,
        failureRate: auditMetrics.failureRate * 100,
        anomaliesDetected: auditMetrics.anomaliesDetected,
        threatsIdentified: threats.length,
      },
      authentication: {
        activeTokens: tokenStats.activeRefreshTokens,
        revokedTokens: tokenStats.revokedTokens,
        expiredTokens: tokenStats.expiredTokens,
        loginFailures: auditMetrics.eventsByType[AuditEventType.LOGIN_FAILURE] || 0,
        loginSuccesses: auditMetrics.eventsByType[AuditEventType.LOGIN_SUCCESS] || 0,
      },
      authorization: {
        accessDenied: auditMetrics.eventsByType[AuditEventType.ACCESS_DENIED] || 0,
        accessGranted: auditMetrics.eventsByType[AuditEventType.ACCESS_GRANTED] || 0,
        permissionEscalations: auditMetrics.eventsByType[AuditEventType.PERMISSION_ESCALATION] || 0,
      },
      attacks: {
        csrfAttempts: auditMetrics.eventsByType[AuditEventType.CSRF_ATTACK] || 0,
        xssAttempts: auditMetrics.eventsByType[AuditEventType.XSS_ATTEMPT] || 0,
        sqlInjectionAttempts: auditMetrics.eventsByType[AuditEventType.SQL_INJECTION] || 0,
        suspiciousActivity: auditMetrics.eventsByType[AuditEventType.SUSPICIOUS_ACTIVITY] || 0,
      },
      rateLimiting: rateLimitStats,
      eventsBySeverity: auditMetrics.eventsBySeverity,
      topIPs: auditMetrics.topIPs,
      threats,
      recentIncidents: recentIncidents.map(incident => ({
        id: incident.id,
        timestamp: incident.timestamp,
        eventType: incident.eventType,
        severity: incident.severity,
        action: incident.action,
        outcome: incident.outcome,
        ipAddress: incident.ipAddress,
        details: incident.details,
      })),
    };

    // Log metrics access
    await AuditLoggerService.logEvent(AuditEventType.DATA_READ, {
      userId,
      action: 'security_metrics_accessed',
      outcome: 'success',
      resource: 'security_metrics',
      details: {
        timeWindowHours,
        metricsRequested: Object.keys(metrics),
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(metrics);

  } catch (error) {
    console.error('Security metrics query failed:', error);

    await AuditLoggerService.logEvent(AuditEventType.SYSTEM_ERROR, {
      userId: request.headers.get('x-user-id') || undefined,
      action: 'security_metrics_query_failed',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(
      { error: 'Failed to query security metrics' },
      { status: 500 }
    );
  }
}

/**
 * Calculate overall security score based on metrics
 */
function calculateSecurityScore(auditMetrics: any, tokenStats: any): number {
  let score = 100;

  // Deduct points for failures
  if (auditMetrics.failureRate > 0.1) score -= 20; // High failure rate
  if (auditMetrics.failureRate > 0.05) score -= 10; // Medium failure rate

  // Deduct points for attacks
  const attackEvents = [
    'security.csrf.attack',
    'security.xss.attempt',
    'security.sql.injection',
    'security.suspicious.activity',
  ];

  attackEvents.forEach(eventType => {
    const count = auditMetrics.eventsByType[eventType] || 0;
    if (count > 0) score -= Math.min(count * 5, 30);
  });

  // Deduct points for anomalies
  if (auditMetrics.anomaliesDetected > 0) {
    score -= Math.min(auditMetrics.anomaliesDetected * 3, 20);
  }

  // Deduct points for excessive token revocations
  if (tokenStats.revokedTokens > tokenStats.activeRefreshTokens * 0.5) {
    score -= 15;
  }

  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Identify security threats based on metrics
 */
function identifyThreats(auditMetrics: any): Array<{
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  count: number;
  recommendation: string;
}> {
  const threats = [];

  // Check for brute force attacks
  const loginFailures = auditMetrics.eventsByType[AuditEventType.LOGIN_FAILURE] || 0;
  if (loginFailures > 50) {
    threats.push({
      type: 'brute_force',
      severity: loginFailures > 100 ? 'critical' : 'high',
      description: 'High number of login failures detected',
      count: loginFailures,
      recommendation: 'Consider implementing account lockouts and IP blocking',
    });
  }

  // Check for CSRF attacks
  const csrfAttacks = auditMetrics.eventsByType[AuditEventType.CSRF_ATTACK] || 0;
  if (csrfAttacks > 0) {
    threats.push({
      type: 'csrf_attack',
      severity: csrfAttacks > 10 ? 'critical' : 'high',
      description: 'CSRF attacks detected',
      count: csrfAttacks,
      recommendation: 'Verify CSRF protection is properly implemented',
    });
  }

  // Check for XSS attempts
  const xssAttempts = auditMetrics.eventsByType[AuditEventType.XSS_ATTEMPT] || 0;
  if (xssAttempts > 0) {
    threats.push({
      type: 'xss_attempt',
      severity: xssAttempts > 5 ? 'high' : 'medium',
      description: 'XSS attempts detected',
      count: xssAttempts,
      recommendation: 'Review input validation and output encoding',
    });
  }

  // Check for SQL injection attempts
  const sqlInjection = auditMetrics.eventsByType[AuditEventType.SQL_INJECTION] || 0;
  if (sqlInjection > 0) {
    threats.push({
      type: 'sql_injection',
      severity: 'critical',
      description: 'SQL injection attempts detected',
      count: sqlInjection,
      recommendation: 'Immediately review database queries and parameterization',
    });
  }

  // Check for suspicious activity
  const suspiciousActivity = auditMetrics.eventsByType[AuditEventType.SUSPICIOUS_ACTIVITY] || 0;
  if (suspiciousActivity > 0) {
    threats.push({
      type: 'suspicious_activity',
      severity: suspiciousActivity > 10 ? 'high' : 'medium',
      description: 'Anomalous behavior patterns detected',
      count: suspiciousActivity,
      recommendation: 'Investigate flagged activities and consider additional monitoring',
    });
  }

  // Check for rate limit violations
  const rateLimitExceeded = auditMetrics.eventsByType[AuditEventType.RATE_LIMIT_EXCEEDED] || 0;
  if (rateLimitExceeded > auditMetrics.totalEvents * 0.1) {
    threats.push({
      type: 'rate_limit_abuse',
      severity: 'medium',
      description: 'High rate of rate limit violations',
      count: rateLimitExceeded,
      recommendation: 'Review rate limiting policies and consider stricter limits',
    });
  }

  return threats;
}