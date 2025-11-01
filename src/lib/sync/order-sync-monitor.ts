/**
 * Order Sync Monitor
 * Provides monitoring, alerting, and error notification for order synchronization
 */

import { db } from '@/lib/db';
import { 
  syncJobs, 
  syncLogs, 
  orders,
  stores,
  platforms,
  organizations
} from '@/lib/db/schema';
import { eq, and, desc, count, gte, lte, sql } from 'drizzle-orm';
import { SyncJobType, JobStatus } from '@/types';
import type { OrderSyncResult } from './order-sync';

export interface OrderSyncAlert {
  id: string;
  type: 'sync_failure' | 'high_error_rate' | 'sync_delay' | 'missing_orders' | 'status_sync_failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  organizationId: string;
  storeId?: string;
  message: string;
  details: {
    errorCount?: number;
    lastSyncAt?: Date;
    expectedOrders?: number;
    actualOrders?: number;
    failedOrderIds?: string[];
    threshold?: number;
    actualValue?: number;
  };
  createdAt: Date;
  resolvedAt?: Date;
  notificationsSent: string[];
}

export interface OrderSyncMetrics {
  organizationId: string;
  storeId?: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalSyncJobs: number;
  successfulSyncJobs: number;
  failedSyncJobs: number;
  successRate: number;
  averageSyncDuration: number;
  totalOrdersProcessed: number;
  ordersImported: number;
  ordersUpdated: number;
  ordersFailed: number;
  statusUpdatesSuccessful: number;
  statusUpdatesFailed: number;
  lastSyncAt?: Date;
  nextScheduledSync?: Date;
  errorsByType: Record<string, number>;
  performanceTrends: {
    syncDuration: Array<{ date: Date; duration: number }>;
    errorRate: Array<{ date: Date; rate: number }>;
    throughput: Array<{ date: Date; ordersPerHour: number }>;
  };
}

export interface NotificationChannel {
  type: 'email' | 'webhook' | 'slack' | 'teams';
  config: {
    recipients?: string[];
    webhookUrl?: string;
    slackChannel?: string;
    teamsWebhook?: string;
  };
  enabled: boolean;
  alertTypes: OrderSyncAlert['type'][];
  severityThreshold: OrderSyncAlert['severity'];
}

export interface OrderSyncThresholds {
  maxErrorRate: number; // Percentage (0-100)
  maxSyncDelay: number; // Minutes
  minOrdersExpected: number; // Minimum orders expected per sync
  maxConsecutiveFailures: number;
  syncTimeoutMinutes: number;
}

export class OrderSyncMonitor {
  private alerts: Map<string, OrderSyncAlert> = new Map();
  private notificationChannels: Map<string, NotificationChannel[]> = new Map();
  private thresholds: OrderSyncThresholds;

  constructor(thresholds?: Partial<OrderSyncThresholds>) {
    this.thresholds = {
      maxErrorRate: 10, // 10%
      maxSyncDelay: 60, // 1 hour
      minOrdersExpected: 1,
      maxConsecutiveFailures: 3,
      syncTimeoutMinutes: 30,
      ...thresholds,
    };
  }

  /**
   * Monitor order sync job completion
   */
  async monitorSyncJobCompletion(
    jobId: string,
    result: OrderSyncResult,
    organizationId: string,
    storeId?: string
  ): Promise<void> {
    try {
      // Check for sync failures
      if (result.failed > 0) {
        await this.checkHighErrorRate(organizationId, storeId, result);
      }

      // Check for sync delays
      await this.checkSyncDelays(organizationId, storeId);

      // Check for missing orders
      await this.checkMissingOrders(organizationId, storeId, result);

      // Update metrics
      await this.updateSyncMetrics(organizationId, storeId, result);

      // Check thresholds and create alerts
      await this.evaluateThresholds(organizationId, storeId);

    } catch (error) {
      console.error('Error monitoring sync job completion:', error);
    }
  }

