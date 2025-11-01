/**
 * Data Loss Prevention (DLP) Service
 * Implements measures to prevent unauthorized data access and leakage
 */

import { AuditLoggerService, AuditEventType, AuditSeverity } from './audit-logger';
import { NextRequest } from 'next/server';

export enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
}

export enum DLPRuleType {
  CREDIT_CARD = 'credit_card',
  SSN = 'ssn',
  EMAIL = 'email',
  PHONE = 'phone',
  API_KEY = 'api_key',
  PASSWORD = 'password',
  PERSONAL_NAME = 'personal_name',
  ADDRESS = 'address',
  BANK_ACCOUNT = 'bank_account',
  CUSTOM_PATTERN = 'custom_pattern',
}

export enum DLPAction {
  BLOCK = 'block',
  ALERT = 'alert',
  REDACT = 'redact',
  ENCRYPT = 'encrypt',
  LOG_ONLY = 'log_only',
}

interface DLPRule {
  id: string;
  name: string;
  type: DLPRuleType;
  pattern: RegExp;
  action: DLPAction;
  severity: AuditSeverity;
  description: string;
  enabled: boolean;
  dataClassifications: DataClassification[];
}

interface DLPViolation {
  id: string;
  ruleId: string;
  ruleName: string;
  type: DLPRuleType;
  action: DLPAction;
  severity: AuditSeverity;
  content: string;
  redactedContent: string;
  location: string;
  userId?: string;
  organizationId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  blocked: boolean;
}

export class DataLossPreventionService {
  private static dlpRules: DLPRule[] = [];
  private static violations: DLPViolation[] = [];

  /**
   * Initialize default DLP rules
   */
  static initializeDefaultRules(): void {
    const defaultRules: DLPRule[] = [
      {
        id: 'credit_card_rule',
        name: 'Credit Card Number Detection',
        type: DLPRuleType.CREDIT_CARD,
        pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        action: DLPAction.REDACT,
        severity: AuditSeverity.HIGH,
        description: 'Detects credit card numbers in various formats',
        enabled: true,
        dataClassifications: [DataClassification.CONFIDENTIAL, DataClassification.RESTRICTED],
      },
      {
        id: 'ssn_rule',
        name: 'Social Security Number Detection',
        type: DLPRuleType.SSN,
        pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
        action: DLPAction.BLOCK,
        severity: AuditSeverity.CRITICAL,
        description: 'Detects US Social Security Numbers',
        enabled: true,
        dataClassifications: [DataClassification.RESTRICTED],
      },
      {
        id: 'email_rule',
        name: 'Email Address Detection',
        type: DLPRuleType.EMAIL,
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        action: DLPAction.ALERT,
        severity: AuditSeverity.MEDIUM,
        description: 'Detects email addresses',
        enabled: true,
        dataClassifications: [DataClassification.CONFIDENTIAL],
      },
      {
        id: 'phone_rule',
        name: 'Phone Number Detection',
        type: DLPRuleType.PHONE,
        pattern: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
        action: DLPAction.REDACT,
        severity: AuditSeverity.MEDIUM,
        description: 'Detects phone numbers in various formats',
        enabled: true,
        dataClassifications: [DataClassification.CONFIDENTIAL],
      },
      {
        id: 'api_key_rule',
        name: 'API Key Detection',
        type: DLPRuleType.API_KEY,
        pattern: /\b[A-Za-z0-9]{32,}\b/g,
        action: DLPAction.BLOCK,
        severity: AuditSeverity.CRITICAL,
        description: 'Detects potential API keys and tokens',
        enabled: true,
        dataClassifications: [DataClassification.RESTRICTED],
      },
      {
        id: 'password_rule',
        name: 'Password Field Detection',
        type: DLPRuleType.PASSWORD,
        pattern: /password\s*[:=]\s*[^\s\n]+/gi,
        action: DLPAction.REDACT,
        severity: AuditSeverity.HIGH,
        description: 'Detects password fields in text',
        enabled: true,
        dataClassifications: [DataClassification.RESTRICTED],
      },
      {
        id: 'bank_account_rule',
        name: 'Bank Account Number Detection',
        type: DLPRuleType.BANK_ACCOUNT,
        pattern: /\b\d{8,17}\b/g,
        action: DLPAction.REDACT,
        severity: AuditSeverity.HIGH,
        description: 'Detects potential bank account numbers',
        enabled: true,
        dataClassifications: [DataClassification.RESTRICTED],
      },
    ];

    this.dlpRules = defaultRules;
  }

