/**
 * Security Audit Logger
 * Implements comprehensive security event logging and anomaly detection
 */

import { NextRequest } from 'next/server';
import { env } from '@/env';

export enum AuditEventType {
  // Authentication events
  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAILURE = 'auth.login.failure',
  LOGOUT = 'auth.logout',
  TOKEN_REFRESH = 'auth.token.refresh',
  TOKEN_REVOKE = 'auth.token.revoke',
  PASSWORD_CHANGE = 'auth.password.change',
  
  // Authorization events
  ACCESS_GRANTED = 'authz.access.granted',
  ACCESS_DENIED = 'authz.access.denied',
  PERMISSION_ESCALATION = 'authz.permission.escalation',
  ROLE_CHANGE = 'authz.role.change',
  
  // Data access events
  DATA_READ = 'data.read',
  DATA_CREATE = 'data.create',
  DATA_UPDATE = 'data.update',
  DATA_DELETE = 'data.delete',
  DATA_EXPORT = 'data.export',
  DATA_IMPORT = 'data.import',
  
  // Security events
  CSRF_ATTACK = 'security.csrf.attack',
  XSS_ATTEMPT = 'security.xss.attempt',
  SQL_INJECTION = 'security.sql.injection',
  RATE_LIMIT_EXCEEDED = 'security.rate_limit.exceeded',
  SUSPICIOUS_ACTIVITY = 'security.suspicious.activity',
  MALWARE_DETECTED = 'security.malware.detected',
  
  // System events
  SYSTEM_ERROR = 'system.error',
  SYSTEM_STARTUP = 'system.startup',
  SYSTEM_SHUTDOWN = 'system.shutdown',
  CONFIG_CHANGE = 'system.config.change',
  
  // API events
  API_KEY_CREATED = 'api.key.created',
  API_KEY_REVOKED = 'api.key.revoked',
  API_ABUSE = 'api.abuse',
  
  // File events
  FILE_UPLOAD = 'file.upload',
  FILE_DOWNLOAD = 'file.download',
  FILE_DELETE = 'file.delete',
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

interface AuditEvent {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  organizationId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  resource?: string;
  resourceId?: string;
  action: string;
  outcome: 'success' | 'failure' | 'blocked';
  details: Record<string, any>;
  metadata: {
    requestId?: string;
    correlationId?: string;
    geolocation?: string;
    deviceFingerprint?: string;
  };
}

interface AnomalyPattern {
  type: string;
  threshold: number;
  timeWindow: number; // in milliseconds
  description: string;
}

export class AuditLoggerService {
  private static events: AuditEvent[] = [];
  private static readonly MAX_EVENTS_IN_MEMORY = 10000;
  
  // Anomaly detection patterns
  private static readonly anomalyPatterns: AnomalyPattern[] = [
    {
      type: 'rapid_login_attempts',
      threshold: 10,
      timeWindow: 5 * 60 * 1000, // 5 minutes
      description: 'Multiple login attempts from same IP',
    },
    {
      type: 'permission_escalation',
      threshold: 3,
      timeWindow: 60 * 60 * 1000, // 1 hour
      description: 'Multiple permission escalation attempts',
    },
    {
      type: 'bulk_data_access',
      threshold: 100,
      timeWindow: 10 * 60 * 1000, // 10 minutes
      description: 'Excessive data access in short time',
    },
    {
      type: 'failed_api_calls',
      threshold: 50,
      timeWindow: 15 * 60 * 1000, // 15 minutes
      description: 'High number of failed API calls',
    },
  ];

  /**
   * Generate unique event ID
   */
  private static generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract client information from request
   */
  private static extractClientInfo(request?: NextRequest): {
    ipAddress: string;
    userAgent: string;
    geolocation?: string;
  } {
    if (!request) {
      return {
        ipAddress: 'unknown',
        userAgent: 'unknown',
      };
    }

    const ipAddress = request.ip || 
                     request.headers.get('x-forwarded-for')?.split(',')[0] || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    const userAgent = request.headers.get('user-agent') || 'unknown';
    const geolocation = request.headers.get('cf-ipcountry') || undefined;

    return { ipAddress, userAgent, geolocation };
  }

