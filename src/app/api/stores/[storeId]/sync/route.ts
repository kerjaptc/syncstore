import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { SyncService } from '@/lib/services/sync-service';
import { z } from 'zod';

const syncService = new SyncService();

// POST /api/stores/[storeId]/sync - Trigger manual sync
const triggerSyncSchema = z.object({
  type: z.enum(['products', 'inventory', 'orders']),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const user = await requireAuth();
    const { storeId } = params;
    const body = await request.json();
    
    const { type } = triggerSyncSchema.parse(body);
    
    let syncJob;
    
    switch (type) {
      case 'products':
        syncJob = await syncService.syncProducts(storeId);
        break;
      case 'inventory':
        syncJob = await syncService.syncInventory(storeId);
        break;
      case 'orders':
        syncJob = await syncService.syncOrders(storeId);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid sync type' },
          { status: 400 }
        );
    }
    
    return NextResponse.json({ 
      success: true,
      job: syncJob 
    });
  } catch (error) {
    console.error('Error triggering sync:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to trigger sync' },
      { status: 500 }
    );
  }
}