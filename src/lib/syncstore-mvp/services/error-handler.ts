/**
 * SyncStore MVP Global Error Handler
 * 
 * This service provides centralized error handling, logging, and recovery
 * mechanisms for the entire SyncStore MVP application.
 */

import {
  SyncStoreError,
  ShopeeApiError,
  ValidationError,
  ConnectionError,
  SyncError,
  DatabaseError,
  categorizeError,
  sanitizeErrorForLogging,
  formatErrorForUser,
  createErrorContext,
} from '../index';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ErrorHandlerConfig {
  enableConsoleLogging: boolean;
  enableExternalLogging: boolean;
  enableUserNotifications: boolean;
  enableAutoRecovery: boolean;
  maxRetryAttempts: number;
  retryDelay: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface ErrorLog {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  error?: any;
  context?: Record<string, any>;
  category: 'user' | 'system' | 'external' | 'configuration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  handled: boolean;
  recovered: boolean;
}

export interface RecoveryAction {
  type: 'retry' | 'refresh' | 'reconnect' | 'fallback' | 'manual';
  description: string;
  action: () => Promise<void>;
  maxAttempts: number;
  currentAttempts: number;
}

export interface ErrorNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
  autoClose?: boolean;
  duration?: number;
}

// ============================================================================
// Global Error Handler Service
// ============================================================================

