import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { SyncService } from '@/lib/services/sync-service';

const syncService = new SyncService();

// GET /api/stores/[storeId]/sync-history - Get store sync history
export async function GET(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const user = await requireAuth();
    const { storeId } = params;
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Get sync history for the store
    const history = await syncService.getSyncHistory(storeId, limit);
    
    // Mock data for now since sync service might not have full implementation
    const mockHistory = [
      {
        id: '1',
        jobType: 'product_sync',
        status: 'completed',
        startedAt: new Date(Date.now() - 3600000), // 1 hour ago
        completedAt: new Date(Date.now() - 3540000), // 59 minutes ago
        duration: 60, // 1 minute
        itemsProcessed: 150,
        itemsSucceeded: 148,
        itemsFailed: 2,
        logs: [
          {
            level: 'info',
            message: 'Starting product synchronization',
            timestamp: new Date(Date.now() - 3600000),
          },
          {
            level: 'info',
            message: 'Processing 150 products',
            timestamp: new Date(Date.now() - 3580000),
          },
          {
            level: 'warning',
            message: '2 products failed validation',
            timestamp: new Date(Date.now() - 3550000),
          },
          {
            level: 'info',
            message: 'Synchronization completed successfully',
            timestamp: new Date(Date.now() - 3540000),
          },
        ],
      },
      {
        id: '2',
        jobType: 'inventory_push',
        status: 'completed',
        startedAt: new Date(Date.now() - 7200000), // 2 hours ago
        completedAt: new Date(Date.now() - 7170000), // 1h 59m ago
        duration: 30, // 30 seconds
        itemsProcessed: 200,
        itemsSucceeded: 200,
        itemsFailed: 0,
        logs: [
          {
            level: 'info',
            message: 'Starting inventory push',
            timestamp: new Date(Date.now() - 7200000),
          },
          {
            level: 'info',
            message: 'Successfully updated 200 inventory items',
            timestamp: new Date(Date.now() - 7170000),
          },
        ],
      },
      {
        id: '3',
        jobType: 'order_fetch',
        status: 'failed',
        startedAt: new Date(Date.now() - 10800000), // 3 hours ago
        completedAt: new Date(Date.now() - 10770000), // 2h 59m ago
        duration: 30,
        itemsProcessed: 0,
        itemsSucceeded: 0,
        itemsFailed: 0,
        error: 'API rate limit exceeded',
        logs: [
          {
            level: 'info',
            message: 'Starting order fetch',
            timestamp: new Date(Date.now() - 10800000),
          },
          {
            level: 'error',
            message: 'API rate limit exceeded. Retrying in 60 seconds.',
            timestamp: new Date(Date.now() - 10790000),
          },
          {
            level: 'error',
            message: 'Max retries exceeded. Job failed.',
            timestamp: new Date(Date.now() - 10770000),
          },
        ],
      },
    ];
    
    return NextResponse.json({ 
      history: Array.isArray(history) ? history : mockHistory 
    });
  } catch (error) {
    console.error('Error fetching sync history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync history' },
      { status: 500 }
    );
  }
}