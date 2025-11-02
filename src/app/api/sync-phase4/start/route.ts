import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';

// In-memory storage for sync operations (for Phase 4 demo)
// In production, this should be in Redis or database
const syncOperations = new Map<string, SyncOperation>();

interface SyncOperation {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
  };
  productIds: string[];
  platforms: string[];
  logs: SyncLogEntry[];
  startTime: Date;
  endTime?: Date;
  error?: string;
}

interface SyncLogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  productId?: string;
  message: string;
  details?: any;
}

const startSyncSchema = z.object({
  productIds: z.array(z.string()).min(1, 'At least one product ID required'),
  platforms: z.array(z.string()).min(1, 'At least one platform required'),
});

/**
 * POST /api/sync-phase4/start - Start sync operation
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
    const { productIds, platforms } = startSyncSchema.parse(body);

    // Generate unique sync_id
    const syncId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create sync operation
    const operation: SyncOperation = {
      id: syncId,
      status: 'queued',
      progress: {
        total: productIds.length,
        completed: 0,
        failed: 0,
        percentage: 0,
      },
      productIds,
      platforms,
      logs: [
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Sync operation ${syncId} created`,
          details: { productCount: productIds.length, platforms },
        },
      ],
      startTime: new Date(),
    };

    syncOperations.set(syncId, operation);

    // Start async sync process (simulated)
    processSyncOperation(syncId).catch(error => {
      console.error(`[ERROR] Sync operation ${syncId} failed:`, error);
    });

    const duration = Date.now() - startTime;
    console.log(`[INFO] POST /api/sync-phase4/start - Sync ${syncId} created in ${duration}ms`);

    return NextResponse.json({
      success: true,
      data: {
        syncId,
        status: operation.status,
        progress: operation.progress,
      },
      meta: {
        timestamp: new Date().toISOString(),
        executionTimeMs: duration,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ERROR] POST /api/sync-phase4/start FAILED (${duration}ms):`, error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to start sync',
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

/**
 * Process sync operation asynchronously (simulated)
 */
async function processSyncOperation(syncId: string): Promise<void> {
  const operation = syncOperations.get(syncId);
  if (!operation) return;

  // Update status to running
  operation.status = 'running';
  operation.logs.push({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Sync operation started',
  });

  // Simulate sync process
  for (let i = 0; i < operation.productIds.length; i++) {
    const productId = operation.productIds[i];
    
    // Check if cancelled
    const currentOperation = syncOperations.get(syncId);
    if (currentOperation && currentOperation.status === 'cancelled') {
      currentOperation.logs.push({
        timestamp: new Date().toISOString(),
        level: 'warning',
        message: 'Sync operation cancelled by user',
      });
      return;
    }

    // Simulate sync delay (500ms per product)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate random success/failure (90% success rate)
    const success = Math.random() > 0.1;

    if (success) {
      operation.progress.completed++;
      operation.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        productId,
        message: `Product ${productId} synced successfully`,
        details: { platforms: operation.platforms },
      });
    } else {
      operation.progress.failed++;
      operation.logs.push({
        timestamp: new Date().toISOString(),
        level: 'error',
        productId,
        message: `Product ${productId} sync failed`,
        details: { error: 'Simulated error for testing' },
      });
    }

    // Update percentage
    operation.progress.percentage = Math.round(
      ((operation.progress.completed + operation.progress.failed) / operation.progress.total) * 100
    );
  }

  // Complete operation
  operation.status = operation.progress.failed > 0 ? 'failed' : 'completed';
  operation.endTime = new Date();
  operation.logs.push({
    timestamp: new Date().toISOString(),
    level: operation.status === 'completed' ? 'info' : 'warning',
    message: `Sync operation ${operation.status}`,
    details: {
      total: operation.progress.total,
      completed: operation.progress.completed,
      failed: operation.progress.failed,
      duration: operation.endTime.getTime() - operation.startTime.getTime(),
    },
  });

  console.log(`[INFO] Sync operation ${syncId} ${operation.status}`);

  // Set timeout to clean up after 5 minutes
  setTimeout(() => {
    syncOperations.delete(syncId);
    console.log(`[INFO] Sync operation ${syncId} cleaned up`);
  }, 5 * 60 * 1000);
}

// Export for use in other endpoints
export { syncOperations, type SyncOperation, type SyncLogEntry };