  /**
   * Check for high error rates
   */
  private async checkHighErrorRate(
    organizationId: string,
    storeId: string | undefined,
    result: OrderSyncResult
  ): Promise<void> {
    const errorRate = result.totalProcessed > 0 ? 
      (result.failed / result.totalProcessed) * 100 : 0;

    if (errorRate > this.thresholds.maxErrorRate) {
      const alert: OrderSyncAlert = {
        id: this.generateAlertId(),
        type: 'high_error_rate',
        severity: errorRate > 50 ? 'critical' : errorRate > 25 ? 'high' : 'medium',
        organizationId,
        storeId,
        message: `High error rate detected in order synchronization: ${errorRate.toFixed(1)}%`,
        details: {
          errorCount: result.failed,
          threshold: this.thresholds.maxErrorRate,
          actualValue: errorRate,
        },
        createdAt: new Date(),
        notificationsSent: [],
      };

      await this.createAlert(alert);
    }
  }

  /**
   * Check for sync delays
   */
  private async checkSyncDelays(
    organizationId: string,
    storeId?: string
  ): Promise<void> {
    const conditions = [
      eq(syncJobs.organizationId, organizationId),
      eq(syncJobs.jobType, 'ORDER_FETCH'.toLowerCase() as SyncJobType),
    ];

    if (storeId) {
      conditions.push(eq(syncJobs.storeId, storeId));
    }

    // Get last successful sync
    const [lastSync] = await db
      .select({ completedAt: syncJobs.completedAt })
      .from(syncJobs)
      .where(and(
        ...conditions,
        eq(syncJobs.status, 'COMPLETED'.toLowerCase() as JobStatus)
      ))
      .orderBy(desc(syncJobs.completedAt))
      .limit(1);

    if (lastSync?.completedAt) {
      const minutesSinceLastSync = 
        (Date.now() - lastSync.completedAt.getTime()) / (1000 * 60);

      if (minutesSinceLastSync > this.thresholds.maxSyncDelay) {
        const alert: OrderSyncAlert = {
          id: this.generateAlertId(),
          type: 'sync_delay',
          severity: minutesSinceLastSync > this.thresholds.maxSyncDelay * 2 ? 'high' : 'medium',
          organizationId,
          storeId,
          message: `Order synchronization delayed: ${Math.round(minutesSinceLastSync)} minutes since last sync`,
          details: {
            lastSyncAt: lastSync.completedAt,
            threshold: this.thresholds.maxSyncDelay,
            actualValue: minutesSinceLastSync,
          },
          createdAt: new Date(),
          notificationsSent: [],
        };

        await this.createAlert(alert);
      }
    }
  }

  /**
   * Check for missing orders
   */
  private async checkMissingOrders(
    organizationId: string,
    storeId: string | undefined,
    result: OrderSyncResult
  ): Promise<void> {
    // This is a simplified check - in production, you might compare with expected order counts
    // from platform APIs or historical patterns
    if (result.imported + result.updated < this.thresholds.minOrdersExpected) {
      const alert: OrderSyncAlert = {
        id: this.generateAlertId(),
        type: 'missing_orders',
        severity: 'medium',
        organizationId,
        storeId,
        message: `Fewer orders than expected in synchronization`,
        details: {
          expectedOrders: this.thresholds.minOrdersExpected,
          actualOrders: result.imported + result.updated,
        },
        createdAt: new Date(),
        notificationsSent: [],
      };

      await this.createAlert(alert);
    }
  }

  /**
   * Update sync metrics
   */
  private async updateSyncMetrics(
    organizationId: string,
    storeId: string | undefined,
    result: OrderSyncResult
  ): Promise<void> {
    // Store metrics in database or cache for dashboard display
    // This is a placeholder - implement based on your metrics storage strategy
    console.log('Updating sync metrics:', {
      organizationId,
      storeId,
      result,
      timestamp: new Date(),
    });
  }

