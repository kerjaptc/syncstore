'use client';

import { useState, useEffect } from 'react';
import { ProductCard } from './product-card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import type { StorefrontProduct } from '@/lib/services/storefront-service';
import type { PaginatedResponse } from '@/types';

interface ProductGridProps {
  searchParams: {
    search?: string;
    category?: string;
    brand?: string;
    minPrice?: string;
    maxPrice?: string;
    page?: string;
    sort?: string;
  };
}

/**
 * Product grid component with pagination
 */
export function ProductGrid({ searchParams }: ProductGridProps) {
  const [products, setProducts] = useState<PaginatedResponse<StorefrontProduct> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        setError(null);

        // Use API route instead of direct service call
        const searchParamsObj = new URLSearchParams();
        if (searchParams.search) searchParamsObj.set('search', searchParams.search);
        if (searchParams.category) searchParamsObj.set('category', searchParams.category);
        if (searchParams.brand) searchParamsObj.set('brand', searchParams.brand);
        if (searchParams.minPrice) searchParamsObj.set('minPrice', searchParams.minPrice);
        if (searchParams.maxPrice) searchParamsObj.set('maxPrice', searchParams.maxPrice);
        if (searchParams.page) searchParamsObj.set('page', searchParams.page);
        if (searchParams.sort) searchParamsObj.set('sort', searchParams.sort);

        const response = await fetch(`/api/storefront/products?${searchParamsObj}`);
        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }
        const result = await response.json();

        setProducts(result);
      } catch (err) {
        console.error('Error loading products:', err);
        setError('Failed to load products. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  if (!products || products.data.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8l-2-2m0 0l-2 2m2-2v6" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">No products found</h3>
        <p className="text-muted-foreground mb-4">
          Try adjusting your search or filter criteria.
        </p>
        <Button onClick={() => window.location.href = '/store/products'}>
          View All Products
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Results Info */}
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">
          Showing {((products.pagination.page - 1) * products.pagination.limit) + 1}-
          {Math.min(products.pagination.page * products.pagination.limit, products.pagination.total)} of {products.pagination.total} results
        </p>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.data.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {/* Pagination */}
      {products.pagination.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 pt-8">
          <Button
            variant="outline"
            disabled={!products.pagination.hasPrev}
            onClick={() => {
              const params = new URLSearchParams(window.location.search);
              params.set('page', (products.pagination.page - 1).toString());
              window.location.href = `/store/products?${params.toString()}`;
            }}
          >
            Previous
          </Button>
          
          <div className="flex items-center space-x-1">
            {Array.from({ length: Math.min(5, products.pagination.totalPages) }, (_, i) => {
              let page;
              if (products.pagination.totalPages <= 5) {
                page = i + 1;
              } else {
                const current = products.pagination.page;
                const total = products.pagination.totalPages;
                
                if (current <= 3) {
                  page = i + 1;
                } else if (current >= total - 2) {
                  page = total - 4 + i;
                } else {
                  page = current - 2 + i;
                }
              }
              
              const isCurrentPage = page === products.pagination.page;
              
              return (
                <Button
                  key={page}
                  variant={isCurrentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    params.set('page', page.toString());
                    window.location.href = `/store/products?${params.toString()}`;
                  }}
                >
                  {page}
                </Button>
              );
            })}
            
            {products.pagination.totalPages > 5 && products.pagination.page < products.pagination.totalPages - 2 && (
              <>
                <span className="px-2">...</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    params.set('page', products.pagination.totalPages.toString());
                    window.location.href = `/store/products?${params.toString()}`;
                  }}
                >
                  {products.pagination.totalPages}
                </Button>
              </>
            )}
          </div>
          
          <Button
            variant="outline"
            disabled={!products.pagination.hasNext}
            onClick={() => {
              const params = new URLSearchParams(window.location.search);
              params.set('page', (products.pagination.page + 1).toString());
              window.location.href = `/store/products?${params.toString()}`;
            }}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}