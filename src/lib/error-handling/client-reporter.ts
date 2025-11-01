/**
 * Client-side error reporting utility
 */

import { AppError } from './app-error';
import { ErrorSeverity } from './types';

interface ClientErrorReport {
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  userId?: string;
  organizationId?: string;
  level: 'error' | 'warning' | 'info';
  context?: Record<string, any>;
  timestamp: string;
}

class ClientErrorReporter {
  private queue: ClientErrorReport[] = [];
  private isOnline = true;
  private maxQueueSize = 50;
  private flushInterval = 5000; // 5 seconds
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    if (typeof window !== 'undefined') {
      this.setupEventListeners();
      this.startFlushTimer();
    }
  }

  /**
   * Report an error to the server
   */
  async reportError(
    error: Error | AppError | string,
    level: 'error' | 'warning' | 'info' = 'error',
    context?: Record<string, any>
  ): Promise<void> {
    if (typeof window === 'undefined') return;

    const errorReport: ClientErrorReport = {
      message: typeof error === 'string' ? error : error.message,
      stack: error instanceof Error ? error.stack : undefined,
      url: window.location.href,
      userAgent: navigator.userAgent,
      level,
      context,
      timestamp: new Date().toISOString()
    };

    // Add user context if available
    const userId = this.getUserId();
    const organizationId = this.getOrganizationId();
    
    if (userId) errorReport.userId = userId;
    if (organizationId) errorReport.organizationId = organizationId;

    // Add to queue
    this.addToQueue(errorReport);

    // Flush immediately for critical errors
    if (level === 'error') {
      await this.flush();
    }
  }

  /**
   * Report a performance issue
   */
  async reportPerformanceIssue(
    operation: string,
    duration: number,
    threshold: number = 5000,
    context?: Record<string, any>
  ): Promise<void> {
    if (duration > threshold) {
      await this.reportError(
        `Performance issue: ${operation} took ${duration}ms (threshold: ${threshold}ms)`,
        'warning',
        {
          operation,
          duration,
          threshold,
          ...context
        }
      );
    }
  }

  /**
   * Report a network error
   */
  async reportNetworkError(
    url: string,
    method: string,
    status?: number,
    statusText?: string,
    context?: Record<string, any>
  ): Promise<void> {
    await this.reportError(
      `Network error: ${method} ${url} ${status ? `(${status} ${statusText})` : ''}`,
      'error',
      {
        url,
        method,
        status,
        statusText,
        ...context
      }
    );
  }

  /**
   * Add error report to queue
   */
  private addToQueue(report: ClientErrorReport): void {
    this.queue.push(report);

    // Limit queue size
    if (this.queue.length > this.maxQueueSize) {
      this.queue = this.queue.slice(-this.maxQueueSize);
    }
  }

  /**
   * Flush queued error reports to server
   */
  private async flush(): Promise<void> {
    if (this.queue.length === 0 || !this.isOnline) return;

    const reports = [...this.queue];
    this.queue = [];

    try {
      for (const report of reports) {
        await this.sendReport(report);
      }
    } catch (error) {
      // Re-queue failed reports
      this.queue.unshift(...reports);
      console.warn('Failed to send error reports:', error);
    }
  }

  /**
   * Send individual error report to server
   */
  private async sendReport(report: ClientErrorReport): Promise<void> {
    try {
      const response = await fetch('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(report)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      // Store in localStorage as fallback
      this.storeInLocalStorage(report);
      throw error;
    }
  }

  /**
   * Store error report in localStorage as fallback
   */
  private storeInLocalStorage(report: ClientErrorReport): void {
    try {
      const stored = localStorage.getItem('storesync_error_reports');
      const reports = stored ? JSON.parse(stored) : [];
      
      reports.push(report);
      
      // Keep only last 20 reports
      if (reports.length > 20) {
        reports.splice(0, reports.length - 20);
      }
      
      localStorage.setItem('storesync_error_reports', JSON.stringify(reports));
    } catch (error) {
      console.warn('Failed to store error report in localStorage:', error);
    }
  }

  /**
   * Load and send stored error reports
   */
  private async loadStoredReports(): Promise<void> {
    try {
      const stored = localStorage.getItem('storesync_error_reports');
      if (!stored) return;

      const reports = JSON.parse(stored);
      localStorage.removeItem('storesync_error_reports');

      for (const report of reports) {
        this.addToQueue(report);
      }

      await this.flush();
    } catch (error) {
      console.warn('Failed to load stored error reports:', error);
    }
  }

  /**
   * Setup event listeners for network status and page lifecycle
   */
  private setupEventListeners(): void {
    // Network status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.loadStoredReports();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Page lifecycle
    window.addEventListener('beforeunload', () => {
      // Try to flush remaining reports
      if (this.queue.length > 0) {
        navigator.sendBeacon('/api/errors/report', JSON.stringify({
          reports: this.queue
        }));
      }
    });

    // Visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.loadStoredReports();
      }
    });
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Stop flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * Get current user ID (implement based on your auth system)
   */
  private getUserId(): string | undefined {
    // This would integrate with your authentication system
    // For Clerk, you might use: window.Clerk?.user?.id
    return undefined;
  }

  /**
   * Get current organization ID (implement based on your auth system)
   */
  private getOrganizationId(): string | undefined {
    // This would integrate with your authentication system
    // For Clerk, you might use: window.Clerk?.organization?.id
    return undefined;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopFlushTimer();
    this.flush(); // Final flush
  }
}

// Global instance
let globalReporter: ClientErrorReporter | null = null;

/**
 * Get global error reporter instance
 */
export function getErrorReporter(): ClientErrorReporter {
  if (!globalReporter) {
    globalReporter = new ClientErrorReporter();
  }
  return globalReporter;
}

/**
 * Convenience function to report errors
 */
export async function reportError(
  error: Error | AppError | string,
  level: 'error' | 'warning' | 'info' = 'error',
  context?: Record<string, any>
): Promise<void> {
  return getErrorReporter().reportError(error, level, context);
}

/**
 * Convenience function to report performance issues
 */
export async function reportPerformanceIssue(
  operation: string,
  duration: number,
  threshold?: number,
  context?: Record<string, any>
): Promise<void> {
  return getErrorReporter().reportPerformanceIssue(operation, duration, threshold, context);
}

/**
 * Convenience function to report network errors
 */
export async function reportNetworkError(
  url: string,
  method: string,
  status?: number,
  statusText?: string,
  context?: Record<string, any>
): Promise<void> {
  return getErrorReporter().reportNetworkError(url, method, status, statusText, context);
}