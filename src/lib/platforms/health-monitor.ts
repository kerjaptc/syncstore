/**
 * API Health Monitor
 * Monitors platform API health and provides alerting
 */

import { BasePlatformAdapter } from './base-adapter';
import { PlatformError, PlatformErrorType } from './types';

interface HealthMetrics {
  platform: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number; // Percentage
  responseTime: {
    average: number;
    p95: number;
    p99: number;
  };
  errorRate: number; // Percentage
  lastCheck: Date;
  consecutiveFailures: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errors: {
    [key in PlatformErrorType]?: number;
  };
}

interface HealthCheckConfig {
  interval: number; // Check interval in milliseconds
  timeout: number; // Request timeout in milliseconds
  failureThreshold: number; // Number of consecutive failures before marking unhealthy
  degradedThreshold: number; // Error rate threshold for degraded status
  unhealthyThreshold: number; // Error rate threshold for unhealthy status
}

interface AlertConfig {
  enabled: boolean;
  webhookUrl?: string;
  emailRecipients?: string[];
  slackWebhook?: string;
  minAlertInterval: number; // Minimum time between alerts for same issue
}

export class HealthMonitor {
  private static instance: HealthMonitor;
  private adapters: Map<string, BasePlatformAdapter> = new Map();
  private metrics: Map<string, HealthMetrics> = new Map();
  private config: HealthCheckConfig;
  private alertConfig: AlertConfig;
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
  private lastAlerts: Map<string, Date> = new Map();
  private responseTimes: Map<string, number[]> = new Map();

  private constructor(
    config: Partial<HealthCheckConfig> = {},
    alertConfig: Partial<AlertConfig> = {}
  ) {
    this.config = {
      interval: 60000, // 1 minute
      timeout: 10000, // 10 seconds
      failureThreshold: 3,
      degradedThreshold: 5, // 5% error rate
      unhealthyThreshold: 20, // 20% error rate
      ...config,
    };

    this.alertConfig = {
      enabled: false,
      minAlertInterval: 300000, // 5 minutes
      ...alertConfig,
    };
  }

