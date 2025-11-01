import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { InventoryService } from '@/lib/services/inventory-service';
import { z } from 'zod';

const inventoryService = new InventoryService();

// POST /api/inventory/adjustments - Create inventory adjustments
const adjustmentSchema = z.object({
  adjustments: z.array(z.object({
    productVariantId: z.string(),
    locationId: z.string(),
    quantityChange: z.number(),
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
    const { adjustments } = adjustmentSchema.parse(body);

    await inventoryService.adjustInventory(adjustments, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating inventory adjustments:', error);
    return NextResponse.json(
      { error: 'Failed to create inventory adjustments' },
      { status: 500 }
    );
  }
}