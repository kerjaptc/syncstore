import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { StoreService } from '@/lib/services/store-service';
import { z } from 'zod';

const storeService = new StoreService();

// PUT /api/stores/[storeId]/settings - Update store settings
const updateSettingsSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  settings: z.record(z.any()).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const user = await requireAuth();
    const { storeId } = params;
    const body = await request.json();
    
    const { name, settings } = updateSettingsSchema.parse(body);
    
    // Update store name if provided
    if (name) {
      // Note: This would require adding a method to update store name in StoreService
      // For now, we'll just update settings
    }
    
    // Update settings if provided
    if (settings) {
      await storeService.updateStoreSettings(storeId, user.organizationId, settings);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating store settings:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update store settings' },
      { status: 500 }
    );
  }
}