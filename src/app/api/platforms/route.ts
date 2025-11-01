import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { StoreService } from '@/lib/services/store-service';

const storeService = new StoreService();

// GET /api/platforms - Get available platforms
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const platforms = await storeService.getAvailablePlatforms();

    return NextResponse.json({
      success: true,
      data: platforms
    });
  } catch (error) {
    console.error('Error fetching platforms:', error);

    // Check if it's an auth error
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch platforms' },
      { status: 500 }
    );
  }
}