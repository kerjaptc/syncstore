/**
 * Error handling types and interfaces
 */

export enum ErrorType {
  VALIDATION_ERROR = 'validation_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  AUTHORIZATION_ERROR = 'authorization_error',
  PLATFORM_API_ERROR = 'platform_api_error',
  SYNC_ERROR = 'sync_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  NETWORK_ERROR = 'network_error',
  DATABASE_ERROR = 'database_error',
  INTERNAL_ERROR = 'internal_error',
  BUSINESS_LOGIC_ERROR = 'business_logic_error',
  EXTERNAL_SERVICE_ERROR = 'external_service_error'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

export interface AppError {
  type: ErrorType;
  message: string;
  code: string;
  details?: Record<string, any>;
  retryable: boolean;
  severity: ErrorSeverity;
  timestamp: Date;
  correlationId?: string;
  userId?: string;
  organizationId?: string;
  context?: ErrorContext;
  stack?: string;
  cause?: Error;
}

export interface ErrorContext {
  operation: string;
  component: string;
  retryCount?: number;
  metadata?: Record<string, any>;
  requestId?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  correlationId: string;
  userId?: string;
  organizationId?: string;
  component: string;
  operation?: string;
  metadata?: Record<string, any>;
  error?: AppError;
  duration?: number;
  requestId?: string;
  sessionId?: string;
}

export interface ErrorNotification {
  id: string;
  error: AppError;
  notificationChannels: NotificationChannel[];
  escalationLevel: number;
  sentAt?: Date;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export enum NotificationChannel {
  EMAIL = 'email',
  SLACK = 'slack',
  SMS = 'sms',
  WEBHOOK = 'webhook',
  IN_APP = 'in_app'
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
  successCount?: number;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface ErrorRecoveryStrategy {
  type: 'retry' | 'fallback' | 'circuit_breaker' | 'ignore';
  config?: RetryConfig | any;
  fallbackAction?: () => Promise<any>;
}