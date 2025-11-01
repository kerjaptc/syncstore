import { Suspense } from 'react';
import { ShoppingCart } from '@/components/storefront/shopping-cart';
import { CartSummary } from '@/components/storefront/cart-summary';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export const dynamic = 'force-dynamic';

/**
 * Shopping cart page
 */
export default function CartPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Suspense fallback={<LoadingSpinner />}>
            <ShoppingCart />
          </Suspense>
        </div>
        
        <div className="lg:col-span-1">
          <Suspense fallback={<LoadingSpinner />}>
            <CartSummary />
          </Suspense>
        </div>
      </div>
    </div>
  );
}