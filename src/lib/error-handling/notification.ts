/**
 * Error notification system with escalation policies
 */

import { ErrorNotification, NotificationChannel, AppError, ErrorSeverity } from './types';
import { getLogger } from './logger';
import { env } from '@/env';

export interface NotificationConfig {
  channels: NotificationChannel[];
  escalationRules: EscalationRule[];
  rateLimiting: {
    maxNotificationsPerHour: number;
    cooldownPeriod: number; // minutes
  };
}

export interface EscalationRule {
  severity: ErrorSeverity;
  channels: NotificationChannel[];
  delay?: number; // minutes before escalation
  maxEscalations?: number;
}

export interface NotificationTemplate {
  subject: string;
  body: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export class ErrorNotificationService {
  private logger = getLogger('error-notification');
  private notificationHistory = new Map<string, Date[]>();
  private config: NotificationConfig;

  constructor(config?: Partial<NotificationConfig>) {
    this.config = {
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      escalationRules: [
        {
          severity: ErrorSeverity.LOW,
          channels: [NotificationChannel.IN_APP]
        },
        {
          severity: ErrorSeverity.MEDIUM,
          channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP]
        },
        {
          severity: ErrorSeverity.HIGH,
          channels: [NotificationChannel.EMAIL, NotificationChannel.SLACK, NotificationChannel.IN_APP],
          delay: 5,
          maxEscalations: 2
        },
        {
          severity: ErrorSeverity.CRITICAL,
          channels: [NotificationChannel.EMAIL, NotificationChannel.SLACK, NotificationChannel.SMS, NotificationChannel.IN_APP],
          delay: 2,
          maxEscalations: 3
        }
      ],
      rateLimiting: {
        maxNotificationsPerHour: 10,
        cooldownPeriod: 15
      },
      ...config
    };
  }

