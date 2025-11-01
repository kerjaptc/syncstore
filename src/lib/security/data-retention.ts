/**
 * Data Retention Service
 * Implements automated data retention policies and cleanup procedures
 */

import { AuditLoggerService, AuditEventType } from './audit-logger';

export enum RetentionPeriod {
  IMMEDIATE = 0,
  ONE_WEEK = 7,
  ONE_MONTH = 30,
  THREE_MONTHS = 90,
  SIX_MONTHS = 180,
  ONE_YEAR = 365,
  TWO_YEARS = 730,
  SEVEN_YEARS = 2555, // Legal requirement for financial records
  INDEFINITE = -1,
}

export enum DataCategory {
  USER_ACCOUNT = 'user_account',
  ORDER_DATA = 'order_data',
  PRODUCT_DATA = 'product_data',
  INVENTORY_DATA = 'inventory_data',
  ANALYTICS_DATA = 'analytics_data',
  AUDIT_LOGS = 'audit_logs',
  SESSION_DATA = 'session_data',
  CACHE_DATA = 'cache_data',
  BACKUP_DATA = 'backup_data',
  MARKETING_DATA = 'marketing_data',
  SUPPORT_DATA = 'support_data',
}

export enum RetentionReason {
  BUSINESS_OPERATION = 'business_operation',
  LEGAL_REQUIREMENT = 'legal_requirement',
  REGULATORY_COMPLIANCE = 'regulatory_compliance',
  USER_CONSENT = 'user_consent',
  LEGITIMATE_INTEREST = 'legitimate_interest',
  CONTRACT_PERFORMANCE = 'contract_performance',
}

interface RetentionPolicy {
  id: string;
  dataCategory: DataCategory;
  retentionPeriod: RetentionPeriod;
  reason: RetentionReason;
  description: string;
  legalBasis?: string;
  exceptions?: string[];
  autoDelete: boolean;
  requiresApproval: boolean;
  notificationDays: number; // Days before deletion to notify
}

interface RetentionJob {
  id: string;
  policyId: string;
  dataCategory: DataCategory;
  scheduledFor: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  recordsToDelete: number;
  recordsDeleted: number;
  errors?: string[];
  createdAt: Date;
  completedAt?: Date;
}

