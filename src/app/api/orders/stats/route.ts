import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { OrderService } from '@/lib/services/order-service';

const orderService = new OrderService();

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const storeId = searchParams.get('storeId') || undefined;
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

    const stats = await orderService.getOrderStats(user.organizationId, {
      storeId,
      startDate,
      endDate,
    });

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching order stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_STATS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch order statistics',
        },
      },
      { status: 500 }
    );
  }
}