export class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;
  private config: ErrorHandlerConfig;
  private errorLogs: ErrorLog[] = [];
  private recoveryActions = new Map<string, RecoveryAction>();
  private notificationCallbacks: Array<(notification: ErrorNotification) => void> = [];
  private readonly maxLogEntries = 1000;

  private constructor(config?: Partial<ErrorHandlerConfig>) {
    this.config = {
      enableConsoleLogging: true,
      enableExternalLogging: process.env.NODE_ENV === 'production',
      enableUserNotifications: true,
      enableAutoRecovery: true,
      maxRetryAttempts: 3,
      retryDelay: 1000,
      logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      ...config,
    };

    // Set up global error handlers
    this.setupGlobalHandlers();
  }

  static getInstance(config?: Partial<ErrorHandlerConfig>): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler(config);
    }
    return GlobalErrorHandler.instance;
  }

  // ============================================================================
  // Error Handling Methods
  // ============================================================================

  /**
   * Handles any error with appropriate categorization and recovery
   */
  async handleError(
    error: Error,
    context?: Record<string, any>,
    recoveryActions?: RecoveryAction[]
  ): Promise<void> {
    const errorId = this.generateErrorId();
    const { category, severity, alertRequired } = categorizeError(error);
    
    // Create error log
    const errorLog: ErrorLog = {
      id: errorId,
      timestamp: new Date(),
      level: severity === 'critical' ? 'error' : severity === 'high' ? 'error' : 'warn',
      message: error.message,
      error: sanitizeErrorForLogging(error),
      context,
      category,
      severity,
      handled: true,
      recovered: false,
    };

    this.addErrorLog(errorLog);

    // Console logging
    if (this.config.enableConsoleLogging) {
      this.logToConsole(errorLog);
    }

    // External logging
    if (this.config.enableExternalLogging) {
      await this.logToExternalService(errorLog);
    }

    // User notifications
    if (this.config.enableUserNotifications && alertRequired) {
      this.notifyUser(error, errorId, recoveryActions);
    }

    // Auto recovery
    if (this.config.enableAutoRecovery && recoveryActions) {
      await this.attemptAutoRecovery(errorId, recoveryActions);
    }
  }

  /**
   * Handles API errors specifically
   */
  async handleApiError(
    error: ShopeeApiError,
    operation: string,
    storeId?: string
  ): Promise<void> {
    const context = createErrorContext(operation, { storeId });
    
    // Create recovery actions based on error type
    const recoveryActions: RecoveryAction[] = [];

    if (error.isTokenExpired) {
      recoveryActions.push({
        type: 'reconnect',
        description: 'Refresh store connection tokens',
        action: async () => {
          // Would call connection refresh service
          console.log('Attempting to refresh tokens...');
        },
        maxAttempts: 1,
        currentAttempts: 0,
      });
    }

    if (error.isRetryable) {
      recoveryActions.push({
        type: 'retry',
        description: 'Retry the API call',
        action: async () => {
          // Would retry the original operation
          console.log('Retrying API call...');
        },
        maxAttempts: this.config.maxRetryAttempts,
        currentAttempts: 0,
      });
    }

    await this.handleError(error, context, recoveryActions);
  }

  /**
   * Handles sync errors specifically
   */
  async handleSyncError(
    error: SyncError,
    storeId: string
  ): Promise<void> {
    const context = createErrorContext('sync', { 
      storeId, 
      syncType: error.syncType,
      productsProcessed: error.productsProcessed 
    });

    const recoveryActions: RecoveryAction[] = [
      {
        type: 'retry',
        description: 'Retry the sync operation',
        action: async () => {
          // Would call sync retry service
          console.log('Retrying sync operation...');
        },
        maxAttempts: 2,
        currentAttempts: 0,
      },
      {
        type: 'fallback',
        description: 'Switch to manual sync mode',
        action: async () => {
          // Would enable manual sync mode
          console.log('Switching to manual sync mode...');
        },
        maxAttempts: 1,
        currentAttempts: 0,
      },
    ];

    await this.handleError(error, context, recoveryActions);
  }

  /**
   * Handles database errors specifically
   */
  async handleDatabaseError(
    error: DatabaseError,
    operation: string
  ): Promise<void> {
    const context = createErrorContext(operation, { 
      table: error.table,
      operation: error.operation 
    });

    const recoveryActions: RecoveryAction[] = [
      {
        type: 'retry',
        description: 'Retry the database operation',
        action: async () => {
          // Would retry the database operation
          console.log('Retrying database operation...');
        },
        maxAttempts: 2,
        currentAttempts: 0,
      },
    ];

    await this.handleError(error, context, recoveryActions);
  }

  // ============================================================================
  // Logging Methods
  // ============================================================================

  /**
   * Logs info message
   */
  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, undefined, context);
  }

  /**
   * Logs warning message
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, undefined, context);
  }

  /**
   * Logs error message
   */
  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log('error', message, error, context);
  }

  /**
   * Logs debug message
   */
  debug(message: string, context?: Record<string, any>): void {
    if (this.config.logLevel === 'debug') {
      this.log('debug', message, undefined, context);
    }
  }

  // ============================================================================
  // Recovery Methods
  // ============================================================================

  /**
   * Registers a recovery action for an error
   */
  registerRecoveryAction(errorId: string, action: RecoveryAction): void {
    this.recoveryActions.set(errorId, action);
  }

  /**
   * Executes a recovery action
   */
  async executeRecoveryAction(errorId: string): Promise<boolean> {
    const action = this.recoveryActions.get(errorId);
    if (!action) {
      return false;
    }

    try {
      action.currentAttempts++;
      await action.action();
      
      // Mark error as recovered
      const errorLog = this.errorLogs.find(log => log.id === errorId);
      if (errorLog) {
        errorLog.recovered = true;
      }

      return true;
    } catch (error) {
      console.error(`Recovery action failed for error ${errorId}:`, error);
      return false;
    }
  }

  // ============================================================================
  // Notification Methods
  // ============================================================================

  /**
   * Registers a notification callback
   */
  onNotification(callback: (notification: ErrorNotification) => void): void {
    this.notificationCallbacks.push(callback);
  }

  /**
   * Removes a notification callback
   */
  offNotification(callback: (notification: ErrorNotification) => void): void {
    const index = this.notificationCallbacks.indexOf(callback);
    if (index > -1) {
      this.notificationCallbacks.splice(index, 1);
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Gets error statistics
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByCategory: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recoveredErrors: number;
    recentErrors: ErrorLog[];
  } {
    const errorsByCategory: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    let recoveredErrors = 0;

    for (const log of this.errorLogs) {
      errorsByCategory[log.category] = (errorsByCategory[log.category] || 0) + 1;
      errorsBySeverity[log.severity] = (errorsBySeverity[log.severity] || 0) + 1;
      
      if (log.recovered) {
        recoveredErrors++;
      }
    }

    const recentErrors = this.errorLogs
      .filter(log => log.level === 'error')
      .slice(-10)
      .reverse();

    return {
      totalErrors: this.errorLogs.length,
      errorsByCategory,
      errorsBySeverity,
      recoveredErrors,
      recentErrors,
    };
  }

  /**
   * Clears old error logs
   */
  clearOldLogs(olderThan: Date): number {
    const initialLength = this.errorLogs.length;
    this.errorLogs = this.errorLogs.filter(log => log.timestamp > olderThan);
    return initialLength - this.errorLogs.length;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addErrorLog(errorLog: ErrorLog): void {
    this.errorLogs.push(errorLog);
    
    // Keep only the most recent logs
    if (this.errorLogs.length > this.maxLogEntries) {
      this.errorLogs = this.errorLogs.slice(-this.maxLogEntries);
    }
  }

  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    error?: Error,
    context?: Record<string, any>
  ): void {
    const errorLog: ErrorLog = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      level,
      message,
      error: error ? sanitizeErrorForLogging(error) : undefined,
      context,
      category: 'system',
      severity: level === 'error' ? 'high' : level === 'warn' ? 'medium' : 'low',
      handled: true,
      recovered: false,
    };

    this.addErrorLog(errorLog);

    if (this.config.enableConsoleLogging) {
      this.logToConsole(errorLog);
    }
  }

  private logToConsole(errorLog: ErrorLog): void {
    const logMessage = `[${errorLog.timestamp.toISOString()}] ${errorLog.level.toUpperCase()}: ${errorLog.message}`;
    
    switch (errorLog.level) {
      case 'debug':
        console.debug(logMessage, errorLog.context);
        break;
      case 'info':
        console.info(logMessage, errorLog.context);
        break;
      case 'warn':
        console.warn(logMessage, errorLog.context);
        break;
      case 'error':
        console.error(logMessage, errorLog.error, errorLog.context);
        break;
    }
  }

  private async logToExternalService(errorLog: ErrorLog): Promise<void> {
    try {
      // Example: Send to external logging service
      // await fetch('/api/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorLog),
      // });
    } catch (error) {
      console.warn('Failed to send log to external service:', error);
    }
  }

  private notifyUser(
    error: Error,
    errorId: string,
    recoveryActions?: RecoveryAction[]
  ): void {
    const notification: ErrorNotification = {
      id: errorId,
      title: 'Error Occurred',
      message: formatErrorForUser(error),
      type: 'error',
      actions: recoveryActions?.map(action => ({
        label: action.description,
        action: () => this.executeRecoveryAction(errorId),
      })),
      autoClose: false,
    };

    // Notify all registered callbacks
    for (const callback of this.notificationCallbacks) {
      try {
        callback(notification);
      } catch (error) {
        console.error('Notification callback failed:', error);
      }
    }
  }

  private async attemptAutoRecovery(
    errorId: string,
    recoveryActions: RecoveryAction[]
  ): Promise<void> {
    for (const action of recoveryActions) {
      if (action.currentAttempts >= action.maxAttempts) {
        continue;
      }

      try {
        console.log(`🔄 Attempting auto recovery: ${action.description}`);
        await action.action();
        
        // Mark as recovered
        const errorLog = this.errorLogs.find(log => log.id === errorId);
        if (errorLog) {
          errorLog.recovered = true;
        }

        console.log(`✅ Auto recovery successful: ${action.description}`);
        return;
      } catch (recoveryError) {
        console.error(`❌ Auto recovery failed: ${action.description}`, recoveryError);
        action.currentAttempts++;
      }
    }
  }

  private setupGlobalHandlers(): void {
    // Handle unhandled promise rejections
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
        this.handleError(error, { type: 'unhandledRejection' });
      });

      // Handle global errors
      window.addEventListener('error', (event) => {
        const error = event.error instanceof Error ? event.error : new Error(event.message);
        this.handleError(error, { 
          type: 'globalError',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      });
    }

    // Handle Node.js unhandled rejections
    if (typeof process !== 'undefined') {
      process.on('unhandledRejection', (reason, promise) => {
        const error = reason instanceof Error ? reason : new Error(String(reason));
        this.handleError(error, { type: 'unhandledRejection', promise });
      });

      process.on('uncaughtException', (error) => {
        this.handleError(error, { type: 'uncaughtException' });
      });
    }
  }
}

