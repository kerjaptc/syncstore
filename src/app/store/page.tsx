import { Suspense } from 'react';
import { ProductCatalog } from '@/components/storefront/product-catalog';
import { HeroSection } from '@/components/storefront/hero-section';
import { FeaturedProducts } from '@/components/storefront/featured-products';
import { CategoryGrid } from '@/components/storefront/category-grid';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export const dynamic = 'force-dynamic';

/**
 * Storefront home page
 * Displays hero section, featured products, and product catalog
 */
export default function StorefrontPage() {
  return (
    <div className="space-y-8">
      <HeroSection />
      
      <div className="container mx-auto px-4">
        <Suspense fallback={<LoadingSpinner />}>
          <FeaturedProducts />
        </Suspense>
        
        <Suspense fallback={<LoadingSpinner />}>
          <CategoryGrid />
        </Suspense>
        
        <Suspense fallback={<LoadingSpinner />}>
          <ProductCatalog />
        </Suspense>
      </div>
    </div>
  );
}