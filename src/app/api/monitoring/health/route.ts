/**
 * System Health Monitoring API
 * Provides endpoints for system health checks and uptime monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { systemHealth } from '@/lib/monitoring/system-health';
import { backupSystem } from '@/lib/monitoring/backup-system';
import { getLogger } from '@/lib/error-handling';

const logger = getLogger('health-api');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const hours = parseInt(searchParams.get('hours') || '24');

    // Health check endpoint is public for monitoring services
    if (type === 'check') {
      const health = await systemHealth.performHealthCheck();
      const statusCode = health.overall === 'healthy' ? 200 : 
                        health.overall === 'degraded' ? 200 : 503;
      
      return NextResponse.json(health, { status: statusCode });
    }

    // Other endpoints require authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    switch (type) {
      case 'uptime':
        const uptimeStats = systemHealth.getUptimeStats(hours);
        return NextResponse.json({ uptime: uptimeStats });

      case 'backups':
        const backupStats = backupSystem.getBackupStats();
        const backupRecords = backupSystem.getBackupRecords(undefined, 20);
        
        return NextResponse.json({
          stats: backupStats,
          records: backupRecords,
        });

      case 'full':
        // Comprehensive health and monitoring data
        const fullHealth = await systemHealth.performHealthCheck();
        const fullUptimeStats = systemHealth.getUptimeStats(hours);
        const fullBackupStats = backupSystem.getBackupStats();
        
        return NextResponse.json({
          health: fullHealth,
          uptime: fullUptimeStats,
          backups: fullBackupStats,
        });

      default:
        return NextResponse.json(
          { error: 'Invalid type parameter. Use: check, uptime, backups, or full' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Health API error', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, backupConfig, backupId, recoveryPlanId } = body;

    switch (action) {
      case 'create_backup':
        if (!backupConfig) {
          return NextResponse.json(
            { error: 'Backup configuration is required' },
            { status: 400 }
          );
        }
        
        const backupRecord = await backupSystem.createBackup(backupConfig, true);
        return NextResponse.json({ backup: backupRecord });

      case 'restore_backup':
        if (!backupId) {
          return NextResponse.json(
            { error: 'Backup ID is required' },
            { status: 400 }
          );
        }
        
        await backupSystem.restoreFromBackup(backupId, recoveryPlanId);
        return NextResponse.json({ success: true });

      case 'test_backup':
        if (!backupId) {
          return NextResponse.json(
            { error: 'Backup ID is required' },
            { status: 400 }
          );
        }
        
        const integrityTest = await backupSystem.testBackupIntegrity(backupId);
        return NextResponse.json({ integrity: integrityTest });

      case 'force_health_check':
        const health = await systemHealth.performHealthCheck();
        return NextResponse.json({ health });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Health API POST error', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}