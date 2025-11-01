import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/lib/services/payment-service';
import { CheckoutService } from '@/lib/services/checkout-service';
import { z } from 'zod';

const paymentService = new PaymentService();
const checkoutService = new CheckoutService();

const createSessionSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    productId: z.string(),
    productName: z.string(),
    variantName: z.string().optional(),
    sku: z.string(),
    price: z.number(),
    quantity: z.number(),
    image: z.string().optional(),
    attributes: z.record(z.any()).optional(),
    maxQuantity: z.number().optional(),
  })),
  customer: z.object({
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string().optional(),
    address: z.object({
      street: z.string(),
      city: z.string(),
      state: z.string().optional(),
      postalCode: z.string(),
      country: z.string(),
    }),
  }),
  shippingMethod: z.enum(['standard', 'express']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

/**
 * Create Stripe checkout session for hosted checkout
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, customer, shippingMethod, successUrl, cancelUrl } = createSessionSchema.parse(body);

    // Validate cart items
    const validation = await checkoutService.validateCartItems(items);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Cart validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // Calculate shipping cost
    const shippingCost = checkoutService.calculateShippingCost(items, shippingMethod, customer.address);
    
    // Calculate totals
    const totals = checkoutService.calculateTotals(items, shippingCost);

    // Create checkout session
    const session = await paymentService.createCheckoutSession({
      items,
      customer,
      totals,
      successUrl,
      cancelUrl,
    });

    return NextResponse.json({
      sessionId: session.sessionId,
      url: session.url,
      totals,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}