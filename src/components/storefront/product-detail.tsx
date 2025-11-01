'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingCart, Heart, Share2, Minus, Plus } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import type { StorefrontProduct, StorefrontVariant } from '@/lib/services/storefront-service';

interface ProductDetailProps {
  product: StorefrontProduct;
}

/**
 * Product detail component for individual product pages
 */
export function ProductDetail({ product }: ProductDetailProps) {
  const [selectedVariant, setSelectedVariant] = useState<StorefrontVariant>(
    product.variants.find(v => v.inStock) || product.variants[0]
  );
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleAddToCart = () => {
    if (selectedVariant && selectedVariant.inStock) {
      addItem({
        id: selectedVariant.id,
        productId: product.id,
        productName: product.name,
        variantName: selectedVariant.name,
        sku: selectedVariant.variantSku,
        price: selectedVariant.price,
        quantity,
        image: selectedVariant.images[0] || product.images[0],
        attributes: selectedVariant.attributes,
        maxQuantity: selectedVariant.quantityAvailable,
      });
    }
  };

  const allImages = [
    ...product.images,
    ...(selectedVariant?.images || [])
  ].filter((img, index, arr) => arr.indexOf(img) === index);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Product Images */}
      <div className="space-y-4">
        {/* Main Image */}
        <div className="aspect-square relative overflow-hidden rounded-lg border">
          <Image
            src={allImages[selectedImage] || '/placeholder-product.jpg'}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        </div>

        {/* Image Thumbnails */}
        {allImages.length > 1 && (
          <div className="grid grid-cols-4 gap-2">
            {allImages.slice(0, 4).map((image, index) => (
              <button
                key={index}
                onClick={() => setSelectedImage(index)}
                className={`aspect-square relative overflow-hidden rounded border-2 transition-colors ${
                  selectedImage === index ? 'border-primary' : 'border-muted'
                }`}
              >
                <Image
                  src={image}
                  alt={`${product.name} ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="100px"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="space-y-6">
        {/* Header */}
        <div>
          {product.category && (
            <p className="text-sm text-muted-foreground uppercase tracking-wide mb-2">
              {product.category}
            </p>
          )}
          <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
          {product.brand && (
            <p className="text-lg text-muted-foreground">by {product.brand}</p>
          )}
        </div>

        {/* Price */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold">
              {formatPrice(selectedVariant?.price || product.minPrice)}
            </span>
            {selectedVariant?.compareAtPrice && selectedVariant.compareAtPrice > selectedVariant.price && (
              <span className="text-lg text-muted-foreground line-through">
                {formatPrice(selectedVariant.compareAtPrice)}
              </span>
            )}
          </div>
          
          {/* Stock Status */}
          <div className="flex items-center gap-2">
            <Badge variant={selectedVariant?.inStock ? "default" : "secondary"}>
              {selectedVariant?.inStock ? 'In Stock' : 'Out of Stock'}
            </Badge>
            {selectedVariant?.inStock && (
              <span className="text-sm text-muted-foreground">
                {selectedVariant.quantityAvailable} available
              </span>
            )}
          </div>
        </div>

        {/* Variants */}
        {product.variants.length > 1 && (
          <div className="space-y-3">
            <h3 className="font-semibold">Variants</h3>
            <div className="grid grid-cols-2 gap-2">
              {product.variants.map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => setSelectedVariant(variant)}
                  disabled={!variant.inStock}
                  className={`p-3 border rounded-lg text-left transition-colors ${
                    selectedVariant?.id === variant.id
                      ? 'border-primary bg-primary/5'
                      : variant.inStock
                      ? 'border-muted hover:border-primary/50'
                      : 'border-muted bg-muted/50 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="font-medium text-sm">{variant.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatPrice(variant.price)}
                  </div>
                  {!variant.inStock && (
                    <div className="text-xs text-red-600">Out of stock</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quantity */}
        {selectedVariant?.inStock && (
          <div className="space-y-3">
            <h3 className="font-semibold">Quantity</h3>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center font-medium">{quantity}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuantity(Math.min(selectedVariant.quantityAvailable, quantity + 1))}
                disabled={quantity >= selectedVariant.quantityAvailable}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full"
            disabled={!selectedVariant?.inStock}
            onClick={handleAddToCart}
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            {selectedVariant?.inStock ? 'Add to Cart' : 'Out of Stock'}
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1">
              <Heart className="mr-2 h-4 w-4" />
              Wishlist
            </Button>
            <Button variant="outline" className="flex-1">
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>

        {/* Product Details */}
        <Card>
          <CardContent className="p-6">
            <Tabs defaultValue="description" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="description">Description</TabsTrigger>
                <TabsTrigger value="specifications">Specs</TabsTrigger>
                <TabsTrigger value="shipping">Shipping</TabsTrigger>
              </TabsList>
              
              <TabsContent value="description" className="mt-4">
                <div className="prose prose-sm max-w-none">
                  {product.description ? (
                    <p className="text-muted-foreground leading-relaxed">
                      {product.description}
                    </p>
                  ) : (
                    <p className="text-muted-foreground italic">
                      No description available for this product.
                    </p>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="specifications" className="mt-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="font-medium">SKU:</span>
                    <span className="text-muted-foreground">{selectedVariant?.variantSku || product.sku}</span>
                  </div>
                  {product.brand && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="font-medium">Brand:</span>
                      <span className="text-muted-foreground">{product.brand}</span>
                    </div>
                  )}
                  {product.category && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="font-medium">Category:</span>
                      <span className="text-muted-foreground">{product.category}</span>
                    </div>
                  )}
                  {selectedVariant?.attributes && Object.keys(selectedVariant.attributes).length > 0 && (
                    <>
                      <Separator />
                      {Object.entries(selectedVariant.attributes).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-2 gap-2 text-sm">
                          <span className="font-medium capitalize">{key}:</span>
                          <span className="text-muted-foreground">{value}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="shipping" className="mt-4">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span>Standard Delivery:</span>
                    <span className="text-muted-foreground">3-5 business days</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Express Delivery:</span>
                    <span className="text-muted-foreground">1-2 business days</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Free Shipping:</span>
                    <span className="text-muted-foreground">Orders over Rp 500,000</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span>Return Policy:</span>
                    <span className="text-muted-foreground">30 days</span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}