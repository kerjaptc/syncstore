'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Package, DollarSign, Globe } from 'lucide-react';
import { toast } from 'sonner';

// Types for master catalog
interface MasterProduct {
  id: string;
  masterSku: string;
  name: string;
  description: string;
  basePrice: string;
  currency: string;
  platformPrices: Record<string, number>;
  status: string;
  brand: string;
  category: any;
  images: string[];
  hasVariants: boolean;
  totalStock: number;
  weight: string;
  dimensions: any;
  seoData: any;
  createdAt: string;
  updatedAt: string;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.productId as string;
  
  const [product, setProduct] = useState<MasterProduct | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (productId) {
      loadProduct();
    }
  }, [productId]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/master-products/${productId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load product');
      }

      const result = await response.json();
      setProduct(result.data);
    } catch (error) {
      toast.error('Failed to load product');
      console.error('Error loading product:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: string, currency: string = 'IDR') => {
    const numPrice = parseFloat(price);
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(numPrice);
  };

  const getShopeePrice = (product: MasterProduct) => {
    const basePrice = parseFloat(product.basePrice);
    return basePrice * 1.15; // Phase 1 pricing: Shopee = base × 1.15
  };

  const getTikTokPrice = (product: MasterProduct) => {
    const basePrice = parseFloat(product.basePrice);
    return basePrice * 1.20; // Phase 1 pricing: TikTok = base × 1.20
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading product...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Product not found</h2>
          <p className="text-muted-foreground mb-4">The product you're looking for doesn't exist.</p>
          <Button onClick={() => router.push('/dashboard/products')}>
            Back to Products
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/dashboard/products')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
          <p className="text-muted-foreground">
            SKU: {product.masterSku} • {product.brand}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Master Fields Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Master Product Information
              </CardTitle>
              <CardDescription>
                Central product data used across all platforms
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Product Name</label>
                  <p className="font-medium">{product.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Brand</label>
                  <p className="font-medium">{product.brand}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Category</label>
                  <p className="font-medium">
                    {typeof product.category === 'object' ? product.category?.name || 'No category' : product.category || 'No category'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                    {product.status}
                  </Badge>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="mt-1 text-sm">{product.description || 'No description'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Weight</label>
                  <p className="font-medium">{product.weight ? `${product.weight} kg` : 'Not specified'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Stock</label>
                  <p className="font-medium">{product.totalStock} units</p>
                </div>
              </div>

              {product.images && product.images.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Images</label>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {product.images.slice(0, 4).map((image, index) => (
                      <img
                        key={index}
                        src={image}
                        alt={`Product image ${index + 1}`}
                        className="w-full h-20 object-cover rounded border"
                      />
                    ))}
                  </div>
                  {product.images.length > 4 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      +{product.images.length - 4} more images
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Platform Pricing Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Pricing Information
              </CardTitle>
              <CardDescription>
                Base price and platform-specific calculations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Master Price</label>
                <p className="text-2xl font-bold">
                  {formatPrice(product.basePrice, product.currency)}
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                  <div>
                    <p className="font-medium text-orange-900">Shopee Price</p>
                    <p className="text-sm text-orange-700">Base × 1.15</p>
                  </div>
                  <p className="font-bold text-orange-900">
                    {formatPrice(getShopeePrice(product).toString(), product.currency)}
                  </p>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <div>
                    <p className="font-medium text-red-900">TikTok Price</p>
                    <p className="text-sm text-red-700">Base × 1.20</p>
                  </div>
                  <p className="font-bold text-red-900">
                    {formatPrice(getTikTokPrice(product).toString(), product.currency)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sync Status Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Platform Sync Status
              </CardTitle>
              <CardDescription>
                Current synchronization status across platforms
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Shopee</span>
                <Badge variant="secondary">Not Synced</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">TikTok Shop</span>
                <Badge variant="secondary">Not Synced</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Tokopedia</span>
                <Badge variant="secondary">Not Synced</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}