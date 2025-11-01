/**
 * Queue Statistics API Endpoint
 * Task 5.4: Log all sync operations to database
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { JobStatusService } from '@/lib/queue/jobStatus';

// GET /api/sync/queue/stats - Get queue statistics
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Get queue statistics
    const stats = await JobStatusService.getQueueStatistics();

    return NextResponse.json({
      success: true,
      data: {
        queue_stats: stats,
        organization_id: user.organizationId,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Queue stats error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'STATS_FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch queue statistics',
        },
      },
      { status: 500 }
    );
  }
}