// ============================================================================
// Factory Functions and Utilities
// ============================================================================

/**
 * Gets the global error handler instance
 */
export function getGlobalErrorHandler(config?: Partial<ErrorHandlerConfig>): GlobalErrorHandler {
  return GlobalErrorHandler.getInstance(config);
}

/**
 * Convenience function to handle errors
 */
export async function handleError(
  error: Error,
  context?: Record<string, any>,
  recoveryActions?: RecoveryAction[]
): Promise<void> {
  const handler = getGlobalErrorHandler();
  await handler.handleError(error, context, recoveryActions);
}

/**
 * Convenience function to handle API errors
 */
export async function handleApiError(
  error: ShopeeApiError,
  operation: string,
  storeId?: string
): Promise<void> {
  const handler = getGlobalErrorHandler();
  await handler.handleApiError(error, operation, storeId);
}

/**
 * Convenience function to handle sync errors
 */
export async function handleSyncError(
  error: SyncError,
  storeId: string
): Promise<void> {
  const handler = getGlobalErrorHandler();
  await handler.handleSyncError(error, storeId);
}

/**
 * Convenience function to handle database errors
 */
export async function handleDatabaseError(
  error: DatabaseError,
  operation: string
): Promise<void> {
  const handler = getGlobalErrorHandler();
  await handler.handleDatabaseError(error, operation);
}

/**
 * Creates a recovery action
 */
export function createRecoveryAction(
  type: RecoveryAction['type'],
  description: string,
  action: () => Promise<void>,
  maxAttempts: number = 3
): RecoveryAction {
  return {
    type,
    description,
    action,
    maxAttempts,
    currentAttempts: 0,
  };
}

/**
 * Initializes global error handling
 */
export function initializeErrorHandling(config?: Partial<ErrorHandlerConfig>): GlobalErrorHandler {
  const handler = getGlobalErrorHandler(config);
  
  console.log('✅ Global error handling initialized');
  console.log(`📊 Config: ${JSON.stringify(handler['config'], null, 2)}`);
  
  return handler;
}