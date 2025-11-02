import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Import from start route
import { syncOperations } from '../start/route';

/**
 * POST /api/sync-phase4/cancel - Cancel sync operation
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const syncId = body.sync_id;

    if (!syncId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_PARAMETER',
            message: 'sync_id is required',
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

    // Check if operation can be cancelled
    if (operation.status === 'completed' || operation.status === 'failed') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATE',
            message: `Cannot cancel sync operation in ${operation.status} state`,
          },
        },
        { status: 400 }
      );
    }

    if (operation.status === 'cancelled') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ALREADY_CANCELLED',
            message: 'Sync operation already cancelled',
          },
        },
        { status: 400 }
      );
    }

    // Cancel operation
    operation.status = 'cancelled';
    operation.endTime = new Date();
    operation.logs.push({
      timestamp: new Date().toISOString(),
      level: 'warning',
      message: 'Sync operation cancelled by user',
      details: {
        cancelledAt: operation.endTime.toISOString(),
        completedItems: operation.progress.completed,
        totalItems: operation.progress.total,
      },
    });

    const duration = Date.now() - startTime;
    console.log(`[INFO] POST /api/sync-phase4/cancel - Sync ${syncId} cancelled (${duration}ms)`);

    return NextResponse.json({
      success: true,
      data: {
        syncId: operation.id,
        status: operation.status,
        progress: operation.progress,
        message: 'Sync operation cancelled successfully',
      },
      meta: {
        timestamp: new Date().toISOString(),
        executionTimeMs: duration,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ERROR] POST /api/sync-phase4/cancel FAILED (${duration}ms):`, error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to cancel sync',
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
