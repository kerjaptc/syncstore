/**
 * System Health Monitor
 * Monitors system health, uptime, and provides comprehensive health checks
 */

import { getLogger } from '@/lib/error-handling';
import { performanceMonitor } from './performance-monitor';
import { databaseMonitor } from './database-monitor';
import { cacheMonitor } from './cache-monitor';
import { db } from '@/lib/db';

const logger = getLogger('system-health');

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  message?: string;
  details?: Record<string, any>;
  lastChecked: Date;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: Date;
  checks: Record<string, HealthCheck>;
  metrics: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
    database: {
      connectionCount: number;
      slowQueries: number;
      averageQueryTime: number;
    };
    cache: {
      hitRate: number;
      totalSize: number;
      entryCount: number;
    };
    requests: {
      total: number;
      successful: number;
      failed: number;
      averageResponseTime: number;
    };
  };
}

export interface UptimeRecord {
  timestamp: Date;
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  error?: string;
}

class SystemHealthMonitor {
  private startTime = Date.now();
  private healthChecks = new Map<string, HealthCheck>();
  private uptimeRecords: UptimeRecord[] = [];
  private maxUptimeRecords = 1440; // 24 hours of minute-by-minute records

  constructor() {
    this.registerDefaultHealthChecks();
    this.startUptimeTracking();
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<SystemHealth> {
    const startTime = performance.now();
    const checks: Record<string, HealthCheck> = {};

    // Run all health checks in parallel
    const checkPromises = Array.from(this.healthChecks.keys()).map(async (checkName) => {
      const check = await this.runHealthCheck(checkName);
      checks[check.name] = check;
    });

    await Promise.all(checkPromises);

    // Collect system metrics
    const systemMetrics = performanceMonitor.collectSystemMetrics();
    const dbStats = databaseMonitor.getDatabaseStats();
    const cacheMetrics = cacheMonitor.getAllMetrics();

    // Calculate overall cache metrics
    const totalCacheHitRate = Object.values(cacheMetrics).reduce((sum, cache) => sum + cache.hitRate, 0) / Object.keys(cacheMetrics).length || 0;
    const totalCacheSize = Object.values(cacheMetrics).reduce((sum, cache) => sum + cache.totalSize, 0);
    const totalCacheEntries = Object.values(cacheMetrics).reduce((sum, cache) => sum + cache.entryCount, 0);

    // Determine overall health status
    const healthStatuses = Object.values(checks).map(check => check.status);
    const unhealthyCount = healthStatuses.filter(status => status === 'unhealthy').length;
    const degradedCount = healthStatuses.filter(status => status === 'degraded').length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const health: SystemHealth = {
      overall: overallStatus,
      uptime: Date.now() - this.startTime,
      timestamp: new Date(),
      checks,
      metrics: {
        memory: systemMetrics.memory,
        cpu: systemMetrics.cpu,
        database: {
          connectionCount: 0, // This would need to be tracked separately
          slowQueries: dbStats.slowQueries,
          averageQueryTime: dbStats.averageQueryTime,
        },
        cache: {
          hitRate: Math.round(totalCacheHitRate * 100) / 100,
          totalSize: totalCacheSize,
          entryCount: totalCacheEntries,
        },
        requests: systemMetrics.requests,
      },
    };

    // Record uptime
    this.recordUptime(overallStatus, performance.now() - startTime);

    logger.info('Health check completed', {
      overall: overallStatus,
      responseTime: Math.round(performance.now() - startTime),
      checksCount: Object.keys(checks).length,
    });

    return health;
  }

  /**
   * Get uptime statistics
   */
  getUptimeStats(hours: number = 24): {
    uptime: number;
    downtime: number;
    availability: number;
    incidents: number;
    averageResponseTime: number;
    records: UptimeRecord[];
  } {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    const recentRecords = this.uptimeRecords.filter(record => record.timestamp.getTime() > cutoff);

    const totalRecords = recentRecords.length;
    const upRecords = recentRecords.filter(record => record.status === 'up').length;
    const downRecords = recentRecords.filter(record => record.status === 'down').length;
    const degradedRecords = recentRecords.filter(record => record.status === 'degraded').length;

    const availability = totalRecords > 0 ? (upRecords / totalRecords) * 100 : 100;
    const incidents = this.countIncidents(recentRecords);

    const responseTimes = recentRecords
      .filter(record => record.responseTime !== undefined)
      .map(record => record.responseTime!);
    
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    return {
      uptime: upRecords,
      downtime: downRecords + degradedRecords,
      availability: Math.round(availability * 100) / 100,
      incidents,
      averageResponseTime: Math.round(averageResponseTime),
      records: recentRecords.slice(-100), // Return last 100 records
    };
  }

  /**
   * Register a custom health check
   */
  registerHealthCheck(name: string, checkFn: () => Promise<Omit<HealthCheck, 'name' | 'lastChecked'>>): void {
    this.healthChecks.set(name, {
      name,
      status: 'healthy',
      responseTime: 0,
      lastChecked: new Date(),
    });

    // Store the check function for later execution
    (this as any)[`check_${name}`] = checkFn;

    logger.info('Health check registered', { name });
  }

  /**
   * Run a specific health check
   */
  private async runHealthCheck(checkName: string): Promise<HealthCheck> {
    const startTime = performance.now();
    
    try {
      const checkFn = (this as any)[`check_${checkName}`];
      if (!checkFn) {
        throw new Error(`Health check function not found: ${checkName}`);
      }

      const result = await checkFn();
      const responseTime = performance.now() - startTime;

      const check: HealthCheck = {
        name: checkName,
        status: result.status,
        responseTime: Math.round(responseTime),
        message: result.message,
        details: result.details,
        lastChecked: new Date(),
      };

      this.healthChecks.set(checkName, check);
      return check;
    } catch (error) {
      const responseTime = performance.now() - startTime;
      const check: HealthCheck = {
        name: checkName,
        status: 'unhealthy',
        responseTime: Math.round(responseTime),
        message: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date(),
      };

      this.healthChecks.set(checkName, check);
      logger.error('Health check failed', error instanceof Error ? error : undefined, { checkName });
      return check;
    }
  }

  /**
   * Register default health checks
   */
  private registerDefaultHealthChecks(): void {
    // Database health check
    this.registerHealthCheck('database', async () => {
      const startTime = performance.now();
      
      try {
        await db.execute('SELECT 1');
        const responseTime = performance.now() - startTime;
        
        return {
          status: responseTime < 1000 ? 'healthy' : 'degraded',
          responseTime: Math.round(responseTime),
          message: responseTime < 1000 ? 'Database connection healthy' : 'Database response slow',
          details: { responseTime: Math.round(responseTime) },
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          responseTime: Math.round(performance.now() - startTime),
          message: 'Database connection failed',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        };
      }
    });

    // Memory health check
    this.registerHealthCheck('memory', async () => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const percentage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

      let status: 'healthy' | 'degraded' | 'unhealthy';
      let message: string;

      if (percentage < 70) {
        status = 'healthy';
        message = 'Memory usage normal';
      } else if (percentage < 90) {
        status = 'degraded';
        message = 'Memory usage high';
      } else {
        status = 'unhealthy';
        message = 'Memory usage critical';
      }

      return {
        status,
        responseTime: 0,
        message,
        details: {
          heapUsed: heapUsedMB,
          heapTotal: heapTotalMB,
          percentage,
        },
      };
    });

    // Cache health check
    this.registerHealthCheck('cache', async () => {
      const cacheMetrics = cacheMonitor.getAllMetrics();
      const cacheNames = Object.keys(cacheMetrics);
      
      if (cacheNames.length === 0) {
        return {
          status: 'healthy',
          responseTime: 0,
          message: 'No active caches',
        };
      }

      const averageHitRate = cacheNames.reduce((sum, name) => sum + cacheMetrics[name].hitRate, 0) / cacheNames.length;
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      let message: string;

      if (averageHitRate > 80) {
        status = 'healthy';
        message = 'Cache performance excellent';
      } else if (averageHitRate > 60) {
        status = 'degraded';
        message = 'Cache performance suboptimal';
      } else {
        status = 'unhealthy';
        message = 'Cache performance poor';
      }

      return {
        status,
        responseTime: 0,
        message,
        details: {
          averageHitRate: Math.round(averageHitRate * 100) / 100,
          cacheCount: cacheNames.length,
          caches: cacheMetrics,
        },
      };
    });

    // Performance health check
    this.registerHealthCheck('performance', async () => {
      const systemMetrics = performanceMonitor.collectSystemMetrics();
      const alerts = performanceMonitor.getAlerts(false); // Get unresolved alerts

      const criticalAlerts = alerts.filter(alert => alert.severity === 'critical').length;
      const highAlerts = alerts.filter(alert => alert.severity === 'high').length;

      let status: 'healthy' | 'degraded' | 'unhealthy';
      let message: string;

      if (criticalAlerts > 0) {
        status = 'unhealthy';
        message = `${criticalAlerts} critical performance alerts`;
      } else if (highAlerts > 0) {
        status = 'degraded';
        message = `${highAlerts} high priority performance alerts`;
      } else {
        status = 'healthy';
        message = 'Performance metrics normal';
      }

      return {
        status,
        responseTime: 0,
        message,
        details: {
          averageResponseTime: systemMetrics.requests.averageResponseTime,
          totalAlerts: alerts.length,
          criticalAlerts,
          highAlerts,
        },
      };
    });
  }

