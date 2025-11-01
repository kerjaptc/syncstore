'use client';

import { useState, useEffect } from 'react';
import { ProductCard } from './product-card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import type { StorefrontProduct } from '@/lib/services/storefront-service';

/**
 * Featured products section for homepage
 */
export function FeaturedProducts() {
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFeaturedProducts = async () => {
      try {
        const response = await fetch('/api/storefront/featured-products');
        if (!response.ok) {
          throw new Error('Failed to fetch featured products');
        }
        const featuredProducts = await response.json();
        setProducts(featuredProducts);
      } catch (error) {
        console.error('Error loading featured products:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFeaturedProducts();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <section className="py-12">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-center mb-4">Featured Products</h2>
        <p className="text-muted-foreground text-center max-w-2xl mx-auto">
          Discover our handpicked selection of the best products, carefully chosen for quality and value.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}