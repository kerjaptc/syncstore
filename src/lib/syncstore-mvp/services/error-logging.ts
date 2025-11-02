/**
 * SyncStore MVP Error Logging Service
 * 
 * This service provides comprehensive error logging, reporting, and analytics
 * for monitoring application health and debugging issues.
 */

import { z } from 'zod';
import {
  SyncStoreError,
  ShopeeApiError,
  ValidationError,
  ConnectionError,
  SyncError,
  DatabaseError,
  createErrorContext,
} from '../index';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ErrorLogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
    cause?: any;
  };
  context: {
    userId?: string;
    storeId?: string;
    operation?: string;
    component?: string;
    url?: string;
    userAgent?: string;
    sessionId?: string;
    requestId?: string;
    [key: string]: any;
  };
  category: 'user' | 'system' | 'external' | 'configuration' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  metadata: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByLevel: Record<string, number>;
  errorsByCategory: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  errorsByTag: Record<string, number>;
  errorRate: number;
  averageResolutionTime: number;
  topErrors: Array<{
    message: string;
    count: number;
    lastOccurrence: Date;
  }>;
  recentErrors: ErrorLogEntry[];
}

export interface ErrorLoggingConfig {
  maxLogEntries: number;
  enableConsoleLogging: boolean;
  enableFileLogging: boolean;
  enableExternalLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  retentionDays: number;
  batchSize: number;
  flushInterval: number;
  externalEndpoint?: string;
  apiKey?: string;
}

export interface ErrorAlert {
  id: string;
  errorId: string;
  type: 'threshold' | 'pattern' | 'critical';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  triggered: boolean;
  triggeredAt?: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

// Validation schemas
const ErrorLogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']),
  message: z.string(),
  error: z.object({
    name: z.string(),
    message: z.string(),
    stack: z.string().optional(),
    cause: z.any().optional(),
  }).optional(),
  context: z.record(z.any()),
  category: z.enum(['user', 'system', 'external', 'configuration', 'security']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  tags: z.array(z.string()),
  metadata: z.record(z.any()),
  resolved: z.boolean(),
  resolvedAt: z.date().optional(),
  resolvedBy: z.string().optional(),
  resolution: z.string().optional(),
});

// ============================================================================
// Error Categorization and Analysis
// ============================================================================

class ErrorAnalyzer {
  /**
   * Categorizes an error based on its type and message
   */
  static categorizeError(error: Error): {
    category: ErrorLogEntry['category'];
    severity: ErrorLogEntry['severity'];
    tags: string[];
  } {
    const message = error.message.toLowerCase();
    const errorType = error.constructor.name;

    let category: ErrorLogEntry['category'] = 'system';
    let severity: ErrorLogEntry['severity'] = 'medium';
    const tags: string[] = [errorType];

    // Categorize by error type
    if (error instanceof ShopeeApiError) {
      category = 'external';
      tags.push('api', 'shopee');
      
      if (error.isTokenExpired) {
        severity = 'high';
        tags.push('authentication');
      } else if (error.isRateLimited) {
        severity = 'medium';
        tags.push('rate-limit');
      } else if (error.statusCode >= 500) {
        severity = 'high';
        tags.push('server-error');
      }
    } else if (error instanceof ValidationError) {
      category = 'user';
      severity = 'low';
      tags.push('validation');
    } else if (error instanceof ConnectionError) {
      category = 'external';
      severity = 'high';
      tags.push('connection', 'network');
    } else if (error instanceof SyncError) {
      category = 'system';
      severity = 'medium';
      tags.push('sync', 'data');
    } else if (error instanceof DatabaseError) {
      category = 'system';
      severity = 'high';
      tags.push('database', 'storage');
    }

    // Analyze message content
    if (message.includes('network') || message.includes('fetch')) {
      tags.push('network');
      severity = 'medium';
    }
    
    if (message.includes('permission') || message.includes('unauthorized')) {
      category = 'security';
      severity = 'high';
      tags.push('security', 'authorization');
    }
    
    if (message.includes('timeout')) {
      tags.push('timeout');
      severity = 'medium';
    }
    
    if (message.includes('memory') || message.includes('out of')) {
      severity = 'critical';
      tags.push('resource');
    }

    return { category, severity, tags };
  }

