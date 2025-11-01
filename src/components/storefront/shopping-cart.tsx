'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCart } from '@/hooks/use-cart';

/**
 * Shopping cart component showing cart items
 */
export function ShoppingCart() {
  const { items, updateQuantity, removeItem, getTotalPrice } = useCart();

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
          <div className="space-y-4">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto">
              <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5-6M20 13v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Your cart is empty</h3>
              <p className="text-muted-foreground mb-4">
                Add some products to your cart to get started.
              </p>
              <Button asChild>
                <Link href="/store/products">Continue Shopping</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="p-4">
            <div className="flex gap-4">
              {/* Product Image */}
              <div className="relative w-20 h-20 flex-shrink-0">
                <Image
                  src={item.image || '/placeholder-product.jpg'}
                  alt={item.productName}
                  fill
                  className="object-cover rounded"
                  sizes="80px"
                />
              </div>

              {/* Product Details */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-sm line-clamp-2">
                      <Link 
                        href={`/store/products/${item.productId}`}
                        className="hover:text-primary"
                      >
                        {item.productName}
                      </Link>
                    </h3>
                    {item.variantName && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.variantName}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      SKU: {item.sku}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Attributes */}
                {item.attributes && Object.keys(item.attributes).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {Object.entries(item.attributes).map(([key, value]) => (
                      <span key={key} className="text-xs bg-muted px-2 py-1 rounded">
                        {key}: {value}
                      </span>
                    ))}
                  </div>
                )}

                {/* Price and Quantity */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={item.maxQuantity ? item.quantity >= item.maxQuantity : false}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-semibold">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatPrice(item.price)} each
                    </p>
                  </div>
                </div>

                {/* Stock Warning */}
                {item.maxQuantity && item.quantity >= item.maxQuantity && (
                  <p className="text-xs text-amber-600 mt-1">
                    Maximum available quantity reached
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}