  /**
   * Add or update DLP rule
   */
  static setDLPRule(rule: DLPRule): void {
    const existingIndex = this.dlpRules.findIndex(r => r.id === rule.id);
    
    if (existingIndex >= 0) {
      this.dlpRules[existingIndex] = rule;
    } else {
      this.dlpRules.push(rule);
    }
  }

  /**
   * Get DLP rules
   */
  static getDLPRules(enabled?: boolean): DLPRule[] {
    if (enabled !== undefined) {
      return this.dlpRules.filter(rule => rule.enabled === enabled);
    }
    return [...this.dlpRules];
  }

  /**
   * Scan content for DLP violations
   */
  static async scanContent(
    content: string,
    context: {
      location: string;
      dataClassification?: DataClassification;
      userId?: string;
      organizationId?: string;
      request?: NextRequest;
    }
  ): Promise<{
    violations: DLPViolation[];
    processedContent: string;
    blocked: boolean;
  }> {
    const violations: DLPViolation[] = [];
    let processedContent = content;
    let blocked = false;

    const applicableRules = this.dlpRules.filter(rule => {
      if (!rule.enabled) return false;
      
      if (context.dataClassification && rule.dataClassifications.length > 0) {
        return rule.dataClassifications.includes(context.dataClassification);
      }
      
      return true;
    });

    for (const rule of applicableRules) {
      const matches = content.match(rule.pattern);
      
      if (matches && matches.length > 0) {
        const violation = await this.createViolation(
          rule,
          matches.join(', '),
          context
        );
        
        violations.push(violation);

        // Apply rule action
        switch (rule.action) {
          case DLPAction.BLOCK:
            blocked = true;
            break;
            
          case DLPAction.REDACT:
            processedContent = processedContent.replace(rule.pattern, '[REDACTED]');
            break;
            
          case DLPAction.ENCRYPT:
            // In a real implementation, this would encrypt the sensitive data
            processedContent = processedContent.replace(rule.pattern, '[ENCRYPTED]');
            break;
            
          case DLPAction.ALERT:
          case DLPAction.LOG_ONLY:
            // No content modification, just logging
            break;
        }
      }
    }

    return {
      violations,
      processedContent,
      blocked,
    };
  }

