import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { StoreService } from '@/lib/services/store-service';
import { z } from 'zod';

const storeService = new StoreService();

// POST /api/stores/test-connection - Test store connection
const testConnectionSchema = z.object({
  platformName: z.string(),
  credentials: z.record(z.any()),
});

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    
    const { platformName, credentials } = testConnectionSchema.parse(body);
    
    const result = await storeService.testConnection(platformName, credentials);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error testing connection:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to test connection' 
      },
      { status: 500 }
    );
  }
}