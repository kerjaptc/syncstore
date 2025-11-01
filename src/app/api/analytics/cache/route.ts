/**
 * Analytics Cache Management API Route
 * Provides cache management and statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { analyticsCacheLayer } from '@/lib/analytics/cache-layer';
import { z } from 'zod';

const cacheActionSchema = z.object({
  action: z.enum(['clear', 'optimize', 'invalidate', 'stats']),
  pattern: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    // Get cache statistics
    const stats = analyticsCacheLayer.getCacheStats();

    return NextResponse.json({
      success: true,
      data: {
        stats,
        organizationId: user.organizationId,
      },
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get cache statistics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    // Only allow admin users to manage cache
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, pattern } = cacheActionSchema.parse(body);

    let result;

    switch (action) {
      case 'clear':
        if (pattern) {
          await analyticsCacheLayer.invalidateByPattern(pattern);
          result = `Cleared cache entries matching pattern: ${pattern}`;
        } else {
          await analyticsCacheLayer.invalidateOrganizationCache(user.organizationId);
          result = 'Cleared all organization cache';
        }
        break;

      case 'optimize':
        await analyticsCacheLayer.optimizeCache();
        result = 'Cache optimization completed';
        break;

      case 'invalidate':
        await analyticsCacheLayer.invalidateOrganizationCache(user.organizationId);
        result = 'Organization cache invalidated';
        break;

      case 'stats':
        const stats = analyticsCacheLayer.getCacheStats();
        return NextResponse.json({
          success: true,
          data: stats,
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: result,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Cache management error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to manage cache' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    // Only allow admin users to clear cache
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const pattern = searchParams.get('pattern');

    if (pattern) {
      await analyticsCacheLayer.invalidateByPattern(pattern);
    } else {
      await analyticsCacheLayer.invalidateOrganizationCache(user.organizationId);
    }

    return NextResponse.json({
      success: true,
      message: pattern 
        ? `Cache entries matching "${pattern}" have been cleared`
        : 'Organization cache has been cleared',
    });
  } catch (error) {
    console.error('Cache deletion error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}