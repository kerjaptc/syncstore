/**
 * Application Performance Monitor
 * Tracks application performance metrics, response times, and resource usage
 */

import { getLogger } from '@/lib/error-handling';

const logger = getLogger('performance-monitor');

export interface PerformanceMetric {
  id: string;
  name: string;
  type: 'request' | 'database' | 'cache' | 'sync' | 'custom';
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
  };
  database: {
    activeConnections: number;
    slowQueries: number;
    averageQueryTime: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'high_response_time' | 'high_memory_usage' | 'high_cpu_usage' | 'slow_query' | 'high_error_rate';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: number;
  actualValue: number;
  timestamp: Date;
  resolved: boolean;
}

class ApplicationPerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private alerts: Map<string, PerformanceAlert> = new Map();
  private systemMetrics: SystemMetrics | null = null;
  private alertCallbacks: Array<(alert: PerformanceAlert) => void> = [];
  
  // Performance thresholds
  private thresholds = {
    maxResponseTime: 5000, // 5 seconds
    maxMemoryUsage: 80, // 80%
    maxCpuUsage: 80, // 80%
    maxQueryTime: 1000, // 1 second
    maxErrorRate: 5, // 5%
  };

  /**
   * Start tracking a performance metric
   */
  startMetric(name: string, type: PerformanceMetric['type'], metadata: Record<string, any> = {}): string {
    const id = this.generateMetricId();
    const metric: PerformanceMetric = {
      id,
      name,
      type,
      startTime: performance.now(),
      success: true,
      metadata,
      timestamp: new Date(),
    };

    this.metrics.set(id, metric);
    return id;
  }

  /**
   * End tracking a performance metric
   */
  endMetric(id: string, success: boolean = true, error?: string, additionalMetadata: Record<string, any> = {}): void {
    const metric = this.metrics.get(id);
    if (!metric) return;

    const endTime = performance.now();
    metric.endTime = endTime;
    metric.duration = endTime - metric.startTime;
    metric.success = success;
    metric.error = error;
    metric.metadata = { ...metric.metadata, ...additionalMetadata };

    // Check for performance issues
    this.checkPerformanceThresholds(metric);

    logger.info('Performance metric recorded', {
      name: metric.name,
      type: metric.type,
      duration: metric.duration,
      success: metric.success,
    });
  }

  /**
   * Track a function execution
   */
  async trackFunction<T>(
    name: string,
    type: PerformanceMetric['type'],
    fn: () => Promise<T>,
    metadata: Record<string, any> = {}
  ): Promise<T> {
    const metricId = this.startMetric(name, type, metadata);
    
    try {
      const result = await fn();
      this.endMetric(metricId, true);
      return result;
    } catch (error) {
      this.endMetric(metricId, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Calculate memory percentage
    const totalMemory = memUsage.rss + memUsage.heapTotal + memUsage.external;
    const memoryPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    // Get recent metrics only (last 5 minutes) to reduce memory usage
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const recentMetrics = Array.from(this.metrics.values())
      .filter(m => m.timestamp.getTime() > fiveMinutesAgo);
    
    const requestMetrics = recentMetrics
      .filter(m => m.type === 'request' && m.duration !== undefined);
    
    const totalRequests = requestMetrics.length;
    const successfulRequests = requestMetrics.filter(m => m.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const averageResponseTime = totalRequests > 0 
      ? requestMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / totalRequests
      : 0;

    // Get database metrics from recent data only
    const dbMetrics = recentMetrics
      .filter(m => m.type === 'database' && m.duration !== undefined);
    
    const slowQueries = dbMetrics.filter(m => (m.duration || 0) > this.thresholds.maxQueryTime).length;
    const averageQueryTime = dbMetrics.length > 0
      ? dbMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / dbMetrics.length
      : 0;

    this.systemMetrics = {
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        percentage: Math.round(memoryPercentage),
      },
      cpu: {
        usage: Math.round((cpuUsage.user + cpuUsage.system) / 1000000), // Convert to percentage
      },
      requests: {
        total: totalRequests,
        successful: successfulRequests,
        failed: failedRequests,
        averageResponseTime: Math.round(averageResponseTime),
      },
      database: {
        activeConnections: 0, // This would need to be tracked separately
        slowQueries,
        averageQueryTime: Math.round(averageQueryTime),
      },
    };

    // Check system-level thresholds
    this.checkSystemThresholds(this.systemMetrics);

    return this.systemMetrics;
  }

  /**
   * Get performance metrics
   */
  getMetrics(type?: PerformanceMetric['type'], limit: number = 100): PerformanceMetric[] {
    let metrics = Array.from(this.metrics.values());
    
    if (type) {
      metrics = metrics.filter(m => m.type === type);
    }

    return metrics
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get active alerts
   */
  getAlerts(resolved: boolean = false): PerformanceAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => alert.resolved === resolved)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      logger.info('Performance alert resolved', { alertId, type: alert.type });
    }
  }

  /**
   * Subscribe to performance alerts
   */
  onAlert(callback: (alert: PerformanceAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Clear old metrics to prevent memory leaks
   */
  clearOldMetrics(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;
    
    for (const [id, metric] of this.metrics.entries()) {
      if (metric.timestamp.getTime() < cutoff) {
        this.metrics.delete(id);
      }
    }

    // Clear resolved alerts older than 7 days
    const alertCutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.resolved && alert.timestamp.getTime() < alertCutoff) {
        this.alerts.delete(id);
      }
    }
  }

  /**
   * Check performance thresholds for a metric
   */
  private checkPerformanceThresholds(metric: PerformanceMetric): void {
    if (!metric.duration) return;

    // Check response time threshold
    if (metric.type === 'request' && metric.duration > this.thresholds.maxResponseTime) {
      this.createAlert(
        'high_response_time',
        'high',
        `High response time detected: ${Math.round(metric.duration)}ms`,
        this.thresholds.maxResponseTime,
        metric.duration
      );
    }

    // Check database query time
    if (metric.type === 'database' && metric.duration > this.thresholds.maxQueryTime) {
      this.createAlert(
        'slow_query',
        'medium',
        `Slow database query detected: ${Math.round(metric.duration)}ms`,
        this.thresholds.maxQueryTime,
        metric.duration
      );
    }
  }

  /**
   * Check system-level thresholds
   */
  private checkSystemThresholds(metrics: SystemMetrics): void {
    // Check memory usage
    if (metrics.memory.percentage > this.thresholds.maxMemoryUsage) {
      this.createAlert(
        'high_memory_usage',
        'high',
        `High memory usage: ${metrics.memory.percentage}%`,
        this.thresholds.maxMemoryUsage,
        metrics.memory.percentage
      );
    }

    // Check CPU usage
    if (metrics.cpu.usage > this.thresholds.maxCpuUsage) {
      this.createAlert(
        'high_cpu_usage',
        'high',
        `High CPU usage: ${metrics.cpu.usage}%`,
        this.thresholds.maxCpuUsage,
        metrics.cpu.usage
      );
    }

    // Check error rate
    const errorRate = metrics.requests.total > 0 
      ? (metrics.requests.failed / metrics.requests.total) * 100 
      : 0;
    
    if (errorRate > this.thresholds.maxErrorRate) {
      this.createAlert(
        'high_error_rate',
        'critical',
        `High error rate: ${Math.round(errorRate)}%`,
        this.thresholds.maxErrorRate,
        errorRate
      );
    }
  }

  /**
   * Create a performance alert
   */
  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    threshold: number,
    actualValue: number
  ): void {
    const alert: PerformanceAlert = {
      id: this.generateAlertId(),
      type,
      severity,
      message,
      threshold,
      actualValue,
      timestamp: new Date(),
      resolved: false,
    };

    this.alerts.set(alert.id, alert);

    // Notify subscribers
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        logger.error('Error in alert callback', error instanceof Error ? error : undefined);
      }
    });

    logger.warn('Performance alert created', {
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      threshold,
      actualValue,
    });
  }

  /**
   * Generate unique metric ID
   */
  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const performanceMonitor = new ApplicationPerformanceMonitor();

// Initialize monitoring based on environment
if (typeof window === 'undefined') {
  const { shouldEnableMonitoring, monitoringConfig } = require('./config');
  
  if (shouldEnableMonitoring()) {
    // Clean up old metrics
    setInterval(() => {
      performanceMonitor.clearOldMetrics(monitoringConfig.metricsMaxAge);
    }, monitoringConfig.cleanupInterval);

    // Collect system metrics
    setInterval(() => {
      performanceMonitor.collectSystemMetrics();
    }, monitoringConfig.systemMetricsInterval);
  } else {
    console.log('🔧 Performance monitoring disabled in development mode');
    console.log('   Set ENABLE_DEV_MONITORING=true to enable');
  }
}