import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { OrderService } from '@/lib/services/order-service';

const orderService = new OrderService();

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const user = await requireAuth();
    const { orderId } = params;
    const body = await request.json();

    const { reason } = body;

    const order = await orderService.cancelOrder(orderId, user.organizationId, reason);

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ORDER_NOT_FOUND',
            message: 'Order not found',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CANCEL_ORDER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to cancel order',
        },
      },
      { status: 500 }
    );
  }
}