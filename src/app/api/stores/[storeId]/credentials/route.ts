import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { StoreService } from '@/lib/services/store-service';
import { z } from 'zod';

const storeService = new StoreService();

// PUT /api/stores/[storeId]/credentials - Update store credentials
const updateCredentialsSchema = z.object({
  credentials: z.record(z.any()),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const user = await requireAuth();
    const { storeId } = params;
    const body = await request.json();
    
    const { credentials } = updateCredentialsSchema.parse(body);
    
    await storeService.updateStoreCredentials(
      storeId, 
      user.organizationId, 
      credentials
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating store credentials:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update store credentials' },
      { status: 500 }
    );
  }
}