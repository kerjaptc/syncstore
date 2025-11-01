import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { ShoppingCart, Heart } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import type { StorefrontProduct } from '@/lib/services/storefront-service';

interface ProductCardProps {
  product: StorefrontProduct;
}

/**
 * Product card component for displaying products in grid
 */
export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Add the first available variant to cart
    const firstVariant = product.variants.find(v => v.inStock);
    if (firstVariant) {
      addItem({
        id: firstVariant.id,
        productId: product.id,
        productName: product.name,
        variantName: firstVariant.name,
        sku: firstVariant.variantSku,
        price: firstVariant.price,
        image: firstVariant.images[0] || product.images[0],
        attributes: firstVariant.attributes,
        maxQuantity: firstVariant.quantityAvailable,
      });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const mainImage = product.images[0] || '/placeholder-product.jpg';
  const hasDiscount = product.maxPrice > product.minPrice;
  const firstVariant = product.variants[0];

  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-shadow">
      <Link href={`/store/products/${product.id}`}>
        <div className="relative aspect-square overflow-hidden">
          <Image
            src={mainImage}
            alt={product.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          />
          
          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {!product.inStock && (
              <Badge variant="secondary">Out of Stock</Badge>
            )}
            {hasDiscount && (
              <Badge variant="destructive">Sale</Badge>
            )}
          </div>

          {/* Wishlist Button */}
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // TODO: Implement wishlist functionality
            }}
          >
            <Heart className="h-4 w-4" />
          </Button>
        </div>
      </Link>

      <CardContent className="p-4">
        <Link href={`/store/products/${product.id}`}>
          <div className="space-y-2">
            {/* Category */}
            {product.category && (
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {product.category}
              </p>
            )}

            {/* Product Name */}
            <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
              {product.name}
            </h3>

            {/* Brand */}
            {product.brand && (
              <p className="text-sm text-muted-foreground">{product.brand}</p>
            )}

            {/* Price */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">
                {formatPrice(product.minPrice)}
              </span>
              {hasDiscount && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatPrice(product.maxPrice)}
                </span>
              )}
            </div>

            {/* Stock Status */}
            <div className="flex items-center justify-between text-sm">
              <span className={`${product.inStock ? 'text-green-600' : 'text-red-600'}`}>
                {product.inStock ? `${product.totalStock} in stock` : 'Out of stock'}
              </span>
              {product.variants.length > 1 && (
                <span className="text-muted-foreground">
                  {product.variants.length} variants
                </span>
              )}
            </div>
          </div>
        </Link>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button
          className="w-full"
          disabled={!product.inStock}
          onClick={handleAddToCart}
        >
          <ShoppingCart className="mr-2 h-4 w-4" />
          {product.inStock ? 'Add to Cart' : 'Out of Stock'}
        </Button>
      </CardFooter>
    </Card>
  );
}