  /**
   * Evaluate thresholds and create alerts
   */
  private async evaluateThresholds(
    organizationId: string,
    storeId?: string
  ): Promise<void> {
    // Check consecutive failures
    await this.checkConsecutiveFailures(organizationId, storeId);
    
    // Check sync timeouts
    await this.checkSyncTimeouts(organizationId, storeId);
  }

  /**
   * Check for consecutive sync failures
   */
  private async checkConsecutiveFailures(
    organizationId: string,
    storeId?: string
  ): Promise<void> {
    const conditions = [
      eq(syncJobs.organizationId, organizationId),
      eq(syncJobs.jobType, 'ORDER_FETCH'.toLowerCase() as SyncJobType),
    ];

    if (storeId) {
      conditions.push(eq(syncJobs.storeId, storeId));
    }

    // Get recent sync jobs
    const recentJobs = await db
      .select({ status: syncJobs.status })
      .from(syncJobs)
      .where(and(...conditions))
      .orderBy(desc(syncJobs.createdAt))
      .limit(this.thresholds.maxConsecutiveFailures + 1);

    // Count consecutive failures from the most recent
    let consecutiveFailures = 0;
    for (const job of recentJobs) {
      if (job.status === 'FAILED'.toLowerCase() as JobStatus) {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    if (consecutiveFailures >= this.thresholds.maxConsecutiveFailures) {
      const alert: OrderSyncAlert = {
        id: this.generateAlertId(),
        type: 'sync_failure',
        severity: 'critical',
        organizationId,
        storeId,
        message: `${consecutiveFailures} consecutive order sync failures detected`,
        details: {
          errorCount: consecutiveFailures,
          threshold: this.thresholds.maxConsecutiveFailures,
          actualValue: consecutiveFailures,
        },
        createdAt: new Date(),
        notificationsSent: [],
      };

      await this.createAlert(alert);
    }
  }

  /**
   * Check for sync timeouts
   */
  private async checkSyncTimeouts(
    organizationId: string,
    storeId?: string
  ): Promise<void> {
    const timeoutThreshold = new Date(
      Date.now() - this.thresholds.syncTimeoutMinutes * 60 * 1000
    );

    const conditions = [
      eq(syncJobs.organizationId, organizationId),
      eq(syncJobs.jobType, 'ORDER_FETCH'.toLowerCase() as SyncJobType),
      eq(syncJobs.status, 'RUNNING'.toLowerCase() as JobStatus),
      lte(syncJobs.startedAt, timeoutThreshold),
    ];

    if (storeId) {
      conditions.push(eq(syncJobs.storeId, storeId));
    }

    const timedOutJobs = await db
      .select({ id: syncJobs.id, startedAt: syncJobs.startedAt })
      .from(syncJobs)
      .where(and(...conditions));

    for (const job of timedOutJobs) {
      const alert: OrderSyncAlert = {
        id: this.generateAlertId(),
        type: 'sync_failure',
        severity: 'high',
        organizationId,
        storeId,
        message: `Order sync job timeout detected (running for ${this.thresholds.syncTimeoutMinutes}+ minutes)`,
        details: {
          threshold: this.thresholds.syncTimeoutMinutes,
          actualValue: job.startedAt ? 
            (Date.now() - job.startedAt.getTime()) / (1000 * 60) : 0,
        },
        createdAt: new Date(),
        notificationsSent: [],
      };

      await this.createAlert(alert);
    }
  }

  /**
   * Create and store alert
   */
  private async createAlert(alert: OrderSyncAlert): Promise<void> {
    // Check if similar alert already exists and is not resolved
    const existingAlert = Array.from(this.alerts.values()).find(
      a => a.type === alert.type && 
           a.organizationId === alert.organizationId &&
           a.storeId === alert.storeId &&
           !a.resolvedAt
    );

    if (existingAlert) {
      // Update existing alert instead of creating duplicate
      existingAlert.details = { ...existingAlert.details, ...alert.details };
      existingAlert.createdAt = alert.createdAt;
      return;
    }

    // Store alert
    this.alerts.set(alert.id, alert);

    // Send notifications
    await this.sendNotifications(alert);

    // Log alert creation
    console.log('Order sync alert created:', {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
    });
  }

  /**
   * Send notifications for alert
   */
  private async sendNotifications(alert: OrderSyncAlert): Promise<void> {
    const channels = this.notificationChannels.get(alert.organizationId) || [];

    for (const channel of channels) {
      if (!channel.enabled) continue;
      
      // Check if channel handles this alert type
      if (!channel.alertTypes.includes(alert.type)) continue;
      
      // Check severity threshold
      if (!this.meetsSeverityThreshold(alert.severity, channel.severityThreshold)) continue;

      try {
        await this.sendNotification(channel, alert);
        alert.notificationsSent.push(channel.type);
      } catch (error) {
        console.error(`Failed to send notification via ${channel.type}:`, error);
      }
    }
  }

  /**
   * Send notification via specific channel
   */
  private async sendNotification(
    channel: NotificationChannel,
    alert: OrderSyncAlert
  ): Promise<void> {
    const message = this.formatAlertMessage(alert);

    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(channel.config.recipients || [], message, alert);
        break;
      
      case 'webhook':
        if (channel.config.webhookUrl) {
          await this.sendWebhookNotification(channel.config.webhookUrl, alert);
        }
        break;
      
      case 'slack':
        if (channel.config.slackChannel) {
          await this.sendSlackNotification(channel.config.slackChannel, message, alert);
        }
        break;
      
      case 'teams':
        if (channel.config.teamsWebhook) {
          await this.sendTeamsNotification(channel.config.teamsWebhook, message, alert);
        }
        break;
    }
  }

  /**
   * Format alert message for notifications
   */
  private formatAlertMessage(alert: OrderSyncAlert): string {
    const storeInfo = alert.storeId ? ` (Store: ${alert.storeId})` : '';
    const timestamp = alert.createdAt.toISOString();
    
    return `🚨 Order Sync Alert [${alert.severity.toUpperCase()}]${storeInfo}

${alert.message}

Details:
${Object.entries(alert.details)
  .map(([key, value]) => `• ${key}: ${value}`)
  .join('\n')}

Time: ${timestamp}
Alert ID: ${alert.id}`;
  }

  /**
   * Check if alert meets severity threshold
   */
  private meetsSeverityThreshold(
    alertSeverity: OrderSyncAlert['severity'],
    threshold: OrderSyncAlert['severity']
  ): boolean {
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    return severityLevels[alertSeverity] >= severityLevels[threshold];
  }

  /**
   * Send email notification (placeholder)
   */
  private async sendEmailNotification(
    recipients: string[],
    message: string,
    alert: OrderSyncAlert
  ): Promise<void> {
    // TODO: Implement email service integration (SendGrid, AWS SES, etc.)
    console.log('Email notification sent:', {
      recipients,
      subject: `Order Sync Alert: ${alert.type}`,
      message,
    });
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(
    webhookUrl: string,
    alert: OrderSyncAlert
  ): Promise<void> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alert_type: alert.type,
          severity: alert.severity,
          organization_id: alert.organizationId,
          store_id: alert.storeId,
          message: alert.message,
          details: alert.details,
          created_at: alert.createdAt.toISOString(),
          alert_id: alert.id,
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Webhook notification failed:', error);
      throw error;
    }
  }