  /**
   * Record uptime status
   */
  private recordUptime(status: 'healthy' | 'degraded' | 'unhealthy', responseTime: number): void {
    const uptimeStatus: UptimeRecord['status'] = status === 'healthy' ? 'up' : 
                                                 status === 'degraded' ? 'degraded' : 'down';

    const record: UptimeRecord = {
      timestamp: new Date(),
      status: uptimeStatus,
      responseTime: Math.round(responseTime),
    };

    this.uptimeRecords.push(record);

    // Keep only the most recent records
    if (this.uptimeRecords.length > this.maxUptimeRecords) {
      this.uptimeRecords = this.uptimeRecords.slice(-this.maxUptimeRecords);
    }
  }

  /**
   * Count incidents in uptime records
   */
  private countIncidents(records: UptimeRecord[]): number {
    let incidents = 0;
    let inIncident = false;

    for (const record of records) {
      if (record.status === 'down' || record.status === 'degraded') {
        if (!inIncident) {
          incidents++;
          inIncident = true;
        }
      } else {
        inIncident = false;
      }
    }

    return incidents;
  }

  /**
   * Start uptime tracking
   */
  private startUptimeTracking(): void {
    // Record uptime every minute
    setInterval(async () => {
      try {
        const health = await this.performHealthCheck();
        // Uptime is already recorded in performHealthCheck
      } catch (error) {
        this.recordUptime('unhealthy', 0);
        logger.error('Uptime tracking failed', error instanceof Error ? error : undefined);
      }
    }, 60 * 1000); // Every minute
  }
}

// Export singleton instance
export const systemHealth = new SystemHealthMonitor();