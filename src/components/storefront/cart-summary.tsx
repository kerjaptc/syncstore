'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/hooks/use-cart';

/**
 * Cart summary component with totals and checkout button
 */
export function CartSummary() {
  const { items, getTotalItems, getTotalPrice } = useCart();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const subtotal = getTotalPrice();
  const shipping = subtotal > 500000 ? 0 : 25000; // Free shipping over 500k IDR
  const tax = subtotal * 0.11; // 11% tax
  const total = subtotal + shipping + tax;

  if (items.length === 0) {
    return null;
  }

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle>Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Items Count */}
        <div className="flex justify-between text-sm">
          <span>Items ({getTotalItems()})</span>
          <span>{formatPrice(subtotal)}</span>
        </div>

        {/* Shipping */}
        <div className="flex justify-between text-sm">
          <span>Shipping</span>
          <span>
            {shipping === 0 ? (
              <span className="text-green-600">Free</span>
            ) : (
              formatPrice(shipping)
            )}
          </span>
        </div>

        {/* Tax */}
        <div className="flex justify-between text-sm">
          <span>Tax (11%)</span>
          <span>{formatPrice(tax)}</span>
        </div>

        <Separator />

        {/* Total */}
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>

        {/* Free Shipping Notice */}
        {shipping > 0 && (
          <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
            💡 Add {formatPrice(500000 - subtotal)} more for free shipping!
          </div>
        )}

        {/* Checkout Button */}
        <Button className="w-full" size="lg" asChild>
          <Link href="/store/checkout">
            Proceed to Checkout
          </Link>
        </Button>

        {/* Continue Shopping */}
        <Button variant="outline" className="w-full" asChild>
          <Link href="/store/products">
            Continue Shopping
          </Link>
        </Button>

        {/* Security Notice */}
        <div className="text-xs text-muted-foreground text-center">
          🔒 Secure checkout with SSL encryption
        </div>
      </CardContent>
    </Card>
  );
}