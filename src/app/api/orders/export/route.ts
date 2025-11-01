import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { OrderService } from '@/lib/services/order-service';
import { OrderStatus, FinancialStatus, FulfillmentStatus, OrderWithItems } from '@/types';

const orderService = new OrderService();

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const {
      format = 'csv',
      filters = {},
      orderIds,
    } = body;

    let orders;

    if (orderIds && Array.isArray(orderIds)) {
      // Export specific orders
      orders = [];
      for (const orderId of orderIds) {
        const order = await orderService.getOrderWithItems(orderId, user.organizationId);
        if (order) {
          orders.push(order);
        }
      }
    } else {
      // Export filtered orders
      const result = await orderService.searchOrders(user.organizationId, {
        ...filters,
        limit: 10000, // Large limit for export
      });
      orders = result.data;
    }

    if (format === 'csv') {
      const csvData = generateCSV(orders);
      
      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="orders-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // For JSON format or other formats
    return NextResponse.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error('Error exporting orders:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'EXPORT_ERROR',
          message: error instanceof Error ? error.message : 'Failed to export orders',
        },
      },
      { status: 500 }
    );
  }
}

function generateCSV(orders: OrderWithItems[]): string {
  const headers = [
    'Order ID',
    'Order Number',
    'Platform Order ID',
    'Store',
    'Platform',
    'Customer Name',
    'Customer Email',
    'Status',
    'Financial Status',
    'Fulfillment Status',
    'Items Count',
    'Subtotal',
    'Tax Amount',
    'Shipping Amount',
    'Discount Amount',
    'Total Amount',
    'Currency',
    'Ordered At',
    'Created At',
  ];

  const rows = orders.map(order => [
    order.id,
    order.orderNumber || '',
    order.platformOrderId,
    order.store?.name || '',
    order.store?.platform?.displayName || '',
    order.customerInfo?.name || '',
    order.customerInfo?.email || '',
    order.status,
    order.financialStatus || '',
    order.fulfillmentStatus || '',
    order._count?.items || 0,
    order.subtotal,
    order.taxAmount || '0',
    order.shippingAmount || '0',
    order.discountAmount || '0',
    order.totalAmount,
    order.currency || 'IDR',
    order.orderedAt,
    order.createdAt,
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  return csvContent;
}