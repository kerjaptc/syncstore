import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { OrderService } from '@/lib/services/order-service';
import { OrderStatus, FinancialStatus, FulfillmentStatus } from '@/types';

const orderService = new OrderService();

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const { orderIds, updates } = body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ORDER_IDS',
            message: 'Order IDs must be a non-empty array',
          },
        },
        { status: 400 }
      );
    }

    const result = await orderService.bulkUpdateOrders(
      orderIds,
      user.organizationId,
      updates
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error bulk updating orders:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BULK_UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to bulk update orders',
        },
      },
      { status: 500 }
    );
  }
}