interface DataRecord {
  id: string;
  category: DataCategory;
  createdAt: Date;
  lastModified: Date;
  organizationId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export class DataRetentionService {
  private static retentionPolicies: RetentionPolicy[] = [];
  private static retentionJobs: RetentionJob[] = [];
  private static scheduledJobs = new Map<string, NodeJS.Timeout>();

  /**
   * Initialize default retention policies
   */
  static initializeDefaultPolicies(): void {
    const defaultPolicies: RetentionPolicy[] = [
      {
        id: 'user_account_policy',
        dataCategory: DataCategory.USER_ACCOUNT,
        retentionPeriod: RetentionPeriod.TWO_YEARS,
        reason: RetentionReason.CONTRACT_PERFORMANCE,
        description: 'User account data retained for 2 years after account closure',
        autoDelete: false,
        requiresApproval: true,
        notificationDays: 30,
      },
      {
        id: 'order_data_policy',
        dataCategory: DataCategory.ORDER_DATA,
        retentionPeriod: RetentionPeriod.SEVEN_YEARS,
        reason: RetentionReason.LEGAL_REQUIREMENT,
        description: 'Order data retained for 7 years for tax and legal compliance',
        legalBasis: 'Tax law requirements',
        autoDelete: false,
        requiresApproval: true,
        notificationDays: 90,
      },
      {
        id: 'analytics_data_policy',
        dataCategory: DataCategory.ANALYTICS_DATA,
        retentionPeriod: RetentionPeriod.TWO_YEARS,
        reason: RetentionReason.LEGITIMATE_INTEREST,
        description: 'Analytics data retained for 2 years for business insights',
        autoDelete: true,
        requiresApproval: false,
        notificationDays: 7,
      },
      {
        id: 'audit_logs_policy',
        dataCategory: DataCategory.AUDIT_LOGS,
        retentionPeriod: RetentionPeriod.ONE_YEAR,
        reason: RetentionReason.REGULATORY_COMPLIANCE,
        description: 'Audit logs retained for 1 year for security compliance',
        autoDelete: true,
        requiresApproval: false,
        notificationDays: 30,
      },
      {
        id: 'session_data_policy',
        dataCategory: DataCategory.SESSION_DATA,
        retentionPeriod: RetentionPeriod.ONE_MONTH,
        reason: RetentionReason.BUSINESS_OPERATION,
        description: 'Session data retained for 1 month',
        autoDelete: true,
        requiresApproval: false,
        notificationDays: 0,
      },
      {
        id: 'cache_data_policy',
        dataCategory: DataCategory.CACHE_DATA,
        retentionPeriod: RetentionPeriod.ONE_WEEK,
        reason: RetentionReason.BUSINESS_OPERATION,
        description: 'Cache data retained for 1 week',
        autoDelete: true,
        requiresApproval: false,
        notificationDays: 0,
      },
      {
        id: 'marketing_data_policy',
        dataCategory: DataCategory.MARKETING_DATA,
        retentionPeriod: RetentionPeriod.THREE_MONTHS,
        reason: RetentionReason.USER_CONSENT,
        description: 'Marketing data retained for 3 months with user consent',
        autoDelete: true,
        requiresApproval: false,
        notificationDays: 14,
      },
    ];

    this.retentionPolicies = defaultPolicies;
  }

  /**
   * Add or update retention policy
   */
  static setRetentionPolicy(policy: RetentionPolicy): void {
    const existingIndex = this.retentionPolicies.findIndex(p => p.id === policy.id);
    
    if (existingIndex >= 0) {
      this.retentionPolicies[existingIndex] = policy;
    } else {
      this.retentionPolicies.push(policy);
    }

    // Reschedule jobs for this policy
    this.scheduleRetentionJobs(policy);
  }

  /**
   * Get retention policy for data category
   */
  static getRetentionPolicy(dataCategory: DataCategory): RetentionPolicy | null {
    return this.retentionPolicies.find(p => p.dataCategory === dataCategory) || null;
  }

  /**
   * Calculate retention expiry date
   */
  static calculateExpiryDate(createdAt: Date, retentionPeriod: RetentionPeriod): Date | null {
    if (retentionPeriod === RetentionPeriod.INDEFINITE) {
      return null;
    }

    const expiryDate = new Date(createdAt);
    expiryDate.setDate(expiryDate.getDate() + retentionPeriod);
    return expiryDate;
  }

  /**
   * Check if data record has expired
   */
  static isDataExpired(record: DataRecord): boolean {
    const policy = this.getRetentionPolicy(record.category);
    if (!policy || policy.retentionPeriod === RetentionPeriod.INDEFINITE) {
      return false;
    }

    const expiryDate = this.calculateExpiryDate(record.createdAt, policy.retentionPeriod);
    return expiryDate ? new Date() > expiryDate : false;
  }

  /**
   * Find expired data records
   */
  static async findExpiredRecords(
    dataCategory: DataCategory,
    organizationId?: string
  ): Promise<DataRecord[]> {
    // In a real implementation, this would query the database
    // For now, return empty array as placeholder
    const expiredRecords: DataRecord[] = [];

    // Log the search for expired records
    await AuditLoggerService.logEvent(AuditEventType.DATA_READ, {
      action: 'expired_records_search',
      outcome: 'success',
      resource: 'data_retention',
      details: {
        dataCategory,
        organizationId,
        expiredCount: expiredRecords.length,
      },
    });

    return expiredRecords;
  }

  /**
   * Schedule retention job
   */
  static async scheduleRetentionJob(
    policyId: string,
    scheduledFor: Date,
    recordsToDelete: number
  ): Promise<RetentionJob> {
    const policy = this.retentionPolicies.find(p => p.id === policyId);
    if (!policy) {
      throw new Error(`Retention policy ${policyId} not found`);
    }

    const job: RetentionJob = {
      id: `retention_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      policyId,
      dataCategory: policy.dataCategory,
      scheduledFor,
      status: 'pending',
      recordsToDelete,
      recordsDeleted: 0,
      createdAt: new Date(),
    };

    this.retentionJobs.push(job);

    // Schedule the job execution
    const delay = scheduledFor.getTime() - Date.now();
    if (delay > 0) {
      const timeout = setTimeout(() => {
        this.executeRetentionJob(job.id);
      }, delay);
      
      this.scheduledJobs.set(job.id, timeout);
    } else {
      // Execute immediately if scheduled time has passed
      this.executeRetentionJob(job.id);
    }

    // Log job scheduling
    await AuditLoggerService.logEvent(AuditEventType.DATA_DELETE, {
      action: 'retention_job_scheduled',
      outcome: 'success',
      resource: 'data_retention',
      resourceId: job.id,
      details: {
        policyId,
        dataCategory: policy.dataCategory,
        scheduledFor,
        recordsToDelete,
      },
    });

    return job;
  }

  /**
   * Execute retention job
   */
  private static async executeRetentionJob(jobId: string): Promise<void> {
    const job = this.retentionJobs.find(j => j.id === jobId);
    if (!job) {
      console.error(`Retention job ${jobId} not found`);
      return;
    }

    const policy = this.retentionPolicies.find(p => p.id === job.policyId);
    if (!policy) {
      console.error(`Retention policy ${job.policyId} not found`);
      job.status = 'failed';
      job.errors = ['Policy not found'];
      return;
    }

    try {
      job.status = 'running';

      // Log job start
      await AuditLoggerService.logEvent(AuditEventType.DATA_DELETE, {
        action: 'retention_job_started',
        outcome: 'success',
        resource: 'data_retention',
        resourceId: job.id,
        details: {
          policyId: job.policyId,
          dataCategory: job.dataCategory,
          recordsToDelete: job.recordsToDelete,
        },
      });

      // Find expired records
      const expiredRecords = await this.findExpiredRecords(job.dataCategory);
      
      // Delete records in batches
      const batchSize = 100;
      let deletedCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < expiredRecords.length; i += batchSize) {
        const batch = expiredRecords.slice(i, i + batchSize);
        
        try {
          await this.deleteRecordBatch(batch, policy);
          deletedCount += batch.length;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${errorMessage}`);
        }
      }

