import { Suspense } from 'react';
import { CheckoutForm } from '@/components/storefront/checkout-form';
import { CheckoutSummary } from '@/components/storefront/checkout-summary';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export const dynamic = 'force-dynamic';

/**
 * Checkout page with customer information and payment processing
 */
export default function CheckoutPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            <Suspense fallback={<LoadingSpinner />}>
              <CheckoutForm />
            </Suspense>
          </div>
          
          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Suspense fallback={<LoadingSpinner />}>
              <CheckoutSummary />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}