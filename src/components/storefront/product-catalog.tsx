'use client';

import { useState, useEffect } from 'react';
import { ProductCard } from './product-card';
import { ProductFilters } from './product-filters';
import { ProductSort } from './product-sort';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import type { StorefrontProduct } from '@/lib/services/storefront-service';
import type { PaginatedResponse } from '@/types';

interface ProductCatalogProps {
  initialProducts?: PaginatedResponse<StorefrontProduct>;
  searchParams?: {
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
 * Product catalog with filtering, sorting, and pagination
 */
export function ProductCatalog({ initialProducts, searchParams = {} }: ProductCatalogProps) {
  const [products, setProducts] = useState<PaginatedResponse<StorefrontProduct> | null>(initialProducts || null);
  const [loading, setLoading] = useState(!initialProducts);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = async (params: typeof searchParams = {}) => {
    try {
      setLoading(true);
      setError(null);

      // Use API route instead of direct service call
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.set('search', params.search);
      if (params.category) searchParams.set('category', params.category);
      if (params.brand) searchParams.set('brand', params.brand);
      if (params.minPrice) searchParams.set('minPrice', params.minPrice);
      if (params.maxPrice) searchParams.set('maxPrice', params.maxPrice);
      if (params.page) searchParams.set('page', params.page);
      if (params.sort) searchParams.set('sort', params.sort);

      const response = await fetch(`/api/storefront/products?${searchParams}`);
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

  useEffect(() => {
    if (!initialProducts) {
      loadProducts(searchParams);
    }
  }, [searchParams, initialProducts]);

  const handleFilterChange = (newParams: typeof searchParams) => {
    loadProducts({ ...searchParams, ...newParams, page: '1' });
  };

  const handlePageChange = (page: number) => {
    loadProducts({ ...searchParams, page: page.toString() });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => loadProducts(searchParams)}>
          Try Again
        </Button>
      </div>
    );
  }

  if (!products || products.data.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-semibold mb-2">No products found</h3>
        <p className="text-muted-foreground mb-4">
          Try adjusting your search or filter criteria.
        </p>
        <Button onClick={() => loadProducts()}>
          View All Products
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Products</h2>
          <p className="text-muted-foreground">
            Showing {products.data.length} of {products.pagination.total} products
          </p>
        </div>
        <ProductSort 
          currentSort={searchParams.sort} 
          onSortChange={(sort) => handleFilterChange({ sort })} 
        />
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.data.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {/* Pagination */}
      {products.pagination.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2">
          <Button
            variant="outline"
            disabled={!products.pagination.hasPrev}
            onClick={() => handlePageChange(products.pagination.page - 1)}
          >
            Previous
          </Button>
          
          <div className="flex items-center space-x-1">
            {Array.from({ length: Math.min(5, products.pagination.totalPages) }, (_, i) => {
              const page = i + 1;
              const isCurrentPage = page === products.pagination.page;
              
              return (
                <Button
                  key={page}
                  variant={isCurrentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </Button>
              );
            })}
            
            {products.pagination.totalPages > 5 && (
              <>
                <span className="px-2">...</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(products.pagination.totalPages)}
                >
                  {products.pagination.totalPages}
                </Button>
              </>
            )}
          </div>
          
          <Button
            variant="outline"
            disabled={!products.pagination.hasNext}
            onClick={() => handlePageChange(products.pagination.page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}