'use client';

import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/hooks/use-cart';

/**
 * Checkout summary component showing order details and totals
 */
export function CheckoutSummary() {
  const { items, getTotalItems } = useCart();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Your cart is empty</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals (using standard shipping for estimate)
  const shippingCost = 25000; // Default standard shipping
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * 0.11; // 11% tax
  const discount = 0; // No discount for now
  const shipping = subtotal >= 500000 ? 0 : shippingCost; // Free shipping over 500k
  const total = subtotal + tax + shipping - discount;
  
  const totals = {
    subtotal,
    tax,
    discount,
    shipping,
    total
  };

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle>Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Order Items */}
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3">
              {/* Product Image */}
              <div className="relative w-16 h-16 flex-shrink-0">
                <Image
                  src={item.image || '/placeholder-product.jpg'}
                  alt={item.productName}
                  fill
                  className="object-cover rounded"
                  sizes="64px"
                />
                {item.quantity > 1 && (
                  <Badge 
                    variant="secondary" 
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    {item.quantity}
                  </Badge>
                )}
              </div>

              {/* Product Details */}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm line-clamp-2">
                  {item.productName}
                </h4>
                {item.variantName && (
                  <p className="text-xs text-muted-foreground">
                    {item.variantName}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  SKU: {item.sku}
                </p>
                
                {/* Attributes */}
                {item.attributes && Object.keys(item.attributes).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(item.attributes).slice(0, 2).map(([key, value]) => (
                      <span key={key} className="text-xs bg-muted px-1 py-0.5 rounded">
                        {key}: {value}
                      </span>
                    ))}
                  </div>
                )}
                
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-muted-foreground">
                    Qty: {item.quantity}
                  </span>
                  <span className="font-medium text-sm">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Separator />

        {/* Order Totals */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal ({getTotalItems()} items)</span>
            <span>{formatPrice(totals.subtotal)}</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span>Shipping</span>
            <span>
              {totals.shipping === 0 ? (
                <span className="text-green-600">Free</span>
              ) : (
                formatPrice(totals.shipping)
              )}
            </span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span>Tax (11%)</span>
            <span>{formatPrice(totals.tax)}</span>
          </div>
          
          {totals.discount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span>-{formatPrice(totals.discount)}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Total */}
        <div className="flex justify-between font-semibold text-lg">
          <span>Total</span>
          <span>{formatPrice(totals.total)}</span>
        </div>

        {/* Free Shipping Notice */}
        {totals.shipping > 0 && totals.subtotal < 500000 && (
          <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
            💡 Add {formatPrice(500000 - totals.subtotal)} more for free shipping!
          </div>
        )}

        {/* Security Notice */}
        <div className="text-xs text-muted-foreground text-center pt-4 border-t">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Secure Checkout</span>
          </div>
          <p>Your payment information is encrypted and secure</p>
        </div>

        {/* Payment Methods */}
        <div className="flex justify-center items-center gap-2 pt-2">
          <div className="text-xs text-muted-foreground">We accept:</div>
          <div className="flex gap-1">
            <div className="w-8 h-5 bg-muted rounded flex items-center justify-center text-xs">
              💳
            </div>
            <div className="w-8 h-5 bg-muted rounded flex items-center justify-center text-xs">
              🏦
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}