  static getInstance(
    config?: Partial<HealthCheckConfig>,
    alertConfig?: Partial<AlertConfig>
  ): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor(config, alertConfig);
    }
    return HealthMonitor.instance;
  }

  /**
   * Register a platform adapter for monitoring
   */
  registerAdapter(platformName: string, adapter: BasePlatformAdapter): void {
    this.adapters.set(platformName, adapter);
    this.initializeMetrics(platformName);
    this.startHealthChecks(platformName);
  }

  /**
   * Unregister a platform adapter
   */
  unregisterAdapter(platformName: string): void {
    this.stopHealthChecks(platformName);
    this.adapters.delete(platformName);
    this.metrics.delete(platformName);
    this.responseTimes.delete(platformName);
  }

  /**
   * Get health metrics for a platform
   */
  getMetrics(platformName: string): HealthMetrics | null {
    return this.metrics.get(platformName) || null;
  }

  /**
   * Get health metrics for all platforms
   */
  getAllMetrics(): Record<string, HealthMetrics> {
    const allMetrics: Record<string, HealthMetrics> = {};
    
    for (const [platform, metrics] of this.metrics.entries()) {
      allMetrics[platform] = metrics;
    }

    return allMetrics;
  }

  /**
   * Record a request result for metrics
   */
  recordRequest(
    platformName: string,
    success: boolean,
    responseTime: number,
    error?: PlatformError
  ): void {
    const metrics = this.metrics.get(platformName);
    if (!metrics) return;

    // Update request counts
    metrics.totalRequests++;
    if (success) {
      metrics.successfulRequests++;
      metrics.consecutiveFailures = 0;
    } else {
      metrics.failedRequests++;
      metrics.consecutiveFailures++;
      
      // Record error type
      if (error) {
        metrics.errors[error.type] = (metrics.errors[error.type] || 0) + 1;
      }
    }

    // Record response time
    const responseTimes = this.responseTimes.get(platformName) || [];
    responseTimes.push(responseTime);
    
    // Keep only last 100 response times
    if (responseTimes.length > 100) {
      responseTimes.shift();
    }
    
    this.responseTimes.set(platformName, responseTimes);

    // Update calculated metrics
    this.updateCalculatedMetrics(platformName);

    // Check for alerts
    this.checkAlerts(platformName);
  }

  /**
   * Force a health check for a platform
   */
  async checkHealth(platformName: string): Promise<HealthMetrics | null> {
    const adapter = this.adapters.get(platformName);
    if (!adapter) return null;

    const startTime = Date.now();
    
    try {
      const result = await Promise.race([
        adapter.healthCheck(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), this.config.timeout)
        )
      ]);

      const responseTime = Date.now() - startTime;
      const success = result && typeof result === 'object' && 'success' in result ? Boolean(result.success) : false;

      this.recordRequest(platformName, success, responseTime);

      return this.metrics.get(platformName) || null;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const platformError = error instanceof PlatformError 
        ? error 
        : new PlatformError(PlatformErrorType.UNKNOWN, error instanceof Error ? error.message : 'Unknown error');

      this.recordRequest(platformName, false, responseTime, platformError);

      return this.metrics.get(platformName) || null;
    }
  }

  /**
   * Get overall system health
   */
  getSystemHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    platforms: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
    summary: {
      total: number;
      healthy: number;
      degraded: number;
      unhealthy: number;
    };
  } {
    const platforms: Record<string, 'healthy' | 'degraded' | 'unhealthy'> = {};
    const summary = { total: 0, healthy: 0, degraded: 0, unhealthy: 0 };

    for (const [platform, metrics] of this.metrics.entries()) {
      platforms[platform] = metrics.status;
      summary.total++;
      summary[metrics.status]++;
    }

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (summary.unhealthy > 0) {
      overallStatus = 'unhealthy';
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      platforms,
      summary,
    };
  }

  private initializeMetrics(platformName: string): void {
    this.metrics.set(platformName, {
      platform: platformName,
      status: 'healthy',
      uptime: 100,
      responseTime: {
        average: 0,
        p95: 0,
        p99: 0,
      },
      errorRate: 0,
      lastCheck: new Date(),
      consecutiveFailures: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      errors: {},
    });

    this.responseTimes.set(platformName, []);
  }

  private startHealthChecks(platformName: string): void {
    const interval = setInterval(async () => {
      await this.checkHealth(platformName);
    }, this.config.interval);

    this.checkIntervals.set(platformName, interval);

    // Perform initial health check
    this.checkHealth(platformName);
  }

  private stopHealthChecks(platformName: string): void {
    const interval = this.checkIntervals.get(platformName);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(platformName);
    }
  }

  private updateCalculatedMetrics(platformName: string): void {
    const metrics = this.metrics.get(platformName);
    const responseTimes = this.responseTimes.get(platformName);
    
    if (!metrics || !responseTimes) return;

    // Calculate error rate
    metrics.errorRate = metrics.totalRequests > 0 
      ? (metrics.failedRequests / metrics.totalRequests) * 100 
      : 0;

    // Calculate uptime
    metrics.uptime = metrics.totalRequests > 0 
      ? (metrics.successfulRequests / metrics.totalRequests) * 100 
      : 100;

    // Calculate response times
    if (responseTimes.length > 0) {
      const sorted = [...responseTimes].sort((a, b) => a - b);
      
      metrics.responseTime.average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      metrics.responseTime.p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
      metrics.responseTime.p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
    }

    // Determine status
    if (metrics.consecutiveFailures >= this.config.failureThreshold || 
        metrics.errorRate >= this.config.unhealthyThreshold) {
      metrics.status = 'unhealthy';
    } else if (metrics.errorRate >= this.config.degradedThreshold) {
      metrics.status = 'degraded';
    } else {
      metrics.status = 'healthy';
    }

    metrics.lastCheck = new Date();
  }

  private async checkAlerts(platformName: string): Promise<void> {
    if (!this.alertConfig.enabled) return;

    const metrics = this.metrics.get(platformName);
    if (!metrics) return;

    const now = new Date();
    const lastAlert = this.lastAlerts.get(platformName);

    // Check if enough time has passed since last alert
    if (lastAlert && (now.getTime() - lastAlert.getTime()) < this.alertConfig.minAlertInterval) {
      return;
    }

    // Check for alert conditions
    let shouldAlert = false;
    let alertMessage = '';

    if (metrics.status === 'unhealthy') {
      shouldAlert = true;
      alertMessage = `Platform ${platformName} is unhealthy. Error rate: ${metrics.errorRate.toFixed(2)}%, Consecutive failures: ${metrics.consecutiveFailures}`;
    } else if (metrics.status === 'degraded') {
      shouldAlert = true;
      alertMessage = `Platform ${platformName} is degraded. Error rate: ${metrics.errorRate.toFixed(2)}%`;
    }

    if (shouldAlert) {
      await this.sendAlert(platformName, alertMessage, metrics);
      this.lastAlerts.set(platformName, now);
    }
  }

  private async sendAlert(
    platformName: string,
    message: string,
    metrics: HealthMetrics
  ): Promise<void> {
    console.warn(`ALERT: ${message}`);

    // TODO: Implement actual alerting mechanisms
    // - Webhook notifications
    // - Email notifications
    // - Slack notifications
    // - SMS notifications

    if (this.alertConfig.webhookUrl) {
      try {
        await fetch(this.alertConfig.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: platformName,
            message,
            metrics,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (error) {
        console.error('Failed to send webhook alert:', error);
      }
    }
  }

  /**
   * Configure alerting
   */
  configureAlerts(config: Partial<AlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...config };
  }

  /**
   * Get alert configuration
   */
  getAlertConfig(): AlertConfig {
    return { ...this.alertConfig };
  }

  /**
   * Destroy the monitor instance
   */
  destroy(): void {
    // Stop all health checks
    for (const platformName of this.adapters.keys()) {
      this.stopHealthChecks(platformName);
    }

    // Clear all data
    this.adapters.clear();
    this.metrics.clear();
    this.responseTimes.clear();
    this.lastAlerts.clear();
  }
}

// Singleton instance
export const healthMonitor = HealthMonitor.getInstance();