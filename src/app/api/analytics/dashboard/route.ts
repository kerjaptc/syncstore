/**
 * Dashboard Analytics API Route
 * Provides dashboard metrics and real-time analytics data
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { analyticsService } from '@/lib/services/analytics-service';
import { analyticsCacheLayer } from '@/lib/analytics/cache-layer';
import { realTimeAnalyticsUpdater } from '@/lib/analytics/real-time-updates';
import { z } from 'zod';

const querySchema = z.object({
  includeRealTime: z.string().optional().transform(val => val === 'true'),
  refresh: z.string().optional().transform(val => val === 'true'),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    
    const { includeRealTime, refresh } = querySchema.parse({
      includeRealTime: searchParams.get('includeRealTime'),
      refresh: searchParams.get('refresh'),
    });

    // Force refresh cache if requested
    if (refresh) {
      await analyticsCacheLayer.invalidateOrganizationCache(user.organizationId);
    }

    // Get dashboard metrics
    const dashboardMetrics = await analyticsCacheLayer.getDashboardMetrics(user.organizationId);

    // Get real-time metrics if requested
    let realTimeMetrics = null;
    if (includeRealTime) {
      realTimeMetrics = await realTimeAnalyticsUpdater.getRealTimeMetrics(user.organizationId);
    }

    return NextResponse.json({
      success: true,
      data: {
        dashboard: dashboardMetrics,
        realTime: realTimeMetrics,
        lastUpdated: new Date(),
      },
    });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard analytics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    // Preload common analytics queries for better performance
    await analyticsCacheLayer.preloadCommonQueries(user.organizationId);

    return NextResponse.json({
      success: true,
      message: 'Analytics preloading initiated',
    });
  } catch (error) {
    console.error('Analytics preload error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to preload analytics' },
      { status: 500 }
    );
  }
}