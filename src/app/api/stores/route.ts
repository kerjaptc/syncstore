import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { StoreService } from '@/lib/services/store-service';
import { z } from 'zod';

const storeService = new StoreService();

// GET /api/stores - Get organization stores
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const platformId = searchParams.get('platformId') || undefined;
    const syncStatus = (searchParams.get('syncStatus') as 'active' | 'paused' | 'error') || undefined;
    const isActive = searchParams.get('isActive') ? 
      searchParams.get('isActive') === 'true' : undefined;

    const result = await storeService.getOrganizationStores(
      user.organizationId,
      { page, limit, platformId, syncStatus, isActive }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching stores:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stores' },
      { status: 500 }
    );
  }
}

// POST /api/stores - Connect new store
const connectStoreSchema = z.object({
  platformId: z.string().uuid(),
  name: z.string().min(1).max(255),
  platformStoreId: z.string().min(1),
  credentials: z.record(z.any()),
  settings: z.record(z.any()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    
    const validatedData = connectStoreSchema.parse(body);
    
    const store = await storeService.connectStore({
      organizationId: user.organizationId,
      ...validatedData,
    });

    return NextResponse.json({ store }, { status: 201 });
  } catch (error) {
    console.error('Error connecting store:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to connect store' },
      { status: 500 }
    );
  }
}