  /**
   * Log security event
   */
  static async logEvent(
    eventType: AuditEventType,
    options: {
      severity?: AuditSeverity;
      userId?: string;
      organizationId?: string;
      sessionId?: string;
      resource?: string;
      resourceId?: string;
      action: string;
      outcome: 'success' | 'failure' | 'blocked';
      details?: Record<string, any>;
      request?: NextRequest;
      correlationId?: string;
    }
  ): Promise<void> {
    const clientInfo = this.extractClientInfo(options.request);
    
    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      eventType,
      severity: options.severity || this.getDefaultSeverity(eventType),
      userId: options.userId,
      organizationId: options.organizationId,
      sessionId: options.sessionId,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      resource: options.resource,
      resourceId: options.resourceId,
      action: options.action,
      outcome: options.outcome,
      details: options.details || {},
      metadata: {
        requestId: options.request?.headers.get('x-request-id') || undefined,
        correlationId: options.correlationId,
        geolocation: clientInfo.geolocation,
        deviceFingerprint: await this.generateDeviceFingerprint(clientInfo),
      },
    };

    // Store event
    await this.storeEvent(event);

    // Check for anomalies
    await this.detectAnomalies(event);

    // Send alerts for critical events
    if (event.severity === AuditSeverity.CRITICAL) {
      await this.sendCriticalAlert(event);
    }
  }

  /**
   * Get default severity for event type
   */
  private static getDefaultSeverity(eventType: AuditEventType): AuditSeverity {
    const criticalEvents = [
      AuditEventType.CSRF_ATTACK,
      AuditEventType.XSS_ATTEMPT,
      AuditEventType.SQL_INJECTION,
      AuditEventType.MALWARE_DETECTED,
      AuditEventType.PERMISSION_ESCALATION,
    ];

    const highEvents = [
      AuditEventType.LOGIN_FAILURE,
      AuditEventType.ACCESS_DENIED,
      AuditEventType.SUSPICIOUS_ACTIVITY,
      AuditEventType.API_ABUSE,
      AuditEventType.RATE_LIMIT_EXCEEDED,
    ];

    const mediumEvents = [
      AuditEventType.DATA_DELETE,
      AuditEventType.DATA_EXPORT,
      AuditEventType.ROLE_CHANGE,
      AuditEventType.CONFIG_CHANGE,
    ];

    if (criticalEvents.includes(eventType)) return AuditSeverity.CRITICAL;
    if (highEvents.includes(eventType)) return AuditSeverity.HIGH;
    if (mediumEvents.includes(eventType)) return AuditSeverity.MEDIUM;
    return AuditSeverity.LOW;
  }

