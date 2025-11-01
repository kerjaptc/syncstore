/**
 * Health check endpoint for monitoring system status
 * Enhanced with comprehensive monitoring system
 */

import { NextRequest, NextResponse } from 'next/server';
import { systemHealth } from '@/lib/monitoring/system-health';
import { getLogger } from '@/lib/error-handling';

const logger = getLogger('health-check');

export async function GET(request: NextRequest) {
  try {
    // Use the comprehensive health monitoring system
    const health = await systemHealth.performHealthCheck();
    
    // Convert to legacy format for backward compatibility
    const legacyFormat = {
      status: health.overall,
      timestamp: health.timestamp.toISOString(),
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      uptime: health.uptime,
      checks: health.checks,
      metrics: health.metrics
    };

    const statusCode = health.overall === 'healthy' ? 200 : 
                      health.overall === 'degraded' ? 200 : 503;

    return NextResponse.json(legacyFormat, { status: statusCode });

  } catch (error) {
    logger.error('Health check failed', error instanceof Error ? error : undefined);

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}