  /**
   * Determines if an error should trigger an alert
   */
  static shouldAlert(error: Error, context: Record<string, any>): boolean {
    const { severity, category } = this.categorizeError(error);
    
    // Always alert on critical errors
    if (severity === 'critical') {
      return true;
    }
    
    // Alert on security issues
    if (category === 'security') {
      return true;
    }
    
    // Alert on database errors
    if (error instanceof DatabaseError) {
      return true;
    }
    
    // Alert on repeated sync failures
    if (error instanceof SyncError && context.retryCount && context.retryCount > 2) {
      return true;
    }
    
    return false;
  }

  /**
   * Extracts relevant context from error
   */
  static extractContext(error: Error, additionalContext?: Record<string, any>): Record<string, any> {
    const context: Record<string, any> = {
      errorType: error.constructor.name,
      timestamp: new Date().toISOString(),
      ...additionalContext,
    };

    // Add browser context if available
    if (typeof window !== 'undefined') {
      context.url = window.location.href;
      context.userAgent = window.navigator.userAgent;
      context.viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    }

    // Add specific error context
    if (error instanceof ShopeeApiError) {
      context.statusCode = error.statusCode;
      context.endpoint = error.endpoint;
      context.isRetryable = error.isRetryable;
    } else if (error instanceof SyncError) {
      context.storeId = error.storeId;
      context.syncType = error.syncType;
      context.productsProcessed = error.productsProcessed;
    } else if (error instanceof DatabaseError) {
      context.table = error.table;
      context.operation = error.operation;
    }

    return context;
  }
}

// ============================================================================
// Error Logging Service
// ============================================================================

export class ErrorLoggingService {
  private static instance: ErrorLoggingService;
  private config: ErrorLoggingConfig;
  private logEntries: ErrorLogEntry[] = [];
  private alerts: ErrorAlert[] = [];
  private batchQueue: ErrorLogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private sessionId: string;

  private constructor(config?: Partial<ErrorLoggingConfig>) {
    this.config = {
      maxLogEntries: 10000,
      enableConsoleLogging: true,
      enableFileLogging: process.env.NODE_ENV === 'production',
      enableExternalLogging: process.env.NODE_ENV === 'production',
      logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      retentionDays: 30,
      batchSize: 50,
      flushInterval: 30000, // 30 seconds
      ...config,
    };

    this.sessionId = this.generateSessionId();
    this.startFlushTimer();
  }

  static getInstance(config?: Partial<ErrorLoggingConfig>): ErrorLoggingService {
    if (!ErrorLoggingService.instance) {
      ErrorLoggingService.instance = new ErrorLoggingService(config);
    }
    return ErrorLoggingService.instance;
  }

  // ============================================================================
  // Logging Methods
  // ============================================================================

  /**
   * Logs an error with full context and analysis
   */
  async logError(
    error: Error,
    context?: Record<string, any>,
    level: ErrorLogEntry['level'] = 'error'
  ): Promise<string> {
    const { category, severity, tags } = ErrorAnalyzer.categorizeError(error);
    const fullContext = ErrorAnalyzer.extractContext(error, {
      ...context,
      sessionId: this.sessionId,
    });

    const logEntry: ErrorLogEntry = {
      id: this.generateLogId(),
      timestamp: new Date(),
      level,
      message: error.message,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: (error as any).cause,
      },
      context: fullContext,
      category,
      severity,
      tags,
      metadata: {},
      resolved: false,
    };

    await this.addLogEntry(logEntry);