  /**
   * Send error notification based on severity and escalation rules
   */
  async notifyError(error: AppError, context?: Record<string, any>): Promise<void> {
    try {
      // Check rate limiting
      if (!this.shouldSendNotification(error)) {
        this.logger.debug('Notification rate limited', {
          errorCode: error.code,
          severity: error.severity
        });
        return;
      }

      // Get escalation rule for this error severity
      const escalationRule = this.getEscalationRule(error.severity);
      if (!escalationRule) {
        this.logger.debug('No escalation rule found for severity', {
          severity: error.severity
        });
        return;
      }

      // Create notification
      const notification: ErrorNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        error,
        notificationChannels: escalationRule.channels,
        escalationLevel: 0,
        sentAt: new Date()
      };

      // Send initial notification
      await this.sendNotification(notification, context);

      // Schedule escalations if configured
      if (escalationRule.delay && escalationRule.maxEscalations) {
        this.scheduleEscalations(notification, escalationRule, context);
      }

      // Record notification for rate limiting
      this.recordNotification(error);

    } catch (notificationError) {
      this.logger.error('Failed to send error notification', notificationError instanceof Error ? notificationError : undefined, {
        originalError: {
          type: error.type,
          message: error.message,
          code: error.code
        },
        context
      });
    }
  }

  /**
   * Check if notification should be sent based on rate limiting
   */
  private shouldSendNotification(error: AppError): boolean {
    const key = `${error.type}_${error.code}`;
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Get recent notifications for this error type
    const recentNotifications = this.notificationHistory.get(key) || [];
    const recentCount = recentNotifications.filter(date => date > oneHourAgo).length;

    // Check if we've exceeded the rate limit
    if (recentCount >= this.config.rateLimiting.maxNotificationsPerHour) {
      return false;
    }

    // Check cooldown period for critical errors
    if (error.severity === ErrorSeverity.CRITICAL && recentNotifications.length > 0) {
      const lastNotification = recentNotifications[recentNotifications.length - 1];
      const cooldownEnd = new Date(lastNotification.getTime() + this.config.rateLimiting.cooldownPeriod * 60 * 1000);
      
      if (now < cooldownEnd) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get escalation rule for error severity
   */
  private getEscalationRule(severity: ErrorSeverity): EscalationRule | undefined {
    return this.config.escalationRules.find(rule => rule.severity === severity);
  }

  /**
   * Send notification through configured channels
   */
  private async sendNotification(
    notification: ErrorNotification,
    context?: Record<string, any>
  ): Promise<void> {
    const template = this.createNotificationTemplate(notification.error, context);

    const promises = notification.notificationChannels.map(async (channel) => {
      try {
        switch (channel) {
          case NotificationChannel.EMAIL:
            await this.sendEmailNotification(notification, template);
            break;
          case NotificationChannel.SLACK:
            await this.sendSlackNotification(notification, template);
            break;
          case NotificationChannel.SMS:
            await this.sendSMSNotification(notification, template);
            break;
          case NotificationChannel.WEBHOOK:
            await this.sendWebhookNotification(notification, template);
            break;
          case NotificationChannel.IN_APP:
            await this.sendInAppNotification(notification, template);
            break;
        }

        this.logger.info(`Notification sent via ${channel}`, {
          notificationId: notification.id,
          channel,
          errorCode: notification.error.code
        });

      } catch (error) {
        this.logger.error(`Failed to send notification via ${channel}`, error instanceof Error ? error : undefined, {
          notificationId: notification.id,
          channel
        });
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Create notification template based on error
   */
  private createNotificationTemplate(error: AppError, context?: Record<string, any>): NotificationTemplate {
    const priority = this.mapSeverityToPriority(error.severity);
    
    const subject = `[${error.severity.toUpperCase()}] ${error.type.replace(/_/g, ' ')} - ${error.code}`;
    
    const body = `
Error Details:
- Type: ${error.type}
- Code: ${error.code}
- Message: ${error.message}
- Severity: ${error.severity}
- Timestamp: ${error.timestamp.toISOString()}
- Correlation ID: ${error.correlationId}
${error.userId ? `- User ID: ${error.userId}` : ''}
${error.organizationId ? `- Organization ID: ${error.organizationId}` : ''}

${error.context ? `Context:
${JSON.stringify(error.context, null, 2)}` : ''}

${error.details ? `Details:
${JSON.stringify(error.details, null, 2)}` : ''}

${context ? `Additional Context:
${JSON.stringify(context, null, 2)}` : ''}

${error.stack ? `Stack Trace:
${error.stack}` : ''}
    `.trim();

    return { subject, body, priority };
  }

  /**
   * Map error severity to notification priority
   */
  private mapSeverityToPriority(severity: ErrorSeverity): 'low' | 'normal' | 'high' | 'urgent' {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'low';
      case ErrorSeverity.MEDIUM:
        return 'normal';
      case ErrorSeverity.HIGH:
        return 'high';
      case ErrorSeverity.CRITICAL:
        return 'urgent';
      default:
        return 'normal';
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    notification: ErrorNotification,
    template: NotificationTemplate
  ): Promise<void> {
    // Implementation would depend on email service (SendGrid, AWS SES, etc.)
    // For now, we'll log the notification
    this.logger.info('Email notification would be sent', {
      to: 'admin@storesync.com', // This would come from configuration
      subject: template.subject,
      priority: template.priority,
      notificationId: notification.id
    });
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(
    notification: ErrorNotification,
    template: NotificationTemplate
  ): Promise<void> {
    // Implementation would use Slack webhook or API
    this.logger.info('Slack notification would be sent', {
      channel: '#alerts', // This would come from configuration
      message: template.body,
      priority: template.priority,
      notificationId: notification.id
    });
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(
    notification: ErrorNotification,
    template: NotificationTemplate
  ): Promise<void> {
    // Implementation would use Twilio, AWS SNS, etc.
    this.logger.info('SMS notification would be sent', {
      message: `${template.subject}\n\n${template.body.substring(0, 160)}...`,
      priority: template.priority,
      notificationId: notification.id
    });
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(
    notification: ErrorNotification,
    template: NotificationTemplate
  ): Promise<void> {
    // Implementation would send HTTP POST to configured webhook URL
    this.logger.info('Webhook notification would be sent', {
      payload: {
        notification,
        template
      },
      notificationId: notification.id
    });
  }

  /**
   * Send in-app notification
   */
  private async sendInAppNotification(
    notification: ErrorNotification,
    template: NotificationTemplate
  ): Promise<void> {
    // Implementation would store notification in database for UI display
    this.logger.info('In-app notification created', {
      subject: template.subject,
      priority: template.priority,
      notificationId: notification.id
    });
  }

  /**
   * Schedule escalation notifications
   */
  private scheduleEscalations(
    notification: ErrorNotification,
    rule: EscalationRule,
    context?: Record<string, any>
  ): void {
    if (!rule.delay || !rule.maxEscalations) return;

    for (let level = 1; level <= rule.maxEscalations; level++) {
      const delay = rule.delay * level * 60 * 1000; // Convert minutes to milliseconds
      
      setTimeout(async () => {
        // Check if error has been acknowledged
        if (notification.acknowledged) {
          this.logger.info('Escalation cancelled - error acknowledged', {
            notificationId: notification.id,
            escalationLevel: level
          });
          return;
        }

        // Send escalation notification
        const escalatedNotification: ErrorNotification = {
          ...notification,
          id: `${notification.id}_escalation_${level}`,
          escalationLevel: level,
          sentAt: new Date()
        };

        await this.sendNotification(escalatedNotification, {
          ...context,
          escalation: true,
          escalationLevel: level
        });

      }, delay);
    }
  }

  /**
   * Record notification for rate limiting
   */
  private recordNotification(error: AppError): void {
    const key = `${error.type}_${error.code}`;
    const notifications = this.notificationHistory.get(key) || [];
    
    notifications.push(new Date());
    
    // Keep only recent notifications (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentNotifications = notifications.filter(date => date > oneDayAgo);
    
    this.notificationHistory.set(key, recentNotifications);
  }

  /**
   * Acknowledge error notification
   */
  async acknowledgeError(
    notificationId: string,
    acknowledgedBy: string
  ): Promise<void> {
    // In a real implementation, this would update the notification in the database
    this.logger.info('Error notification acknowledged', {
      notificationId,
      acknowledgedBy,
      acknowledgedAt: new Date().toISOString()
    });
  }
}

// Global notification service instance
let globalNotificationService: ErrorNotificationService | null = null;

/**
 * Get global notification service instance
 */
export function getNotificationService(): ErrorNotificationService {
  if (!globalNotificationService) {
    globalNotificationService = new ErrorNotificationService();
  }
  return globalNotificationService;
}