import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { OrderService } from '@/lib/services/order-service';
import { OrderStatus, FinancialStatus, FulfillmentStatus } from '@/types';
import { z } from 'zod';
import { rateLimiters } from '@/lib/middleware/rate-limit';

const orderService = new OrderService();

// Validation schemas
const createOrderSchema = z.object({
  storeId: z.string().uuid('Store ID must be a valid UUID'),
  platformOrderId: z.string().min(1, 'Platform order ID is required'),
  orderNumber: z.string().optional(),
  customerInfo: z.object({
    name: z.string().min(1, 'Customer name is required'),
    email: z.string().email('Valid email is required'),
    phone: z.string().optional(),
    address: z.any(), // Can be more specific based on your address structure
  }),
  status: z.enum(['pending', 'paid', 'shipped', 'delivered', 'cancelled']),
  financialStatus: z.enum(['pending', 'paid', 'refunded']).optional(),
  fulfillmentStatus: z.enum(['unfulfilled', 'partial', 'fulfilled']).optional(),
  subtotal: z.number().min(0, 'Subtotal must be non-negative'),
  taxAmount: z.number().min(0, 'Tax amount must be non-negative').default(0),
  shippingAmount: z.number().min(0, 'Shipping amount must be non-negative').default(0),
  discountAmount: z.number().min(0, 'Discount amount must be non-negative').default(0),
  totalAmount: z.number().min(0, 'Total amount must be non-negative'),
  currency: z.string().length(3, 'Currency must be 3 characters').default('IDR'),
  platformData: z.record(z.any()).default({}),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  orderedAt: z.string().datetime('Invalid date format').transform(str => new Date(str)),
  items: z.array(z.object({
    productVariantId: z.string().uuid().optional(),
    platformProductId: z.string().optional(),
    platformVariantId: z.string().optional(),
    name: z.string().min(1, 'Item name is required'),
    sku: z.string().optional(),
    quantity: z.number().int().min(1, 'Quantity must be at least 1'),
    price: z.number().min(0, 'Price must be non-negative'),
    totalAmount: z.number().min(0, 'Total amount must be non-negative'),
  })).min(1, 'At least one item is required'),
});

const getOrdersSchema = z.object({
  search: z.string().optional(),
  storeId: z.string().uuid().optional(),
  status: z.enum(['pending', 'paid', 'shipped', 'delivered', 'cancelled']).optional(),
  financialStatus: z.enum(['pending', 'paid', 'refunded']).optional(),
  fulfillmentStatus: z.enum(['unfulfilled', 'partial', 'fulfilled']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['orderedAt', 'totalAmount', 'createdAt', 'updatedAt']).default('orderedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await rateLimiters.api(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    // Convert search params to object for validation
    const queryParams = Object.fromEntries(searchParams.entries());
    
    // Validate query parameters
    const validatedParams = getOrdersSchema.parse(queryParams);

    const result = await orderService.searchOrders(user.organizationId, {
      search: validatedParams.search,
      storeId: validatedParams.storeId,
      status: validatedParams.status,
      financialStatus: validatedParams.financialStatus,
      fulfillmentStatus: validatedParams.fulfillmentStatus,
      startDate: validatedParams.startDate ? new Date(validatedParams.startDate) : undefined,
      endDate: validatedParams.endDate ? new Date(validatedParams.endDate) : undefined,
      page: validatedParams.page,
      limit: validatedParams.limit,
      sortBy: validatedParams.sortBy,
      sortOrder: validatedParams.sortOrder,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: error.errors,
          },
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_ORDERS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch orders',
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await rateLimiters.api(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const user = await requireAuth();
    const body = await request.json();

    // Validate request body
    const validatedData = createOrderSchema.parse(body);

    const order = await orderService.createOrder({
      organizationId: user.organizationId,
      ...validatedData,
    });

    return NextResponse.json({
      success: true,
      data: order,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CREATE_ORDER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create order',
        },
      },
      { status: 500 }
    );
  }
}