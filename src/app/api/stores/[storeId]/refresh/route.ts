import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { StoreService } from '@/lib/services/store-service';

const storeService = new StoreService();

// POST /api/stores/[storeId]/refresh - Refresh store credentials
export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const user = await requireAuth();
    const { storeId } = params;
    
    // Get current store
    const store = await storeService.getStoreWithRelations(storeId);
    
    if (!store || store.organizationId !== user.organizationId) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }
    
    // Get current credentials
    const credentials = await storeService.getStoreCredentials(
      storeId, 
      user.organizationId
    );
    
    if (!credentials) {
      return NextResponse.json(
        { error: 'Store credentials not found' },
        { status: 404 }
      );
    }
    
    // TODO: Implement actual credential refresh logic using platform adapters
    // For now, we'll just test the connection and update the last sync time
    const testResult = await storeService.testConnection(
      store.platform.name, 
      credentials
    );
    
    if (!testResult.success) {
      return NextResponse.json(
        { error: 'Failed to refresh credentials: ' + testResult.error },
        { status: 400 }
      );
    }
    
    // Update sync status to indicate successful refresh
    await storeService.updateSyncStatus(storeId, 'active', new Date());
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error refreshing store credentials:', error);
    return NextResponse.json(
      { error: 'Failed to refresh store credentials' },
      { status: 500 }
    );
  }
}