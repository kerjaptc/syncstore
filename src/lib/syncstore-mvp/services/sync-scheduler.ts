/**
 * SyncStore MVP Sync Scheduler
 * 
 * This service manages sync scheduling, monitoring, and reporting
 * with support for manual triggers, periodic syncs, and health monitoring.
 */

import {
  SyncResult,
  SyncStatus,
  SyncLog,
  createErrorContext,
  SyncError,
  DatabaseError,
} from '../index';
import { CoreSyncEngine } from './sync-engine';
import { ConnectionManagerService } from './connection-manager';
// import { getMvpRepositories } from '../database/repositories'; // Disabled - server-side only

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface SyncScheduleConfig {
  enablePeriodicSync: boolean;
  periodicSyncInterval: number; // in milliseconds
  maxConcurrentSyncs: number;
  syncTimeout: number;
  retryFailedSyncs: boolean;
  retryInterval: number;
  healthCheckInterval: number;
}

export interface ScheduledSync {
  storeId: string;
  type: 'full' | 'incremental';
  scheduledAt: Date;
  priority: 'low' | 'normal' | 'high';
  retryCount: number;
  maxRetries: number;
}

export interface SyncReport {
  storeId: string;
  storeName: string;
  lastSyncAt?: Date;
  lastSyncStatus: 'completed' | 'failed' | 'running' | 'idle';
  totalProducts: number;
  syncedProducts: number;
  failedProducts: number;
  errors: string[];
  nextScheduledSync?: Date;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}

export interface SystemSyncReport {
  totalStores: number;
  activeStores: number;
  healthyStores: number;
  activeSyncs: number;
  completedSyncsToday: number;
  failedSyncsToday: number;
  averageSyncDuration: number;
  systemHealth: 'healthy' | 'degraded' | 'unhealthy';
  lastReportGenerated: Date;
}

// ============================================================================
// Sync Scheduler Service
// ============================================================================

export class SyncSchedulerService {
  private config: SyncScheduleConfig;
  private syncEngine: CoreSyncEngine;
  private connectionManager: ConnectionManagerService;
  // private repositories = getMvpRepositories(); // Disabled - server-side only
  
  private syncQueue: ScheduledSync[] = [];
  private periodicSyncTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;
  private retryTimer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(
    syncEngine: CoreSyncEngine,
    connectionManager: ConnectionManagerService,
    config?: Partial<SyncScheduleConfig>
  ) {
    this.syncEngine = syncEngine;
    this.connectionManager = connectionManager;
    
    this.config = {
      enablePeriodicSync: true,
      periodicSyncInterval: 6 * 60 * 60 * 1000, // 6 hours
      maxConcurrentSyncs: 3,
      syncTimeout: 30 * 60 * 1000, // 30 minutes
      retryFailedSyncs: true,
      retryInterval: 60 * 60 * 1000, // 1 hour
      healthCheckInterval: 5 * 60 * 1000, // 5 minutes
      ...config,
    };
  }

  // ============================================================================
  // Scheduler Management
  // ============================================================================