  /**
   * Generate device fingerprint using Web Crypto API (Edge Runtime compatible)
   */
  private static async generateDeviceFingerprint(clientInfo: {
    ipAddress: string;
    userAgent: string;
  }): Promise<string> {
    const fingerprint = `${clientInfo.ipAddress}:${clientInfo.userAgent}`;
    
    // Use Web Crypto API for Edge Runtime compatibility
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprint);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex.substring(0, 16);
  }

  /**
   * Store audit event
   */
  private static async storeEvent(event: AuditEvent): Promise<void> {
    // Add to in-memory store
    this.events.push(event);

    // Keep only recent events in memory
    if (this.events.length > this.MAX_EVENTS_IN_MEMORY) {
      this.events = this.events.slice(-this.MAX_EVENTS_IN_MEMORY);
    }

    // In production, also store to database and external logging service
    try {
      // Store to database
      await this.storeToDatabase(event);

      // Send to external logging service (e.g., Sentry, DataDog)
      await this.sendToExternalLogger(event);
    } catch (error) {
      console.error('Failed to store audit event:', error);
    }
  }

  /**
   * Store event to database
   */
  private static async storeToDatabase(event: AuditEvent): Promise<void> {
    // This would insert into an audit_logs table
    // For now, just log to console in development
    if (env.NODE_ENV === 'development') {
      console.log('AUDIT EVENT:', JSON.stringify(event, null, 2));
    }
  }

  /**
   * Send event to external logging service
   */
  private static async sendToExternalLogger(event: AuditEvent): Promise<void> {
    // Send to Sentry for critical events
    if (event.severity === AuditSeverity.CRITICAL && env.SENTRY_DSN) {
      // Would use Sentry SDK here
      console.log('CRITICAL AUDIT EVENT - would send to Sentry:', event);
    }

    // Send to other logging services as needed
  }

  /**
   * Detect anomalies in audit events
   */
  private static async detectAnomalies(currentEvent: AuditEvent): Promise<void> {
    const now = Date.now();

    for (const pattern of this.anomalyPatterns) {
      const windowStart = now - pattern.timeWindow;
      const recentEvents = this.events.filter(event => 
        new Date(event.timestamp).getTime() > windowStart
      );

      let matchingEvents: AuditEvent[] = [];

      switch (pattern.type) {
        case 'rapid_login_attempts':
          matchingEvents = recentEvents.filter(event =>
            event.eventType === AuditEventType.LOGIN_FAILURE &&
            event.ipAddress === currentEvent.ipAddress
          );
          break;

        case 'permission_escalation':
          matchingEvents = recentEvents.filter(event =>
            event.eventType === AuditEventType.ACCESS_DENIED &&
            event.userId === currentEvent.userId
          );
          break;

        case 'bulk_data_access':
          matchingEvents = recentEvents.filter(event =>
            event.eventType === AuditEventType.DATA_READ &&
            event.userId === currentEvent.userId
          );
          break;

        case 'failed_api_calls':
          matchingEvents = recentEvents.filter(event =>
            event.outcome === 'failure' &&
            event.ipAddress === currentEvent.ipAddress
          );
          break;
      }

      if (matchingEvents.length >= pattern.threshold) {
        await this.handleAnomaly(pattern, matchingEvents, currentEvent);
      }
    }
  }

  /**
   * Handle detected anomaly
   */
  private static async handleAnomaly(
    pattern: AnomalyPattern,
    matchingEvents: AuditEvent[],
    triggerEvent: AuditEvent
  ): Promise<void> {
    const anomalyEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
      severity: AuditSeverity.HIGH,
      userId: triggerEvent.userId,
      organizationId: triggerEvent.organizationId,
      ipAddress: triggerEvent.ipAddress,
      userAgent: triggerEvent.userAgent,
      resource: 'security',
      action: 'anomaly_detected',
      outcome: 'blocked',
      details: {
        anomalyType: pattern.type,
        description: pattern.description,
        threshold: pattern.threshold,
        actualCount: matchingEvents.length,
        timeWindow: pattern.timeWindow,
        matchingEventIds: matchingEvents.map(e => e.id),
      },
      metadata: {
        correlationId: `anomaly_${pattern.type}_${Date.now()}`,
      },
    };

    await this.storeEvent(anomalyEvent);

    // Take automated action if needed
    await this.takeAutomatedAction(pattern, triggerEvent);
  }

  /**
   * Take automated action for anomalies
   */
  private static async takeAutomatedAction(
    pattern: AnomalyPattern,
    triggerEvent: AuditEvent
  ): Promise<void> {
    switch (pattern.type) {
      case 'rapid_login_attempts':
        // Temporarily block IP
        console.log(`SECURITY ACTION: Blocking IP ${triggerEvent.ipAddress} for rapid login attempts`);
        break;

      case 'permission_escalation':
        // Alert security team
        console.log(`SECURITY ACTION: Alerting security team about user ${triggerEvent.userId}`);
        break;

      case 'bulk_data_access':
        // Rate limit user
        console.log(`SECURITY ACTION: Rate limiting user ${triggerEvent.userId} for bulk data access`);
        break;

      case 'failed_api_calls':
        // Block API access from IP
        console.log(`SECURITY ACTION: Blocking API access from IP ${triggerEvent.ipAddress}`);
        break;
    }
  }

  /**
   * Send critical alert
   */
  private static async sendCriticalAlert(event: AuditEvent): Promise<void> {
    const alert = {
      timestamp: event.timestamp,
      severity: event.severity,
      eventType: event.eventType,
      message: `Critical security event detected: ${event.action}`,
      details: event.details,
      userId: event.userId,
      ipAddress: event.ipAddress,
    };

    // Send to monitoring system
    console.log('CRITICAL SECURITY ALERT:', alert);

    // In production, send to:
    // - Security team via email/Slack
    // - SIEM system
    // - Incident management system
  }

  /**
   * Query audit events
   */
  static queryEvents(filters: {
    eventType?: AuditEventType;
    userId?: string;
    organizationId?: string;
    severity?: AuditSeverity;
    startTime?: Date;
    endTime?: Date;
    ipAddress?: string;
    outcome?: 'success' | 'failure' | 'blocked';
    limit?: number;
  }): AuditEvent[] {
    let filteredEvents = [...this.events];

    if (filters.eventType) {
      filteredEvents = filteredEvents.filter(e => e.eventType === filters.eventType);
    }

    if (filters.userId) {
      filteredEvents = filteredEvents.filter(e => e.userId === filters.userId);
    }

    if (filters.organizationId) {
      filteredEvents = filteredEvents.filter(e => e.organizationId === filters.organizationId);
    }

    if (filters.severity) {
      filteredEvents = filteredEvents.filter(e => e.severity === filters.severity);
    }

    if (filters.startTime) {
      filteredEvents = filteredEvents.filter(e => 
        new Date(e.timestamp) >= filters.startTime!
      );
    }

    if (filters.endTime) {
      filteredEvents = filteredEvents.filter(e => 
        new Date(e.timestamp) <= filters.endTime!
      );
    }

    if (filters.ipAddress) {
      filteredEvents = filteredEvents.filter(e => e.ipAddress === filters.ipAddress);
    }

    if (filters.outcome) {
      filteredEvents = filteredEvents.filter(e => e.outcome === filters.outcome);
    }

    // Sort by timestamp (newest first)
    filteredEvents.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply limit
    if (filters.limit) {
      filteredEvents = filteredEvents.slice(0, filters.limit);
    }

    return filteredEvents;
  }

  /**
   * Get security metrics
   */
  static getSecurityMetrics(timeWindow: number = 24 * 60 * 60 * 1000): {
    totalEvents: number;
    eventsBySeverity: Record<AuditSeverity, number>;
    eventsByType: Record<string, number>;
    failureRate: number;
    topIPs: Array<{ ip: string; count: number }>;
    anomaliesDetected: number;
  } {
    const now = Date.now();
    const windowStart = now - timeWindow;
    
    const recentEvents = this.events.filter(event => 
      new Date(event.timestamp).getTime() > windowStart
    );

    const eventsBySeverity = recentEvents.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<AuditSeverity, number>);

    const eventsByType = recentEvents.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const failures = recentEvents.filter(e => e.outcome === 'failure').length;
    const failureRate = recentEvents.length > 0 ? failures / recentEvents.length : 0;

    const ipCounts = recentEvents.reduce((acc, event) => {
      acc[event.ipAddress] = (acc[event.ipAddress] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topIPs = Object.entries(ipCounts)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const anomaliesDetected = recentEvents.filter(e => 
      e.eventType === AuditEventType.SUSPICIOUS_ACTIVITY
    ).length;

    return {
      totalEvents: recentEvents.length,
      eventsBySeverity,
      eventsByType,
      failureRate,
      topIPs,
      anomaliesDetected,
    };
  }

  /**
   * Export audit logs
   */
  static exportLogs(
    filters: Parameters<typeof this.queryEvents>[0],
    format: 'json' | 'csv' = 'json'
  ): string {
    const events = this.queryEvents(filters);

    if (format === 'csv') {
      const headers = [
        'timestamp', 'eventType', 'severity', 'userId', 'organizationId',
        'ipAddress', 'action', 'outcome', 'resource', 'resourceId'
      ];

      const csvRows = events.map(event => [
        event.timestamp,
        event.eventType,
        event.severity,
        event.userId || '',
        event.organizationId || '',
        event.ipAddress,
        event.action,
        event.outcome,
        event.resource || '',
        event.resourceId || '',
      ]);

      return [headers, ...csvRows].map(row => row.join(',')).join('\n');
    }

    return JSON.stringify(events, null, 2);
  }
}