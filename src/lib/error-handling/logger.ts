/**
 * Structured logging system with correlation IDs and sanitization
 */

import { LogLevel, LogEntry, AppError } from './types';
import { sanitizeForLogging, generateCorrelationId } from './utils';

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
  correlationIdHeader?: string;
  component: string;
}

export class Logger {
  private config: LoggerConfig;
  private correlationId: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      enableRemote: true,
      correlationIdHeader: 'x-correlation-id',
      component: 'unknown',
      ...config
    };
    this.correlationId = generateCorrelationId();
  }

  /**
   * Set correlation ID for this logger instance
   */
  setCorrelationId(correlationId: string): Logger {
    this.correlationId = correlationId;
    return this;
  }

  /**
   * Create a child logger with additional context
   */
  child(context: { component?: string; correlationId?: string }): Logger {
    return new Logger({
      ...this.config,
      component: context.component || this.config.component,
    }).setCorrelationId(context.correlationId || this.correlationId) as Logger;
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    const logMetadata = { ...metadata };
    
    if (error) {
      logMetadata.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    this.log(LogLevel.ERROR, message, logMetadata);
  }

  /**
   * Log fatal error message
   */
  fatal(message: string, error?: Error, metadata?: Record<string, any>): void {
    const logMetadata = { ...metadata };
    
    if (error) {
      logMetadata.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    this.log(LogLevel.FATAL, message, logMetadata);
  }

  /**
   * Log operation timing
   */
  time<T>(operation: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const startTime = Date.now();
    const operationId = generateCorrelationId();
    
    this.info(`Starting operation: ${operation}`, {
      ...metadata,
      operationId,
      operation
    });

    return fn()
      .then((result) => {
        const duration = Date.now() - startTime;
        this.info(`Completed operation: ${operation}`, {
          ...metadata,
          operationId,
          operation,
          duration,
          success: true
        });
        return result;
      })
      .catch((error) => {
        const duration = Date.now() - startTime;
        this.error(`Failed operation: ${operation}`, error, {
          ...metadata,
          operationId,
          operation,
          duration,
          success: false
        });
        throw error;
      });
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      correlationId: this.correlationId,
      component: this.config.component,
      metadata: metadata ? sanitizeForLogging(metadata) : undefined
    };

    // Extract user and organization context from metadata
    if (metadata?.userId) {
      logEntry.userId = metadata.userId;
    }
    if (metadata?.organizationId) {
      logEntry.organizationId = metadata.organizationId;
    }
    if (metadata?.operation) {
      logEntry.operation = metadata.operation;
    }
    if (metadata?.duration) {
      logEntry.duration = metadata.duration;
    }
    if (metadata?.requestId) {
      logEntry.requestId = metadata.requestId;
    }
    if (metadata?.sessionId) {
      logEntry.sessionId = metadata.sessionId;
    }

    // Output to different destinations
    if (this.config.enableConsole) {
      this.logToConsole(logEntry);
    }

    if (this.config.enableFile) {
      this.logToFile(logEntry);
    }

    if (this.config.enableRemote) {
      this.logToRemote(logEntry);
    }
  }

  /**
   * Check if message should be logged based on level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Log to console with formatting
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.component}] [${entry.correlationId}]`;
    
    const logData = {
      message: entry.message,
      ...(entry.metadata && Object.keys(entry.metadata).length > 0 ? { metadata: entry.metadata } : {}),
      ...(entry.userId ? { userId: entry.userId } : {}),
      ...(entry.organizationId ? { organizationId: entry.organizationId } : {}),
      ...(entry.operation ? { operation: entry.operation } : {}),
      ...(entry.duration ? { duration: `${entry.duration}ms` } : {})
    };

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(prefix, logData);
        break;
      case LogLevel.INFO:
        console.info(prefix, logData);
        break;
      case LogLevel.WARN:
        console.warn(prefix, logData);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(prefix, logData);
        break;
    }
  }

  /**
   * Log to file (placeholder for file logging implementation)
   */
  private logToFile(entry: LogEntry): void {
    // In a production environment, this would write to a log file
    // For now, we'll skip file logging in the browser environment
    if (typeof window === 'undefined') {
      // Server-side logging could be implemented here
      // e.g., using winston, pino, or similar logging library
    }
  }

  /**
   * Log to remote service (e.g., Sentry, LogRocket, etc.)
   */
  private logToRemote(entry: LogEntry): void {
    // This will be implemented when we set up Sentry integration
    // For now, we'll prepare the data structure
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      const sentry = (window as any).Sentry;
      
      sentry.addBreadcrumb({
        message: entry.message,
        level: this.mapLogLevelToSentryLevel(entry.level),
        data: entry.metadata,
        timestamp: entry.timestamp.getTime() / 1000
      });

      if (entry.level === LogLevel.ERROR || entry.level === LogLevel.FATAL) {
        sentry.withScope((scope: any) => {
          scope.setTag('component', entry.component);
          scope.setTag('correlationId', entry.correlationId);
          
          if (entry.userId) {
            scope.setUser({ id: entry.userId });
          }
          
          if (entry.organizationId) {
            scope.setTag('organizationId', entry.organizationId);
          }
          
          if (entry.operation) {
            scope.setTag('operation', entry.operation);
          }

          if (entry.metadata?.error) {
            const error = new Error(entry.message);
            error.stack = entry.metadata.error.stack;
            sentry.captureException(error);
          } else {
            sentry.captureMessage(entry.message, this.mapLogLevelToSentryLevel(entry.level));
          }
        });
      }
    }
  }

  /**
   * Map log level to Sentry severity level
   */
  private mapLogLevelToSentryLevel(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return 'debug';
      case LogLevel.INFO:
        return 'info';
      case LogLevel.WARN:
        return 'warning';
      case LogLevel.ERROR:
        return 'error';
      case LogLevel.FATAL:
        return 'fatal';
      default:
        return 'info';
    }
  }
}

// Global logger instance
let globalLogger: Logger | null = null;

/**
 * Get or create global logger instance
 */
export function getLogger(component?: string): Logger {
  if (!globalLogger) {
    globalLogger = new Logger({
      component: component || 'app',
      level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO
    });
  }

  if (component && component !== (globalLogger as any).config.component) {
    return globalLogger.child({ component });
  }

  return globalLogger;
}

/**
 * Create a logger for a specific component
 */
export function createLogger(component: string, config?: Partial<LoggerConfig>): Logger {
  return new Logger({
    component,
    level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
    ...config
  });
}