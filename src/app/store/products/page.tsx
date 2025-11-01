import { Suspense } from 'react';
import { ProductGrid } from '@/components/storefront/product-grid';
import { ProductFilters } from '@/components/storefront/product-filters';
import { ProductSearch } from '@/components/storefront/product-search';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface ProductsPageProps {
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

export const dynamic = 'force-dynamic';

/**
 * Products listing page with search and filtering
 */
export default function ProductsPage({ searchParams }: ProductsPageProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">All Products</h1>
        <ProductSearch initialSearch={searchParams.search} />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <ProductFilters searchParams={searchParams} />
        </div>
        
        <div className="lg:col-span-3">
          <Suspense fallback={<LoadingSpinner />}>
            <ProductGrid searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}