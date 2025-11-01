import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { InventoryService } from '@/lib/services/inventory-service';
import { InventoryTransactionType } from '@/types';

const inventoryService = new InventoryService();

// GET /api/inventory/history - Get stock movement history
export async function GET(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productVariantId = searchParams.get('productVariantId');
    const locationId = searchParams.get('locationId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const transactionType = searchParams.get('transactionType') as InventoryTransactionType;
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

    if (!productVariantId) {
      return NextResponse.json({ error: 'Product variant ID is required' }, { status: 400 });
    }

    const history = await inventoryService.getStockHistory(
      productVariantId,
      locationId || undefined,
      {
        page,
        limit,
        transactionType,
        startDate,
        endDate,
      }
    );

    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching stock history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock history' },
      { status: 500 }
    );
  }
}