      job.recordsDeleted = deletedCount;
      job.status = deletedCount === expiredRecords.length ? 'completed' : 'failed';
      job.completedAt = new Date();
      
      if (errors.length > 0) {
        job.errors = errors;
      }

      // Log job completion
      await AuditLoggerService.logEvent(AuditEventType.DATA_DELETE, {
        action: 'retention_job_completed',
        outcome: job.status === 'completed' ? 'success' : 'failure',
        resource: 'data_retention',
        resourceId: job.id,
        details: {
          policyId: job.policyId,
          dataCategory: job.dataCategory,
          recordsDeleted: deletedCount,
          recordsToDelete: job.recordsToDelete,
          errors: errors.length,
        },
      });

      // Send notification if configured
      if (policy.notificationDays > 0) {
        await this.sendRetentionNotification(job, policy);
      }

    } catch (error) {
      console.error(`Retention job ${jobId} failed:`, error);
      job.status = 'failed';
      job.errors = [error instanceof Error ? error.message : 'Unknown error'];
      job.completedAt = new Date();

      await AuditLoggerService.logEvent(AuditEventType.SYSTEM_ERROR, {
        action: 'retention_job_failed',
        outcome: 'failure',
        resource: 'data_retention',
        resourceId: job.id,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    } finally {
      // Clean up scheduled job
      this.scheduledJobs.delete(jobId);
    }
  }

  /**
   * Delete a batch of records
   */
  private static async deleteRecordBatch(
    records: DataRecord[],
    policy: RetentionPolicy
  ): Promise<void> {
    // In a real implementation, this would delete records from the database
    console.log(`Deleting ${records.length} records for policy ${policy.id}`);
    
    // Simulate deletion delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Send retention notification
   */
  private static async sendRetentionNotification(
    job: RetentionJob,
    policy: RetentionPolicy
  ): Promise<void> {
    console.log(`Sending retention notification for job ${job.id}`);
    
    // In a real implementation, this would send email notifications
    // to relevant stakeholders about the data deletion
  }

  /**
   * Schedule retention jobs for a policy
   */
  private static scheduleRetentionJobs(policy: RetentionPolicy): void {
    if (!policy.autoDelete || policy.retentionPeriod === RetentionPeriod.INDEFINITE) {
      return;
    }

    // Schedule daily checks for expired data
    const checkInterval = 24 * 60 * 60 * 1000; // 24 hours
    
    const scheduleCheck = () => {
      setTimeout(async () => {
        try {
          const expiredRecords = await this.findExpiredRecords(policy.dataCategory);
          
          if (expiredRecords.length > 0) {
            const scheduledFor = new Date();
            scheduledFor.setDate(scheduledFor.getDate() + 1); // Schedule for tomorrow
            
            await this.scheduleRetentionJob(policy.id, scheduledFor, expiredRecords.length);
          }
        } catch (error) {
          console.error(`Failed to schedule retention check for policy ${policy.id}:`, error);
        }
        
        // Schedule next check
        scheduleCheck();
      }, checkInterval);
    };

    scheduleCheck();
  }

  /**
   * Cancel retention job
   */
  static cancelRetentionJob(jobId: string): boolean {
    const job = this.retentionJobs.find(j => j.id === jobId);
    if (!job || job.status !== 'pending') {
      return false;
    }

    job.status = 'cancelled';
    
    const timeout = this.scheduledJobs.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledJobs.delete(jobId);
    }

    return true;
  }

  /**
   * Get retention statistics
   */
  static getRetentionStatistics(): {
    policies: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    totalRecordsDeleted: number;
  } {
    const activeJobs = this.retentionJobs.filter(j => 
      j.status === 'pending' || j.status === 'running'
    ).length;

    const completedJobs = this.retentionJobs.filter(j => 
      j.status === 'completed'
    ).length;

    const failedJobs = this.retentionJobs.filter(j => 
      j.status === 'failed'
    ).length;

    const totalRecordsDeleted = this.retentionJobs
      .filter(j => j.status === 'completed')
      .reduce((total, job) => total + job.recordsDeleted, 0);

    return {
      policies: this.retentionPolicies.length,
      activeJobs,
      completedJobs,
      failedJobs,
      totalRecordsDeleted,
    };
  }

  /**
   * Get retention jobs
   */
  static getRetentionJobs(filters?: {
    status?: RetentionJob['status'];
    dataCategory?: DataCategory;
    limit?: number;
  }): RetentionJob[] {
    let jobs = [...this.retentionJobs];

    if (filters?.status) {
      jobs = jobs.filter(j => j.status === filters.status);
    }

    if (filters?.dataCategory) {
      jobs = jobs.filter(j => j.dataCategory === filters.dataCategory);
    }

    // Sort by creation date (newest first)
    jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (filters?.limit) {
      jobs = jobs.slice(0, filters.limit);
    }

    return jobs;
  }

  /**
   * Initialize the retention service
   */
  static initialize(): void {
    this.initializeDefaultPolicies();
    
    // Schedule retention jobs for all auto-delete policies
    this.retentionPolicies
      .filter(p => p.autoDelete)
      .forEach(policy => this.scheduleRetentionJobs(policy));

    console.log('Data retention service initialized with', this.retentionPolicies.length, 'policies');
  }
}

// Initialize the service when the module is loaded
if (typeof window === 'undefined') {
  DataRetentionService.initialize();
}