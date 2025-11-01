import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { InventoryService } from '@/lib/services/inventory-service';
import { z } from 'zod';

const inventoryService = new InventoryService();

// PUT /api/inventory/reorder-points - Update reorder points
const reorderPointsSchema = z.object({
  updates: z.array(z.object({
    inventoryItemId: z.string(),
    reorderPoint: z.number().min(0),
    reorderQuantity: z.number().min(0),
  })),
});

export async function PUT(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { updates } = reorderPointsSchema.parse(body);

    await inventoryService.updateReorderPoints(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating reorder points:', error);
    return NextResponse.json(
      { error: 'Failed to update reorder points' },
      { status: 500 }
    );
  }
}