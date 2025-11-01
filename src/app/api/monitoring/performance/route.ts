/**
 * Performance Monitoring API
 * Provides endpoints for performance metrics and monitoring data
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';
import { databaseMonitor } from '@/lib/monitoring/database-monitor';
import { cacheMonitor } from '@/lib/monitoring/cache-monitor';
import { getLogger } from '@/lib/error-handling';

const logger = getLogger('performance-api');

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '100');
    const timeRange = parseInt(searchParams.get('timeRange') || '3600000'); // 1 hour default

    switch (type) {
      case 'metrics':
        const metrics = performanceMonitor.getMetrics(undefined, limit);
        return NextResponse.json({ metrics });

      case 'system':
        const systemMetrics = performanceMonitor.collectSystemMetrics();
        return NextResponse.json({ systemMetrics });

      case 'alerts':
        const resolved = searchParams.get('resolved') === 'true';
        const alerts = performanceMonitor.getAlerts(resolved);
        return NextResponse.json({ alerts });

      case 'database':
        const dbStats = databaseMonitor.getDatabaseStats(timeRange);
        const slowQueries = databaseMonitor.getSlowQueriesByPattern(20);
        const optimizationSuggestions = databaseMonitor.getOptimizationSuggestions();
        
        return NextResponse.json({
          stats: dbStats,
          slowQueries,
          optimizationSuggestions,
        });

      case 'cache':
        const cacheMetrics = cacheMonitor.getAllMetrics();
        return NextResponse.json({ cacheMetrics });

      case 'overview':
        // Comprehensive overview
        const overview = {
          system: performanceMonitor.collectSystemMetrics(),
          database: databaseMonitor.getDatabaseStats(timeRange),
          cache: cacheMonitor.getAllMetrics(),
          alerts: performanceMonitor.getAlerts(false),
        };
        return NextResponse.json({ overview });

      default:
        return NextResponse.json(
          { error: 'Invalid type parameter. Use: metrics, system, alerts, database, cache, or overview' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Performance API error', error instanceof Error ? error : undefined);
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
    const { action, alertId } = body;

    switch (action) {
      case 'resolve_alert':
        if (!alertId) {
          return NextResponse.json(
            { error: 'Alert ID is required' },
            { status: 400 }
          );
        }
        
        performanceMonitor.resolveAlert(alertId);
        return NextResponse.json({ success: true });

      case 'clear_metrics':
        performanceMonitor.clearOldMetrics(0); // Clear all metrics
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Performance API POST error', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}