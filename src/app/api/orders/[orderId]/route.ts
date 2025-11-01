import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { OrderService } from '@/lib/services/order-service';
import { OrderStatus, FinancialStatus, FulfillmentStatus } from '@/types';

const orderService = new OrderService();

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const user = await requireAuth();
    const { orderId } = params;

    const order = await orderService.getOrderWithItems(orderId, user.organizationId);

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
    console.error('Error fetching order:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_ORDER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch order',
        },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const user = await requireAuth();
    const { orderId } = params;
    const body = await request.json();

    const { status, financialStatus, fulfillmentStatus } = body;

    const order = await orderService.updateOrderStatus(
      orderId,
      user.organizationId,
      status,
      financialStatus,
      fulfillmentStatus
    );

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
    console.error('Error updating order:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UPDATE_ORDER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update order',
        },
      },
      { status: 500 }
    );
  }
}