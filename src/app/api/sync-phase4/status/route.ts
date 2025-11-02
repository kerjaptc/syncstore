import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Import from start route
import { syncOperations } from '../start/route';

/**
 * GET /api/sync-phase4/status?sync_id=xxx - Get sync status
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { userId, orgId } = await auth();
    
    if (!userId || !orgId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const syncId = searchParams.get('sync_id');

    if (!syncId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_PARAMETER',
            message: 'sync_id parameter is required',
          },
        },
        { status: 400 }
      );
    }

    const operation = syncOperations.get(syncId);

    if (!operation) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Sync operation ${syncId} not found`,
          },
        },
        { status: 404 }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[INFO] GET /api/sync-phase4/status - Sync ${syncId} status: ${operation.status} (${duration}ms)`);

    return NextResponse.json({
      success: true,
      data: {
        syncId: operation.id,
        status: operation.status,
        progress: operation.progress,
        startTime: operation.startTime.toISOString(),
        endTime: operation.endTime?.toISOString() || null,
        error: operation.error || null,
      },
      meta: {
        timestamp: new Date().toISOString(),
        executionTimeMs: duration,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ERROR] GET /api/sync-phase4/status FAILED (${duration}ms):`, error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get sync status',
        },
        meta: {
          timestamp: new Date().toISOString(),
          executionTimeMs: duration,
        },
      },
      { status: 500 }
    );
  }
}