  /**
   * Create DLP violation record
   */
  private static async createViolation(
    rule: DLPRule,
    content: string,
    context: {
      location: string;
      userId?: string;
      organizationId?: string;
      request?: NextRequest;
    }
  ): Promise<DLPViolation> {
    const ipAddress = context.request?.ip || 
                     context.request?.headers.get('x-forwarded-for')?.split(',')[0] || 
                     context.request?.headers.get('x-real-ip') || 
                     'unknown';
    
    const userAgent = context.request?.headers.get('user-agent') || 'unknown';

    const violation: DLPViolation = {
      id: `dlp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      type: rule.type,
      action: rule.action,
      severity: rule.severity,
      content: content.substring(0, 100), // Limit stored content
      redactedContent: content.replace(/./g, '*'),
      location: context.location,
      userId: context.userId,
      organizationId: context.organizationId,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      blocked: rule.action === DLPAction.BLOCK,
    };

    this.violations.push(violation);

    // Log the violation
    await AuditLoggerService.logEvent(AuditEventType.SUSPICIOUS_ACTIVITY, {
      userId: context.userId,
      organizationId: context.organizationId,
      action: 'dlp_violation_detected',
      outcome: violation.blocked ? 'blocked' : 'success',
      severity: rule.severity,
      resource: 'data_loss_prevention',
      resourceId: violation.id,
      details: {
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.type,
        action: rule.action,
        location: context.location,
        contentLength: content.length,
      },
      request: context.request,
    });

    // Send alert for high severity violations
    if (rule.severity === AuditSeverity.HIGH || rule.severity === AuditSeverity.CRITICAL) {
      await this.sendDLPAlert(violation);
    }

    return violation;
  }

  /**
   * Send DLP alert
   */
  private static async sendDLPAlert(violation: DLPViolation): Promise<void> {
    console.log(`DLP ALERT: ${violation.severity} violation detected`, {
      rule: violation.ruleName,
      type: violation.type,
      location: violation.location,
      userId: violation.userId,
      timestamp: violation.timestamp,
    });

    // In a real implementation, this would send alerts via:
    // - Email to security team
    // - Slack/Teams notifications
    // - SIEM system integration
    // - Security dashboard updates
  }

  /**
   * Scan file upload for sensitive data
   */
  static async scanFileUpload(
    fileContent: string,
    fileName: string,
    context: {
      userId?: string;
      organizationId?: string;
      request?: NextRequest;
    }
  ): Promise<{
    allowed: boolean;
    violations: DLPViolation[];
    reason?: string;
  }> {
    const scanResult = await this.scanContent(fileContent, {
      location: `file_upload:${fileName}`,
      dataClassification: DataClassification.CONFIDENTIAL,
      ...context,
    });

    const criticalViolations = scanResult.violations.filter(v => 
      v.severity === AuditSeverity.CRITICAL
    );

    return {
      allowed: !scanResult.blocked && criticalViolations.length === 0,
      violations: scanResult.violations,
      reason: scanResult.blocked 
        ? 'File contains sensitive data that violates DLP policies'
        : undefined,
    };
  }

  /**
   * Scan API request/response for sensitive data
   */
  static async scanAPIData(
    data: any,
    context: {
      endpoint: string;
      method: string;
      direction: 'request' | 'response';
      userId?: string;
      organizationId?: string;
      request?: NextRequest;
    }
  ): Promise<{
    processedData: any;
    violations: DLPViolation[];
    blocked: boolean;
  }> {
    const jsonString = JSON.stringify(data, null, 2);
    
    const scanResult = await this.scanContent(jsonString, {
      location: `api:${context.method}:${context.endpoint}:${context.direction}`,
      dataClassification: DataClassification.CONFIDENTIAL,
      ...context,
    });

    let processedData = data;
    
    if (scanResult.processedContent !== jsonString) {
      try {
        processedData = JSON.parse(scanResult.processedContent);
      } catch {
        // If parsing fails, return original data with warning
        console.warn('Failed to parse DLP-processed JSON, returning original data');
      }
    }

    return {
      processedData,
      violations: scanResult.violations,
      blocked: scanResult.blocked,
    };
  }

  /**
   * Scan database query for sensitive data exposure
   */
  static async scanDatabaseQuery(
    query: string,
    results: any[],
    context: {
      table: string;
      userId?: string;
      organizationId?: string;
    }
  ): Promise<{
    processedResults: any[];
    violations: DLPViolation[];
    blocked: boolean;
  }> {
    const violations: DLPViolation[] = [];
    const processedResults = [...results];
    let blocked = false;

    // Scan query for sensitive patterns
    const queryResult = await this.scanContent(query, {
      location: `database:${context.table}:query`,
      dataClassification: DataClassification.INTERNAL,
      ...context,
    });

    violations.push(...queryResult.violations);
    if (queryResult.blocked) blocked = true;

    // Scan results for sensitive data
    for (let i = 0; i < results.length; i++) {
      const resultString = JSON.stringify(results[i]);
      const resultScan = await this.scanContent(resultString, {
        location: `database:${context.table}:result`,
        dataClassification: DataClassification.CONFIDENTIAL,
        ...context,
      });

      violations.push(...resultScan.violations);
      
      if (resultScan.blocked) {
        blocked = true;
      } else if (resultScan.processedContent !== resultString) {
        try {
          processedResults[i] = JSON.parse(resultScan.processedContent);
        } catch {
          // Keep original if parsing fails
        }
      }
    }

    return {
      processedResults,
      violations,
      blocked,
    };
  }

  /**
   * Get DLP violations
   */
  static getDLPViolations(filters?: {
    ruleType?: DLPRuleType;
    severity?: AuditSeverity;
    userId?: string;
    organizationId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): DLPViolation[] {
    let violations = [...this.violations];

    if (filters?.ruleType) {
      violations = violations.filter(v => v.type === filters.ruleType);
    }

    if (filters?.severity) {
      violations = violations.filter(v => v.severity === filters.severity);
    }

    if (filters?.userId) {
      violations = violations.filter(v => v.userId === filters.userId);
    }

    if (filters?.organizationId) {
      violations = violations.filter(v => v.organizationId === filters.organizationId);
    }

    if (filters?.startDate) {
      violations = violations.filter(v => v.timestamp >= filters.startDate!);
    }

    if (filters?.endDate) {
      violations = violations.filter(v => v.timestamp <= filters.endDate!);
    }

    // Sort by timestamp (newest first)
    violations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters?.limit) {
      violations = violations.slice(0, filters.limit);
    }

    return violations;
  }

  /**
   * Get DLP statistics
   */
  static getDLPStatistics(timeWindow: number = 24 * 60 * 60 * 1000): {
    totalViolations: number;
    violationsBySeverity: Record<AuditSeverity, number>;
    violationsByType: Record<DLPRuleType, number>;
    blockedAttempts: number;
    topViolatingUsers: Array<{ userId: string; count: number }>;
    topViolatingRules: Array<{ ruleId: string; ruleName: string; count: number }>;
  } {
    const now = Date.now();
    const windowStart = now - timeWindow;
    
    const recentViolations = this.violations.filter(v => 
      v.timestamp.getTime() > windowStart
    );

    const violationsBySeverity = recentViolations.reduce((acc, v) => {
      acc[v.severity] = (acc[v.severity] || 0) + 1;
      return acc;
    }, {} as Record<AuditSeverity, number>);

    const violationsByType = recentViolations.reduce((acc, v) => {
      acc[v.type] = (acc[v.type] || 0) + 1;
      return acc;
    }, {} as Record<DLPRuleType, number>);

    const blockedAttempts = recentViolations.filter(v => v.blocked).length;

    const userCounts = recentViolations.reduce((acc, v) => {
      if (v.userId) {
        acc[v.userId] = (acc[v.userId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const topViolatingUsers = Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const ruleCounts = recentViolations.reduce((acc, v) => {
      acc[v.ruleId] = (acc[v.ruleId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topViolatingRules = Object.entries(ruleCounts)
      .map(([ruleId, count]) => {
        const rule = this.dlpRules.find(r => r.id === ruleId);
        return { ruleId, ruleName: rule?.name || 'Unknown', count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalViolations: recentViolations.length,
      violationsBySeverity,
      violationsByType,
      blockedAttempts,
      topViolatingUsers,
      topViolatingRules,
    };
  }

  /**
   * Initialize the DLP service
   */
  static initialize(): void {
    this.initializeDefaultRules();
    console.log('Data Loss Prevention service initialized with', this.dlpRules.length, 'rules');
  }
}

// Initialize the service when the module is loaded
if (typeof window === 'undefined') {
  DataLossPreventionService.initialize();
}