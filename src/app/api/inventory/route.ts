import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { InventoryService } from '@/lib/services/inventory-service';
import { InventoryTransactionType } from '@/types';
import { z } from 'zod';

const inventoryService = new InventoryService();

// GET /api/inventory - Get inventory overview
export async function GET(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('locationId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || undefined;
    const lowStockOnly = searchParams.get('lowStockOnly') === 'true';

    if (locationId) {
      // Get inventory for specific location
      const result = await inventoryService.getLocationInventory(
        locationId,
        orgId,
        { page, limit, search, lowStockOnly }
      );
      return NextResponse.json(result);
    } else {
      // Get inventory summary
      const summary = await inventoryService.getInventorySummary(orgId);
      return NextResponse.json(summary);
    }
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    );
  }
}

// POST /api/inventory - Bulk inventory operations
const bulkUpdateSchema = z.object({
  updates: z.array(z.object({
    productVariantId: z.string(),
    locationId: z.string(),
    quantityChange: z.number(),
    transactionType: z.enum(['adjustment', 'sale', 'purchase', 'transfer', 'reservation']),
    notes: z.string().optional(),
  })),
});

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { updates } = bulkUpdateSchema.parse(body);

    await inventoryService.bulkUpdateStock(updates, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating inventory:', error);
    return NextResponse.json(
      { error: 'Failed to update inventory' },
      { status: 500 }
    );
  }
}