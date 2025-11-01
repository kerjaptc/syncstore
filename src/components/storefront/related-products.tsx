'use client';

import { useState, useEffect } from 'react';
import { ProductCard } from './product-card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import type { StorefrontProduct } from '@/lib/services/storefront-service';

interface RelatedProductsProps {
  productId: string;
  category?: string;
}

/**
 * Related products component for product detail pages
 */
export function RelatedProducts({ productId, category }: RelatedProductsProps) {
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRelatedProducts = async () => {
      try {
        const searchParams = new URLSearchParams();
        searchParams.set('productId', productId);
        if (category) searchParams.set('category', category);
        searchParams.set('limit', '4');

        const response = await fetch(`/api/storefront/related-products?${searchParams}`);
        if (!response.ok) {
          throw new Error('Failed to fetch related products');
        }
        const relatedProducts = await response.json();
        setProducts(relatedProducts);
      } catch (error) {
        console.error('Error loading related products:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRelatedProducts();
  }, [productId, category]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="text-2xl font-bold mb-6">Related Products</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}