import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProductDetail } from '@/components/storefront/product-detail';
import { RelatedProducts } from '@/components/storefront/related-products';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { StorefrontService } from '@/lib/services/storefront-service';

interface ProductPageProps {
  params: {
    productId: string;
  };
}

export const dynamic = 'force-dynamic';

const storefrontService = new StorefrontService();

/**
 * Individual product detail page
 */
export default async function ProductPage({ params }: ProductPageProps) {
  try {
    const product = await storefrontService.getProductById(params.productId);
    
    if (!product) {
      notFound();
    }

    return (
      <div className="container mx-auto px-4 py-8">
        <Suspense fallback={<LoadingSpinner />}>
          <ProductDetail product={product} />
        </Suspense>
        
        <div className="mt-16">
          <Suspense fallback={<LoadingSpinner />}>
            <RelatedProducts 
              productId={params.productId} 
              category={product.category} 
            />
          </Suspense>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error loading product:', error);
    notFound();
  }
}