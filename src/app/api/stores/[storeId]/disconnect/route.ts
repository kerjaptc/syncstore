import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { StoreService } from '@/lib/services/store-service';

const storeService = new StoreService();

// POST /api/stores/[storeId]/disconnect - Disconnect store
export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const user = await requireAuth();
    const { storeId } = params;
    
    await storeService.disconnectStore(storeId, user.organizationId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting store:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect store' },
      { status: 500 }
    );
  }
}