  /**
   * Starts the sync scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Sync scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting sync scheduler...');

    // Start periodic sync timer
    if (this.config.enablePeriodicSync) {
      this.startPeriodicSync();
    }

    // Start health check timer
    this.startHealthCheck();

    // Start retry timer
    if (this.config.retryFailedSyncs) {
      this.startRetryTimer();
    }

    // Process existing queue
    this.processQueue();

    console.log('✅ Sync scheduler started successfully');
  }

  /**
   * Stops the sync scheduler
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️  Sync scheduler is not running');
      return;
    }

    this.isRunning = false;
    console.log('🛑 Stopping sync scheduler...');

    // Clear timers
    if (this.periodicSyncTimer) {
      clearInterval(this.periodicSyncTimer);
      this.periodicSyncTimer = undefined;
    }

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = undefined;
    }

    // Clear queue
    this.syncQueue = [];

    console.log('✅ Sync scheduler stopped');
  }

  /**
   * Schedules a manual sync
   */
  async scheduleSync(
    storeId: string,
    type: 'full' | 'incremental' = 'full',
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): Promise<string> {
    try {
      // Check if store exists
      const connection = await this.connectionManager.getConnection(storeId);
      if (!connection) {
        throw new SyncError('Store connection not found', storeId, type, 0);
      }

      // Check if sync is already queued or running
      const existingSync = this.syncQueue.find(sync => sync.storeId === storeId);
      if (existingSync) {
        throw new SyncError('Sync already scheduled for this store', storeId, type, 0);
      }

      const activeSyncs = this.syncEngine.getActiveSyncs();
      const isRunning = activeSyncs.some(sync => sync.storeId === storeId);
      if (isRunning) {
        throw new SyncError('Sync already running for this store', storeId, type, 0);
      }

      // Add to queue
      const scheduledSync: ScheduledSync = {
        storeId,
        type,
        scheduledAt: new Date(),
        priority,
        retryCount: 0,
        maxRetries: 3,
      };

      this.syncQueue.push(scheduledSync);
      this.sortQueue();

      console.log(`📅 Scheduled ${type} sync for store ${storeId} with ${priority} priority`);

      // Process queue immediately
      this.processQueue();

      return `sync_${storeId}_${Date.now()}`;

    } catch (error) {
      const context = createErrorContext('scheduleSync', { storeId, type, priority });
      throw new SyncError(
        `Failed to schedule sync: ${error instanceof Error ? error.message : 'Unknown error'}`,
        storeId,
        type,
        0,
        context
      );
    }
  }

  /**
   * Cancels a scheduled sync
   */
  async cancelScheduledSync(storeId: string): Promise<boolean> {
    const index = this.syncQueue.findIndex(sync => sync.storeId === storeId);
    if (index === -1) {
      return false;
    }

    this.syncQueue.splice(index, 1);
    console.log(`❌ Cancelled scheduled sync for store ${storeId}`);
    return true;
  }

  /**
   * Gets scheduled syncs
   */
  getScheduledSyncs(): ScheduledSync[] {
    return [...this.syncQueue];
  }

  // ============================================================================
  // Sync Status and Monitoring
  // ============================================================================

  /**
   * Gets sync status for a store
   */
  async getSyncStatus(storeId: string): Promise<SyncStatus> {
    return await this.syncEngine.getSyncStatus(storeId);
  }

  /**
   * Gets sync history for a store
   */
  async getSyncHistory(storeId: string, limit: number = 10): Promise<SyncLog[]> {
    return await this.syncEngine.getSyncHistory(storeId, limit);
  }

