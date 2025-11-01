/**
 * Sync Performance Monitor
 * Tracks sync performance metrics, alerts, and optimization recommendations
 */

export interface PerformanceMetric {
  id: string;
  jobId: string;
  jobType: string;
  organizationId: string;
  storeId?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  itemsProcessed: number;
  itemsFailed: number;
  throughput: number; // items per second
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  cpuUsage?: number;
  errorRate: number;
  retryCount: number;
  metadata?: Record<string, any>;
}

export interface PerformanceAlert {
  id: string;
  type: 'slow_job' | 'high_error_rate' | 'memory_leak' | 'cpu_spike' | 'throughput_drop';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  jobId?: string;
  organizationId: string;
  storeId?: string;
  threshold: number;
  actualValue: number;
  createdAt: Date;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

export interface PerformanceThresholds {
  maxJobDuration: number; // milliseconds
  maxErrorRate: number; // percentage
  maxMemoryUsage: number; // bytes
  maxCpuUsage: number; // percentage
  minThroughput: number; // items per second
}

export interface OptimizationRecommendation {
  id: string;
  type: 'batch_size' | 'concurrency' | 'retry_strategy' | 'scheduling' | 'resource_allocation';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  expectedImprovement: string;
  implementation: string;
  organizationId: string;
  storeId?: string;
  createdAt: Date;
  appliedAt?: Date;
  metadata?: Record<string, any>;
}

export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private alerts: Map<string, PerformanceAlert> = new Map();
  private recommendations: Map<string, OptimizationRecommendation> = new Map();
  private thresholds: PerformanceThresholds;
  private alertCallbacks: Array<(alert: PerformanceAlert) => void> = [];

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    this.thresholds = {
      maxJobDuration: 30 * 60 * 1000, // 30 minutes
      maxErrorRate: 10, // 10%
      maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
      maxCpuUsage: 80, // 80%
      minThroughput: 1, // 1 item per second
      ...thresholds,
    };
  }

  /**
   * Start monitoring a sync job
   */
  startJobMonitoring(
    jobId: string,
    jobType: string,
    organizationId: string,
    storeId?: string
  ): PerformanceMetric {
    const metric: PerformanceMetric = {
      id: this.generateMetricId(),
      jobId,
      jobType,
      organizationId,
      storeId,
      startTime: new Date(),
      itemsProcessed: 0,
      itemsFailed: 0,
      throughput: 0,
      errorRate: 0,
      retryCount: 0,
    };

    this.metrics.set(metric.id, metric);
    return metric;
  }

  /**
   * Update job progress
   */
  updateJobProgress(
    metricId: string,
    itemsProcessed: number,
    itemsFailed: number,
    retryCount?: number
  ): void {
    const metric = this.metrics.get(metricId);
    if (!metric) return;

    metric.itemsProcessed = itemsProcessed;
    metric.itemsFailed = itemsFailed;
    if (retryCount !== undefined) {
      metric.retryCount = retryCount;
    }

    // Calculate current throughput and error rate
    const duration = Date.now() - metric.startTime.getTime();
    metric.throughput = duration > 0 ? (itemsProcessed / (duration / 1000)) : 0;
    metric.errorRate = itemsProcessed > 0 ? (itemsFailed / itemsProcessed) * 100 : 0;

    // Check for performance issues
    this.checkPerformanceThresholds(metric);
  }

  /**
   * Complete job monitoring
   */
  completeJobMonitoring(metricId: string): PerformanceMetric | null {
    const metric = this.metrics.get(metricId);
    if (!metric) return null;

    metric.endTime = new Date();
    metric.duration = metric.endTime.getTime() - metric.startTime.getTime();

    // Final calculations
    if (metric.duration > 0) {
      metric.throughput = metric.itemsProcessed / (metric.duration / 1000);
    }

    // Capture system metrics
    this.captureSystemMetrics(metric);

    // Final performance check
    this.checkPerformanceThresholds(metric);

    // Generate optimization recommendations
    this.generateRecommendations(metric);

    return metric;
  }

  /**
   * Capture system resource metrics
   */
  private captureSystemMetrics(metric: PerformanceMetric): void {
    try {
      // Memory usage
      const memUsage = process.memoryUsage();
      metric.memoryUsage = {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
      };

      // CPU usage (simplified - in production use proper CPU monitoring)
      metric.cpuUsage = this.getCurrentCpuUsage();
    } catch (error) {
      console.warn('Failed to capture system metrics:', error);
    }
  }

  /**
   * Get current CPU usage (simplified implementation)
   */
  private getCurrentCpuUsage(): number {
    // This is a simplified implementation
    // In production, use proper CPU monitoring libraries
    const usage = process.cpuUsage();
    return (usage.user + usage.system) / 1000000; // Convert to percentage
  }

  /**
   * Check performance thresholds and create alerts
   */
  private checkPerformanceThresholds(metric: PerformanceMetric): void {
    const alerts: PerformanceAlert[] = [];

    // Check job duration
    if (metric.duration && metric.duration > this.thresholds.maxJobDuration) {
      alerts.push(this.createAlert(
        'slow_job',
        'high',
        `Job ${metric.jobId} is taking longer than expected`,
        metric,
        this.thresholds.maxJobDuration,
        metric.duration
      ));
    }

    // Check error rate
    if (metric.errorRate > this.thresholds.maxErrorRate) {
      alerts.push(this.createAlert(
        'high_error_rate',
        'medium',
        `Job ${metric.jobId} has high error rate`,
        metric,
        this.thresholds.maxErrorRate,
        metric.errorRate
      ));
    }

    // Check memory usage
    if (metric.memoryUsage && metric.memoryUsage.heapUsed > this.thresholds.maxMemoryUsage) {
      alerts.push(this.createAlert(
        'memory_leak',
        'high',
        `Job ${metric.jobId} is using excessive memory`,
        metric,
        this.thresholds.maxMemoryUsage,
        metric.memoryUsage.heapUsed
      ));
    }

    // Check CPU usage
    if (metric.cpuUsage && metric.cpuUsage > this.thresholds.maxCpuUsage) {
      alerts.push(this.createAlert(
        'cpu_spike',
        'medium',
        `Job ${metric.jobId} is using high CPU`,
        metric,
        this.thresholds.maxCpuUsage,
        metric.cpuUsage
      ));
    }

    // Check throughput
    if (metric.throughput < this.thresholds.minThroughput && metric.itemsProcessed > 10) {
      alerts.push(this.createAlert(
        'throughput_drop',
        'medium',
        `Job ${metric.jobId} has low throughput`,
        metric,
        this.thresholds.minThroughput,
        metric.throughput
      ));
    }

    // Store and notify about alerts
    for (const alert of alerts) {
      this.alerts.set(alert.id, alert);
      this.notifyAlert(alert);
    }
  }

  /**
   * Create a performance alert
   */
  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    metric: PerformanceMetric,
    threshold: number,
    actualValue: number
  ): PerformanceAlert {
    return {
      id: this.generateAlertId(),
      type,
      severity,
      message,
      jobId: metric.jobId,
      organizationId: metric.organizationId,
      storeId: metric.storeId,
      threshold,
      actualValue,
      createdAt: new Date(),
      metadata: {
        metricId: metric.id,
        jobType: metric.jobType,
      },
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(metric: PerformanceMetric): void {
    const recommendations: OptimizationRecommendation[] = [];

    // Low throughput recommendations
    if (metric.throughput < this.thresholds.minThroughput) {
      recommendations.push({
        id: this.generateRecommendationId(),
        type: 'batch_size',
        priority: 'medium',
        title: 'Increase Batch Size',
        description: 'Current throughput is low. Consider increasing batch size to process more items per request.',
        expectedImprovement: 'Could improve throughput by 20-50%',
        implementation: 'Increase batchSize option from current value to 100-200 items',
        organizationId: metric.organizationId,
        storeId: metric.storeId,
        createdAt: new Date(),
        metadata: {
          currentThroughput: metric.throughput,
          suggestedBatchSize: Math.min(200, Math.max(100, metric.itemsProcessed / 10)),
        },
      });
    }

    // High error rate recommendations
    if (metric.errorRate > this.thresholds.maxErrorRate) {
      recommendations.push({
        id: this.generateRecommendationId(),
        type: 'retry_strategy',
        priority: 'high',
        title: 'Optimize Retry Strategy',
        description: 'High error rate detected. Consider implementing exponential backoff and better error handling.',
        expectedImprovement: 'Could reduce error rate by 30-60%',
        implementation: 'Implement exponential backoff with jitter and categorize errors for selective retry',
        organizationId: metric.organizationId,
        storeId: metric.storeId,
        createdAt: new Date(),
        metadata: {
          currentErrorRate: metric.errorRate,
          retryCount: metric.retryCount,
        },
      });
    }

    // Long duration recommendations
    if (metric.duration && metric.duration > this.thresholds.maxJobDuration / 2) {
      recommendations.push({
        id: this.generateRecommendationId(),
        type: 'concurrency',
        priority: 'medium',
        title: 'Increase Concurrency',
        description: 'Job is taking longer than optimal. Consider increasing concurrent processing.',
        expectedImprovement: 'Could reduce job duration by 25-40%',
        implementation: 'Increase maxConcurrentJobs setting and implement parallel processing',
        organizationId: metric.organizationId,
        storeId: metric.storeId,
        createdAt: new Date(),
        metadata: {
          currentDuration: metric.duration,
          suggestedConcurrency: Math.min(5, Math.max(2, Math.ceil(metric.itemsProcessed / 50))),
        },
      });
    }

    // Store recommendations
    for (const recommendation of recommendations) {
      this.recommendations.set(recommendation.id, recommendation);
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(filters?: {
    organizationId?: string;
    storeId?: string;
    jobType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): PerformanceMetric[] {
    let metrics = Array.from(this.metrics.values());

    if (filters) {
      if (filters.organizationId) {
        metrics = metrics.filter(m => m.organizationId === filters.organizationId);
      }
      if (filters.storeId) {
        metrics = metrics.filter(m => m.storeId === filters.storeId);
      }
      if (filters.jobType) {
        metrics = metrics.filter(m => m.jobType === filters.jobType);
      }
      if (filters.startDate) {
        metrics = metrics.filter(m => m.startTime >= filters.startDate!);
      }
      if (filters.endDate) {
        metrics = metrics.filter(m => m.startTime <= filters.endDate!);
      }
    }

    // Sort by start time (newest first)
    metrics.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    if (filters?.limit) {
      metrics = metrics.slice(0, filters.limit);
    }

    return metrics;
  }

  /**
   * Get performance alerts
   */
  getAlerts(filters?: {
    organizationId?: string;
    storeId?: string;
    severity?: PerformanceAlert['severity'];
    resolved?: boolean;
    limit?: number;
  }): PerformanceAlert[] {
    let alerts = Array.from(this.alerts.values());

    if (filters) {
      if (filters.organizationId) {
        alerts = alerts.filter(a => a.organizationId === filters.organizationId);
      }
      if (filters.storeId) {
        alerts = alerts.filter(a => a.storeId === filters.storeId);
      }
      if (filters.severity) {
        alerts = alerts.filter(a => a.severity === filters.severity);
      }
      if (filters.resolved !== undefined) {
        alerts = alerts.filter(a => !!a.resolvedAt === filters.resolved);
      }
    }

    // Sort by creation time (newest first)
    alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (filters?.limit) {
      alerts = alerts.slice(0, filters.limit);
    }

    return alerts;
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(filters?: {
    organizationId?: string;
    storeId?: string;
    type?: OptimizationRecommendation['type'];
    priority?: OptimizationRecommendation['priority'];
    applied?: boolean;
    limit?: number;
  }): OptimizationRecommendation[] {
    let recommendations = Array.from(this.recommendations.values());

    if (filters) {
      if (filters.organizationId) {
        recommendations = recommendations.filter(r => r.organizationId === filters.organizationId);
      }
      if (filters.storeId) {
        recommendations = recommendations.filter(r => r.storeId === filters.storeId);
      }
      if (filters.type) {
        recommendations = recommendations.filter(r => r.type === filters.type);
      }
      if (filters.priority) {
        recommendations = recommendations.filter(r => r.priority === filters.priority);
      }
      if (filters.applied !== undefined) {
        recommendations = recommendations.filter(r => !!r.appliedAt === filters.applied);
      }
    }

    // Sort by priority and creation time
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    recommendations.sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    if (filters?.limit) {
      recommendations = recommendations.slice(0, filters.limit);
    }

    return recommendations;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolvedAt) return false;

    alert.resolvedAt = new Date();
    return true;
  }

  /**
   * Mark recommendation as applied
   */
  applyRecommendation(recommendationId: string): boolean {
    const recommendation = this.recommendations.get(recommendationId);
    if (!recommendation || recommendation.appliedAt) return false;

    recommendation.appliedAt = new Date();
    return true;
  }

  /**
   * Register alert callback
   */
  onAlert(callback: (alert: PerformanceAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Notify alert callbacks
   */
  private notifyAlert(alert: PerformanceAlert): void {
    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error in alert callback:', error);
      }
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(organizationId: string, storeId?: string): {
    totalJobs: number;
    averageDuration: number;
    averageThroughput: number;
    averageErrorRate: number;
    activeAlerts: number;
    pendingRecommendations: number;
    topIssues: Array<{ type: string; count: number }>;
  } {
    const metrics = this.getMetrics({ organizationId, storeId });
    const alerts = this.getAlerts({ organizationId, storeId, resolved: false });
    const recommendations = this.getRecommendations({ organizationId, storeId, applied: false });

    const completedMetrics = metrics.filter(m => m.duration);
    
    const averageDuration = completedMetrics.length > 0 
      ? completedMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / completedMetrics.length
      : 0;

    const averageThroughput = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.throughput, 0) / metrics.length
      : 0;

    const averageErrorRate = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length
      : 0;

    // Count top issues
    const issueCount = new Map<string, number>();
    for (const alert of alerts) {
      issueCount.set(alert.type, (issueCount.get(alert.type) || 0) + 1);
    }

    const topIssues = Array.from(issueCount.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalJobs: metrics.length,
      averageDuration,
      averageThroughput,
      averageErrorRate,
      activeAlerts: alerts.length,
      pendingRecommendations: recommendations.length,
      topIssues,
    };
  }

  /**
   * Clean old metrics and alerts
   */
  cleanup(olderThanDays: number = 30): {
    deletedMetrics: number;
    deletedAlerts: number;
    deletedRecommendations: number;
  } {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    let deletedMetrics = 0;
    let deletedAlerts = 0;
    let deletedRecommendations = 0;

    // Clean metrics
    for (const [id, metric] of this.metrics) {
      if (metric.startTime < cutoff) {
        this.metrics.delete(id);
        deletedMetrics++;
      }
    }

    // Clean resolved alerts
    for (const [id, alert] of this.alerts) {
      if (alert.resolvedAt && alert.resolvedAt < cutoff) {
        this.alerts.delete(id);
        deletedAlerts++;
      }
    }

    // Clean applied recommendations
    for (const [id, recommendation] of this.recommendations) {
      if (recommendation.appliedAt && recommendation.appliedAt < cutoff) {
        this.recommendations.delete(id);
        deletedRecommendations++;
      }
    }

    return { deletedMetrics, deletedAlerts, deletedRecommendations };
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

  /**
   * Generate unique recommendation ID
   */
  private generateRecommendationId(): string {
    return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();