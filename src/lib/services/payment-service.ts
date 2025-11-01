import Stripe from 'stripe';
import { env } from '@/env';
import type { CartItem } from '@/hooks/use-cart';
import type { CustomerInfo, OrderTotals } from './checkout-service';

/**
 * Payment intent creation input
 */
export interface CreatePaymentIntentInput {
  items: CartItem[];
  customer: CustomerInfo;
  totals: OrderTotals;
  orderId?: string;
}

/**
 * Stripe checkout session input
 */
export interface CreateCheckoutSessionInput {
  items: CartItem[];
  customer: CustomerInfo;
  totals: OrderTotals;
  successUrl: string;
  cancelUrl: string;
  orderId?: string;
}

/**
 * Payment service for handling Stripe and other payment processors
 */
export class PaymentService {
  private stripe: Stripe;

  constructor() {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }
    
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });
  }

  /**
   * Create Stripe payment intent for direct payment
   */
  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<{
    clientSecret: string;
    paymentIntentId: string;
  }> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(input.totals.total), // Stripe expects amount in smallest currency unit
        currency: 'idr',
        customer_email: input.customer.email,
        metadata: {
          orderId: input.orderId || '',
          customerName: `${input.customer.firstName} ${input.customer.lastName}`,
          itemCount: input.items.length.toString(),
        },
        description: `Order for ${input.customer.firstName} ${input.customer.lastName}`,
        shipping: {
          name: `${input.customer.firstName} ${input.customer.lastName}`,
          phone: input.customer.phone,
          address: {
            line1: input.customer.address.street,
            city: input.customer.address.city,
            state: input.customer.address.state,
            postal_code: input.customer.address.postalCode,
            country: input.customer.address.country,
          },
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw new Error('Failed to create payment intent');
    }
  }

  /**
   * Create Stripe checkout session for hosted checkout
   */
  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<{
    sessionId: string;
    url: string;
  }> {
    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: input.customer.email,
        line_items: input.items.map(item => ({
          price_data: {
            currency: 'idr',
            product_data: {
              name: item.productName + (item.variantName ? ` - ${item.variantName}` : ''),
              description: `SKU: ${item.sku}`,
              images: item.image ? [item.image] : undefined,
              metadata: {
                sku: item.sku,
                variantId: item.id,
              },
            },
            unit_amount: Math.round(item.price),
          },
          quantity: item.quantity,
        })),
        shipping_options: [
          {
            shipping_rate_data: {
              type: 'fixed_amount',
              fixed_amount: {
                amount: Math.round(input.totals.shipping),
                currency: 'idr',
              },
              display_name: 'Standard Shipping',
              delivery_estimate: {
                minimum: {
                  unit: 'business_day',
                  value: 3,
                },
                maximum: {
                  unit: 'business_day',
                  value: 5,
                },
              },
            },
          },
        ],
        phone_number_collection: {
          enabled: true,
        },
        shipping_address_collection: {
          allowed_countries: ['ID'], // Indonesia
        },
        tax_id_collection: {
          enabled: false,
        },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: {
          orderId: input.orderId || '',
          customerName: `${input.customer.firstName} ${input.customer.lastName}`,
          itemCount: input.items.length.toString(),
        },
      });

      return {
        sessionId: session.id,
        url: session.url!,
      };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw new Error('Failed to create checkout session');
    }
  }

  /**
   * Retrieve payment intent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      console.error('Error retrieving payment intent:', error);
      throw new Error('Failed to retrieve payment intent');
    }
  }

  /**
   * Retrieve checkout session
   */
  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    try {
      return await this.stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      console.error('Error retrieving checkout session:', error);
      throw new Error('Failed to retrieve checkout session');
    }
  }

  /**
   * Confirm payment intent
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId: string
  ): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId,
      });
    } catch (error) {
      console.error('Error confirming payment intent:', error);
      throw new Error('Failed to confirm payment');
    }
  }

  /**
   * Create refund
   */
  async createRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: string
  ): Promise<Stripe.Refund> {
    try {
      return await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount) : undefined,
        reason: reason as Stripe.RefundCreateParams.Reason,
      });
    } catch (error) {
      console.error('Error creating refund:', error);
      throw new Error('Failed to create refund');
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      throw new Error('Invalid webhook signature');
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error(`Error handling webhook event ${event.type}:`, error);
      throw error;
    }
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    if (orderId) {
      // TODO: Update order status and process fulfillment
      console.log(`Payment succeeded for order ${orderId}`);
    }
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    if (orderId) {
      // TODO: Update order status and release inventory
      console.log(`Payment failed for order ${orderId}`);
    }
  }

  /**
   * Handle completed checkout session
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const orderId = session.metadata?.orderId;
    if (orderId) {
      // TODO: Update order status and process fulfillment
      console.log(`Checkout completed for order ${orderId}`);
    }
  }

  /**
   * Calculate application fee (for marketplace scenarios)
   */
  calculateApplicationFee(amount: number, feePercentage: number = 2.9): number {
    return Math.round(amount * (feePercentage / 100));
  }

  /**
   * Format amount for display
   */
  formatAmount(amount: number, currency: string = 'IDR'): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  }
}