  /**
   * Generates a sync report for a store
   */
  async generateStoreReport(storeId: string): Promise<SyncReport> {
    try {
      const connection = await this.connectionManager.getConnection(storeId);
      if (!connection) {
        throw new Error('Store connection not found');
      }

      const syncStatus = await this.getSyncStatus(storeId);
      const productCount = await this.repositories.products.getCountByStore(storeId);
      const connectionStatus = await this.connectionManager.validateConnection(storeId);

      // Calculate health status
      let healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (!connectionStatus.isValid) {
        healthStatus = 'unhealthy';
      } else if (syncStatus.errors.length > 0) {
        healthStatus = 'degraded';
      }

      // Calculate next scheduled sync
      const scheduledSync = this.syncQueue.find(sync => sync.storeId === storeId);
      const nextScheduledSync = scheduledSync?.scheduledAt || this.calculateNextPeriodicSync(connection.lastSyncAt);

      return {
        storeId,
        storeName: connection.storeName,
        lastSyncAt: connection.lastSyncAt,
        lastSyncStatus: syncStatus.status,
        totalProducts: syncStatus.totalProducts,
        syncedProducts: syncStatus.syncedProducts,
        failedProducts: syncStatus.totalProducts - syncStatus.syncedProducts,
        errors: syncStatus.errors,
        nextScheduledSync,
        healthStatus,
      };

    } catch (error) {
      throw new DatabaseError(
        `Failed to generate store report: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'generateStoreReport',
        undefined,
        createErrorContext('generateStoreReport', { storeId })
      );
    }
  }

  /**
   * Generates a system-wide sync report
   */
  async generateSystemReport(organizationId: string): Promise<SystemSyncReport> {
    try {
      const connections = await this.connectionManager.listConnections(organizationId);
      const activeSyncs = this.syncEngine.getActiveSyncs();
      
      // Get today's sync logs
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let completedSyncsToday = 0;
      let failedSyncsToday = 0;
      let totalSyncDuration = 0;
      let healthyStores = 0;

      for (const connection of connections) {
        // Check health
        const connectionStatus = await this.connectionManager.validateConnection(connection.storeId);
        if (connectionStatus.isValid) {
          healthyStores++;
        }

        // Get today's sync logs
        const logs = await this.repositories.syncLogs.getByStoreId(connection.storeId, { limit: 10 });
        const todayLogs = logs.filter(log => log.createdAt >= today);
        
        for (const log of todayLogs) {
          if (log.status === 'completed') {
            completedSyncsToday++;
            if (log.duration) {
              totalSyncDuration += log.duration;
            }
          } else if (log.status === 'failed') {
            failedSyncsToday++;
          }
        }
      }

      const averageSyncDuration = completedSyncsToday > 0 ? totalSyncDuration / completedSyncsToday : 0;
      
      // Calculate system health
      let systemHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      const healthyPercentage = connections.length > 0 ? (healthyStores / connections.length) * 100 : 100;
      
      if (healthyPercentage < 50) {
        systemHealth = 'unhealthy';
      } else if (healthyPercentage < 80) {
        systemHealth = 'degraded';
      }

      return {
        totalStores: connections.length,
        activeStores: connections.filter(c => c.status === 'active').length,
        healthyStores,
        activeSyncs: activeSyncs.length,
        completedSyncsToday,
        failedSyncsToday,
        averageSyncDuration,
        systemHealth,
        lastReportGenerated: new Date(),
      };

    } catch (error) {
      throw new DatabaseError(
        `Failed to generate system report: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'generateSystemReport',
        undefined,
        createErrorContext('generateSystemReport', { organizationId })
      );
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Starts periodic sync timer
   */
  private startPeriodicSync(): void {
    this.periodicSyncTimer = setInterval(async () => {
      try {
        await this.schedulePeriodicSyncs();
      } catch (error) {
        console.error('❌ Periodic sync scheduling failed:', error);
      }
    }, this.config.periodicSyncInterval);

    console.log(`⏰ Periodic sync enabled (interval: ${this.config.periodicSyncInterval / 1000 / 60} minutes)`);
  }

  /**
   * Starts health check timer
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        console.error('❌ Health check failed:', error);
      }
    }, this.config.healthCheckInterval);

    console.log(`🏥 Health check enabled (interval: ${this.config.healthCheckInterval / 1000 / 60} minutes)`);
  }

  /**
   * Starts retry timer
   */
  private startRetryTimer(): void {
    this.retryTimer = setInterval(async () => {
      try {
        await this.retryFailedSyncs();
      } catch (error) {
        console.error('❌ Retry failed syncs failed:', error);
      }
    }, this.config.retryInterval);

    console.log(`🔄 Retry timer enabled (interval: ${this.config.retryInterval / 1000 / 60} minutes)`);
  }

  /**
   * Schedules periodic syncs for all active stores
   */
  private async schedulePeriodicSyncs(): Promise<void> {
    try {
      // Get all active connections that need sync
      const cutoffTime = new Date(Date.now() - this.config.periodicSyncInterval);
      const connections = await this.repositories.storeConnections.getConnectionsNeedingHealthCheck(cutoffTime);

      for (const connection of connections) {
        // Check if already queued or running
        const isQueued = this.syncQueue.some(sync => sync.storeId === connection.storeId);
        const activeSyncs = this.syncEngine.getActiveSyncs();
        const isRunning = activeSyncs.some(sync => sync.storeId === connection.storeId);

        if (!isQueued && !isRunning) {
          try {
            await this.scheduleSync(connection.storeId, 'incremental', 'low');
          } catch (error) {
            console.warn(`⚠️  Failed to schedule periodic sync for store ${connection.storeId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to schedule periodic syncs:', error);
    }
  }

  /**
   * Performs health checks on all connections
   */
  private async performHealthChecks(): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - this.config.healthCheckInterval);
      const connections = await this.repositories.storeConnections.getConnectionsNeedingHealthCheck(cutoffTime);

      for (const connection of connections) {
        try {
          const status = await this.connectionManager.validateConnection(connection.storeId);
          const healthStatus = status.isValid ? 'healthy' : 'unhealthy';
          
          await this.repositories.storeConnections.updateHealthStatus(
            connection.storeId,
            healthStatus,
            new Date()
          );

          if (!status.isValid) {
            console.warn(`⚠️  Store ${connection.storeId} health check failed: ${status.error}`);
          }
        } catch (error) {
          console.error(`❌ Health check failed for store ${connection.storeId}:`, error);
          
          await this.repositories.storeConnections.updateHealthStatus(
            connection.storeId,
            'unhealthy',
            new Date()
          );
        }
      }
    } catch (error) {
      console.error('❌ Failed to perform health checks:', error);
    }
  }

  /**
   * Retries failed syncs
   */
  private async retryFailedSyncs(): Promise<void> {
    try {
      // Get failed syncs from the last hour
      const cutoffTime = new Date(Date.now() - this.config.retryInterval);
      
      // Find stores with failed syncs that can be retried
      const failedSyncs = this.syncQueue.filter(sync => 
        sync.retryCount < sync.maxRetries &&
        sync.scheduledAt < cutoffTime
      );

      for (const sync of failedSyncs) {
        try {
          const lastStatus = await this.getSyncStatus(sync.storeId);
          
          if (lastStatus.status === 'error') {
            // Increment retry count
            sync.retryCount++;
            sync.scheduledAt = new Date();
            
            console.log(`🔄 Retrying failed sync for store ${sync.storeId} (attempt ${sync.retryCount}/${sync.maxRetries})`);
          }
        } catch (error) {
          console.warn(`⚠️  Failed to check retry status for store ${sync.storeId}:`, error);
        }
      }

      // Remove syncs that have exceeded max retries
      this.syncQueue = this.syncQueue.filter(sync => sync.retryCount < sync.maxRetries);

    } catch (error) {
      console.error('❌ Failed to retry failed syncs:', error);
    }
  }

  /**
   * Processes the sync queue
   */
  private async processQueue(): Promise<void> {
    if (!this.isRunning || this.syncQueue.length === 0) {
      return;
    }

    const activeSyncs = this.syncEngine.getActiveSyncs();
    const availableSlots = this.config.maxConcurrentSyncs - activeSyncs.length;

    if (availableSlots <= 0) {
      return;
    }

    // Sort queue by priority and scheduled time
    this.sortQueue();

    // Process up to available slots
    const syncsToProcess = this.syncQueue.splice(0, availableSlots);

    for (const sync of syncsToProcess) {
      try {
        console.log(`🚀 Starting queued ${sync.type} sync for store ${sync.storeId}`);
        
        // Start sync in background
        this.syncEngine.syncStoreProducts(sync.storeId, sync.type).catch(error => {
          console.error(`❌ Queued sync failed for store ${sync.storeId}:`, error);
        });

      } catch (error) {
        console.error(`❌ Failed to start queued sync for store ${sync.storeId}:`, error);
      }
    }

    // Schedule next queue processing
    if (this.syncQueue.length > 0) {
      setTimeout(() => this.processQueue(), 5000); // Check again in 5 seconds
    }
  }

  /**
   * Sorts the sync queue by priority and scheduled time
   */
  private sortQueue(): void {
    const priorityOrder = { high: 3, normal: 2, low: 1 };
    
    this.syncQueue.sort((a, b) => {
      // First by priority
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by scheduled time (earlier first)
      return a.scheduledAt.getTime() - b.scheduledAt.getTime();
    });
  }

  /**
   * Calculates next periodic sync time
   */
  private calculateNextPeriodicSync(lastSyncAt?: Date): Date {
    const baseTime = lastSyncAt || new Date();
    return new Date(baseTime.getTime() + this.config.periodicSyncInterval);
  }

  /**
   * Gets scheduler status
   */
  getSchedulerStatus(): {
    isRunning: boolean;
    queueLength: number;
    activeSyncs: number;
    config: SyncScheduleConfig;
  } {
    return {
      isRunning: this.isRunning,
      queueLength: this.syncQueue.length,
      activeSyncs: this.syncEngine.getActiveSyncs().length,
      config: this.config,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates SyncSchedulerService with dependencies
 */
export function createSyncSchedulerService(
  syncEngine: CoreSyncEngine,
  connectionManager: ConnectionManagerService,
  config?: Partial<SyncScheduleConfig>
): SyncSchedulerService {
  return new SyncSchedulerService(syncEngine, connectionManager, config);
}