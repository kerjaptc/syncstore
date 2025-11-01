import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { PaymentService } from '@/lib/services/payment-service';
import { CheckoutService } from '@/lib/services/checkout-service';
import { env } from '@/env';

const paymentService = new PaymentService();
const checkoutService = new CheckoutService();

/**
 * Handle Stripe webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('Missing Stripe signature');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    if (!env.STRIPE_WEBHOOK_SECRET) {
      console.error('Missing Stripe webhook secret');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Verify webhook signature
    const event = paymentService.verifyWebhookSignature(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );

    console.log(`Received Stripe webhook: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as any);
        break;
      
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as any);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as any);
        break;
      
      case 'invoice.payment_succeeded':
        // Handle subscription payments if needed
        console.log('Invoice payment succeeded:', event.data.object);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    );
  }
}

/**
 * Handle successful checkout session completion
 */
async function handleCheckoutSessionCompleted(session: any) {
  try {
    console.log('Processing checkout session completion:', session.id);

    const orderId = session.metadata?.orderId;
    if (!orderId) {
      // Create new order from session data
      const lineItems = await paymentService.stripe.checkout.sessions.listLineItems(session.id);
      
      // TODO: Create order from session data
      console.log('Creating order from session:', session.id);
      console.log('Line items:', lineItems.data);
    } else {
      // Update existing order
      await checkoutService.processOrder(orderId, {
        method: 'stripe',
        sessionId: session.id,
        paymentIntentId: session.payment_intent as string,
        status: 'succeeded',
      });
    }

    console.log('Checkout session processed successfully');
  } catch (error) {
    console.error('Error processing checkout session:', error);
    throw error;
  }
}

/**
 * Handle successful payment intent
 */
async function handlePaymentIntentSucceeded(paymentIntent: any) {
  try {
    console.log('Processing payment intent success:', paymentIntent.id);

    const orderId = paymentIntent.metadata?.orderId;
    if (orderId) {
      await checkoutService.processOrder(orderId, {
        method: 'stripe',
        paymentIntentId: paymentIntent.id,
        status: 'succeeded',
      });
    }

    console.log('Payment intent processed successfully');
  } catch (error) {
    console.error('Error processing payment intent:', error);
    throw error;
  }
}

/**
 * Handle failed payment intent
 */
async function handlePaymentIntentFailed(paymentIntent: any) {
  try {
    console.log('Processing payment intent failure:', paymentIntent.id);

    const orderId = paymentIntent.metadata?.orderId;
    if (orderId) {
      await checkoutService.cancelOrder(
        orderId,
        `Payment failed: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`
      );
    }

    console.log('Payment intent failure processed');
  } catch (error) {
    console.error('Error processing payment intent failure:', error);
    throw error;
  }
}