  /**
   * Send Slack notification (placeholder)
   */
  private async sendSlackNotification(
    channel: string,
    message: string,
    alert: OrderSyncAlert
  ): Promise<void> {
    // TODO: Implement Slack API integration
    console.log('Slack notification sent:', {
      channel,
      message,
      alert: alert.id,
    });
  }

  /**
   * Send Teams notification (placeholder)
   */
  private async sendTeamsNotification(
    webhookUrl: string,
    message: string,
    alert: OrderSyncAlert
  ): Promise<void> {
    // TODO: Implement Microsoft Teams webhook integration
    console.log('Teams notification sent:', {
      webhookUrl,
      message,
      alert: alert.id,
    });
  }

  /**
   * Get sync metrics for organization
   */
  async getSyncMetrics(
    organizationId: string,
    options: {
      storeId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<OrderSyncMetrics> {
    const { storeId, startDate, endDate } = options;
    const now = new Date();
    const defaultStartDate = startDate || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const defaultEndDate = endDate || now;

    const conditions = [
      eq(syncJobs.organizationId, organizationId),
      eq(syncJobs.jobType, 'ORDER_FETCH'.toLowerCase() as SyncJobType),
      gte(syncJobs.createdAt, defaultStartDate),
      lte(syncJobs.createdAt, defaultEndDate),
    ];

    if (storeId) {
      conditions.push(eq(syncJobs.storeId, storeId));
    }

    // Get basic sync job metrics
    const [jobStats] = await db
      .select({
        totalJobs: count(),
        successfulJobs: sql<number>`COUNT(CASE WHEN ${syncJobs.status} = 'completed' THEN 1 END)`,
        failedJobs: sql<number>`COUNT(CASE WHEN ${syncJobs.status} = 'failed' THEN 1 END)`,
        avgDuration: sql<number>`AVG(EXTRACT(EPOCH FROM (${syncJobs.completedAt} - ${syncJobs.startedAt})))`,
        totalProcessed: sql<number>`SUM(${syncJobs.itemsTotal})`,
        totalFailed: sql<number>`SUM(${syncJobs.itemsFailed})`,
      })
      .from(syncJobs)
      .where(and(...conditions));

    // Get last sync time
    const [lastSync] = await db
      .select({ completedAt: syncJobs.completedAt })
      .from(syncJobs)
      .where(and(
        ...conditions,
        eq(syncJobs.status, 'COMPLETED'.toLowerCase() as JobStatus)
      ))
      .orderBy(desc(syncJobs.completedAt))
      .limit(1);

    const totalJobs = jobStats.totalJobs || 0;
    const successfulJobs = jobStats.successfulJobs || 0;
    const successRate = totalJobs > 0 ? (successfulJobs / totalJobs) * 100 : 0;

    return {
      organizationId,
      storeId,
      period: {
        startDate: defaultStartDate,
        endDate: defaultEndDate,
      },
      totalSyncJobs: totalJobs,
      successfulSyncJobs: successfulJobs,
      failedSyncJobs: jobStats.failedJobs || 0,
      successRate,
      averageSyncDuration: Number(jobStats.avgDuration) || 0,
      totalOrdersProcessed: Number(jobStats.totalProcessed) || 0,
      ordersImported: 0, // TODO: Calculate from sync results
      ordersUpdated: 0, // TODO: Calculate from sync results
      ordersFailed: Number(jobStats.totalFailed) || 0,
      statusUpdatesSuccessful: 0, // TODO: Track status update metrics
      statusUpdatesFailed: 0, // TODO: Track status update metrics
      lastSyncAt: lastSync?.completedAt || undefined,
      errorsByType: {}, // TODO: Implement error classification
      performanceTrends: {
        syncDuration: [], // TODO: Implement trend analysis
        errorRate: [], // TODO: Implement trend analysis
        throughput: [], // TODO: Implement trend analysis
      },
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(
    organizationId: string,
    storeId?: string
  ): OrderSyncAlert[] {
    return Array.from(this.alerts.values()).filter(
      alert => alert.organizationId === organizationId &&
               (!storeId || alert.storeId === storeId) &&
               !alert.resolvedAt
    );
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolvedAt = new Date();
      console.log('Alert resolved:', alertId);
    }
  }

  /**
   * Configure notification channels for organization
   */
  configureNotificationChannels(
    organizationId: string,
    channels: NotificationChannel[]
  ): void {
    this.notificationChannels.set(organizationId, channels);
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const orderSyncMonitor = new OrderSyncMonitor();