    // Check if we should create an alert
    if (ErrorAnalyzer.shouldAlert(error, fullContext)) {
      await this.createAlert(logEntry);
    }

    return logEntry.id;
  }

  /**
   * Logs a message with specified level
   */
  async log(
    level: ErrorLogEntry['level'],
    message: string,
    context?: Record<string, any>
  ): Promise<string> {
    if (!this.shouldLog(level)) {
      return '';
    }

    const logEntry: ErrorLogEntry = {
      id: this.generateLogId(),
      timestamp: new Date(),
      level,
      message,
      context: {
        ...context,
        sessionId: this.sessionId,
      },
      category: 'system',
      severity: level === 'fatal' ? 'critical' : level === 'error' ? 'high' : 'low',
      tags: [level],
      metadata: {},
      resolved: level !== 'error' && level !== 'fatal',
    };

    await this.addLogEntry(logEntry);
    return logEntry.id;
  }

  /**
   * Convenience methods for different log levels
   */
  async debug(message: string, context?: Record<string, any>): Promise<string> {
    return this.log('debug', message, context);
  }

  async info(message: string, context?: Record<string, any>): Promise<string> {
    return this.log('info', message, context);
  }

  async warn(message: string, context?: Record<string, any>): Promise<string> {
    return this.log('warn', message, context);
  }

  async error(message: string, context?: Record<string, any>): Promise<string> {
    return this.log('error', message, context);
  }

  async fatal(message: string, context?: Record<string, any>): Promise<string> {
    return this.log('fatal', message, context);
  }

  // ============================================================================
  // Error Resolution Methods
  // ============================================================================

  /**
   * Marks an error as resolved
   */
  async resolveError(
    errorId: string,
    resolution: string,
    resolvedBy?: string
  ): Promise<boolean> {
    const logEntry = this.logEntries.find(entry => entry.id === errorId);
    if (!logEntry) {
      return false;
    }

    logEntry.resolved = true;
    logEntry.resolvedAt = new Date();
    logEntry.resolvedBy = resolvedBy;
    logEntry.resolution = resolution;

    // Also resolve any related alerts
    const relatedAlerts = this.alerts.filter(alert => alert.errorId === errorId);
    for (const alert of relatedAlerts) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = resolvedBy;
    }

    await this.persistLogEntry(logEntry);
    return true;
  }

  /**
   * Bulk resolve errors by pattern
   */
  async resolveErrorsByPattern(
    pattern: string | RegExp,
    resolution: string,
    resolvedBy?: string
  ): Promise<number> {
    let resolvedCount = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;

    for (const logEntry of this.logEntries) {
      if (!logEntry.resolved && regex.test(logEntry.message)) {
        await this.resolveError(logEntry.id, resolution, resolvedBy);
        resolvedCount++;
      }
    }

    return resolvedCount;
  }

  // ============================================================================
  // Analytics and Metrics
  // ============================================================================

  /**
   * Gets comprehensive error metrics
   */
  getErrorMetrics(timeRange?: { start: Date; end: Date }): ErrorMetrics {
    let entries = this.logEntries;

    // Filter by time range if provided
    if (timeRange) {
      entries = entries.filter(
        entry => entry.timestamp >= timeRange.start && entry.timestamp <= timeRange.end
      );
    }

    const errorsByLevel: Record<string, number> = {};
    const errorsByCategory: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    const errorsByTag: Record<string, number> = {};
    const errorCounts: Record<string, number> = {};

    let totalResolutionTime = 0;
    let resolvedCount = 0;

    for (const entry of entries) {
      // Count by level
      errorsByLevel[entry.level] = (errorsByLevel[entry.level] || 0) + 1;
      
      // Count by category
      errorsByCategory[entry.category] = (errorsByCategory[entry.category] || 0) + 1;
      
      // Count by severity
      errorsBySeverity[entry.severity] = (errorsBySeverity[entry.severity] || 0) + 1;
      
      // Count by tags
      for (const tag of entry.tags) {
        errorsByTag[tag] = (errorsByTag[tag] || 0) + 1;
      }
      
      // Count error messages
      errorCounts[entry.message] = (errorCounts[entry.message] || 0) + 1;
      
      // Calculate resolution time
      if (entry.resolved && entry.resolvedAt) {
        totalResolutionTime += entry.resolvedAt.getTime() - entry.timestamp.getTime();
        resolvedCount++;
      }
    }

    // Get top errors
    const topErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([message, count]) => {
        const lastEntry = entries
          .filter(entry => entry.message === message)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
        
        return {
          message,
          count,
          lastOccurrence: lastEntry.timestamp,
        };
      });

    // Get recent errors
    const recentErrors = entries
      .filter(entry => entry.level === 'error' || entry.level === 'fatal')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 20);

    const totalTime = timeRange 
      ? timeRange.end.getTime() - timeRange.start.getTime()
      : Date.now() - (entries[0]?.timestamp.getTime() || Date.now());

    return {
      totalErrors: entries.length,
      errorsByLevel,
      errorsByCategory,
      errorsBySeverity,
      errorsByTag,
      errorRate: entries.length / (totalTime / (1000 * 60 * 60)), // errors per hour
      averageResolutionTime: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
      topErrors,
      recentErrors,
    };
  }

  /**
   * Gets error trends over time
   */
  getErrorTrends(
    timeRange: { start: Date; end: Date },
    interval: 'hour' | 'day' | 'week' = 'hour'
  ): Array<{ timestamp: Date; count: number; level: Record<string, number> }> {
    const entries = this.logEntries.filter(
      entry => entry.timestamp >= timeRange.start && entry.timestamp <= timeRange.end
    );

    const intervalMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
    }[interval];

    const buckets = new Map<number, { count: number; level: Record<string, number> }>();

    for (const entry of entries) {
      const bucketKey = Math.floor(entry.timestamp.getTime() / intervalMs) * intervalMs;
      
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, { count: 0, level: {} });
      }
      
      const bucket = buckets.get(bucketKey)!;
      bucket.count++;
      bucket.level[entry.level] = (bucket.level[entry.level] || 0) + 1;
    }

    return Array.from(buckets.entries())
      .map(([timestamp, data]) => ({
        timestamp: new Date(timestamp),
        ...data,
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // ============================================================================
  // Alert Management
  // ============================================================================

  /**
   * Creates an alert for a log entry
   */
  private async createAlert(logEntry: ErrorLogEntry): Promise<void> {
    const alert: ErrorAlert = {
      id: this.generateAlertId(),
      errorId: logEntry.id,
      type: logEntry.severity === 'critical' ? 'critical' : 'threshold',
      title: `${logEntry.severity.toUpperCase()}: ${logEntry.category} error`,
      description: logEntry.message,
      severity: logEntry.severity,
      triggered: true,
      triggeredAt: new Date(),
      acknowledged: false,
    };

    this.alerts.push(alert);
    
    // Notify alert handlers
    await this.notifyAlertHandlers(alert);
  }

  /**
   * Gets active alerts
   */
  getActiveAlerts(): ErrorAlert[] {
    return this.alerts.filter(alert => alert.triggered && !alert.acknowledged);
  }

  /**
   * Acknowledges an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) {
      return false;
    }

    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    return true;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private shouldLog(level: ErrorLogEntry['level']): boolean {
    const levels = ['debug', 'info', 'warn', 'error', 'fatal'];
    const configLevelIndex = levels.indexOf(this.config.logLevel);
    const logLevelIndex = levels.indexOf(level);
    
    return logLevelIndex >= configLevelIndex;
  }

  private async addLogEntry(logEntry: ErrorLogEntry): Promise<void> {
    // Validate log entry
    try {
      ErrorLogEntrySchema.parse(logEntry);
    } catch (error) {
      console.error('Invalid log entry:', error);
      return;
    }

    this.logEntries.push(logEntry);
    
    // Maintain max entries limit
    if (this.logEntries.length > this.config.maxLogEntries) {
      this.logEntries = this.logEntries.slice(-this.config.maxLogEntries);
    }

    // Console logging
    if (this.config.enableConsoleLogging) {
      this.logToConsole(logEntry);
    }

    // Add to batch queue for external logging
    if (this.config.enableExternalLogging) {
      this.batchQueue.push(logEntry);
    }

    // Persist immediately for critical errors
    if (logEntry.severity === 'critical') {
      await this.persistLogEntry(logEntry);
    }
  }

  private logToConsole(logEntry: ErrorLogEntry): void {
    const message = `[${logEntry.timestamp.toISOString()}] ${logEntry.level.toUpperCase()}: ${logEntry.message}`;
    
    switch (logEntry.level) {
      case 'debug':
        console.debug(message, logEntry.context);
        break;
      case 'info':
        console.info(message, logEntry.context);
        break;
      case 'warn':
        console.warn(message, logEntry.context);
        break;
      case 'error':
      case 'fatal':
        console.error(message, logEntry.error, logEntry.context);
        break;
    }
  }

  private async persistLogEntry(logEntry: ErrorLogEntry): Promise<void> {
    try {
      // In a real implementation, this would save to database
      // await this.database.logEntries.create(logEntry);
    } catch (error) {
      console.error('Failed to persist log entry:', error);
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushBatchQueue().catch(error => {
        console.error('Failed to flush batch queue:', error);
      });
    }, this.config.flushInterval);
  }

  private async flushBatchQueue(): Promise<void> {
    if (this.batchQueue.length === 0) {
      return;
    }

    const batch = this.batchQueue.splice(0, this.config.batchSize);
    
    try {
      await this.sendToExternalService(batch);
    } catch (error) {
      console.error('Failed to send logs to external service:', error);
      // Re-add failed entries to queue
      this.batchQueue.unshift(...batch);
    }
  }

  private async sendToExternalService(logEntries: ErrorLogEntry[]): Promise<void> {
    if (!this.config.externalEndpoint) {
      return;
    }

    const response = await fetch(this.config.externalEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
      },
      body: JSON.stringify({
        logs: logEntries,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`External logging failed: ${response.status} ${response.statusText}`);
    }
  }

  private async notifyAlertHandlers(alert: ErrorAlert): Promise<void> {
    // In a real implementation, this would notify various alert channels
    // (email, Slack, PagerDuty, etc.)
    console.warn(`🚨 ALERT: ${alert.title} - ${alert.description}`);
  }

  /**
   * Cleanup method to be called on shutdown
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Flush remaining logs
    await this.flushBatchQueue();
  }
}

// ============================================================================
// Factory Functions and Utilities
// ============================================================================

/**
 * Gets the global error logging service instance
 */
export function getErrorLoggingService(config?: Partial<ErrorLoggingConfig>): ErrorLoggingService {
  return ErrorLoggingService.getInstance(config);
}

/**
 * Convenience function to log an error
 */
export async function logError(
  error: Error,
  context?: Record<string, any>,
  level?: ErrorLogEntry['level']
): Promise<string> {
  const service = getErrorLoggingService();
  return service.logError(error, context, level);
}

/**
 * Convenience function to log a message
 */
export async function logMessage(
  level: ErrorLogEntry['level'],
  message: string,
  context?: Record<string, any>
): Promise<string> {
  const service = getErrorLoggingService();
  return service.log(level, message, context);
}

/**
 * Initializes error logging with configuration
 */
export function initializeErrorLogging(config?: Partial<ErrorLoggingConfig>): ErrorLoggingService {
  const service = getErrorLoggingService(config);
  
  console.log('✅ Error logging service initialized');
  console.log(`📊 Config: ${JSON.stringify(service['config'], null, 2)}`);
  
  return service;
}

export default ErrorLoggingService;