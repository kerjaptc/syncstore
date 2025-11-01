'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Plus, 
  Package, 
  Upload, 
  BarChart3,
  AlertTriangle,
  Search,
  Filter
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { CustomPagination } from '@/components/ui/custom-pagination';
import { ErrorBoundary, TableLoadingSkeleton } from '@/components/ui/error-boundary';
import { toast } from 'sonner';
import { useAuth } from '@clerk/nextjs';

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
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export default function ProductsPage() {
  const { isLoaded } = useAuth();
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50, // Phase 2 requirement: max 50 products per page
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });

  useEffect(() => {
    if (isLoaded) {
      loadProducts();
    }
  }, [isLoaded, pagination.page, searchQuery]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await fetch(`/api/master-products?${params}`);
      if (!response.ok) {
        throw new Error('Failed to load products');
      }

      const result = await response.json();
      const data: PaginatedResponse<MasterProduct> = result.data;
      
      setProducts(data.data);
      setPagination(data.pagination);
    } catch (error) {
      toast.error('Failed to load products');
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPagination(prev => ({ ...prev, page: 1 }));
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

  const getSyncStatus = (product: MasterProduct) => {
    // For now, return 'not_synced' - will be updated when sync functionality is implemented
    return 'not_synced';
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">
            Master product catalog with pricing and sync status
          </p>
        </div>
      </div>

      {/* Stats Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Products</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{pagination.total}</div>
          <p className="text-xs text-muted-foreground">
            Products in master catalog
          </p>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-8"
          />
        </div>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>
            Master catalog with platform-specific pricing and sync status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ErrorBoundary>
            {loading ? (
              <TableLoadingSkeleton rows={10} cols={6} />
            ) : products.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <div className="text-muted-foreground">No products found</div>
                  {searchQuery && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Try adjusting your search query
                    </div>
                  )}
                </div>
              </div>
            ) : (
            <>
              {/* Table - Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Product ID</th>
                      <th className="text-left p-2 font-medium">Title</th>
                      <th className="text-left p-2 font-medium">Master Price</th>
                      <th className="text-left p-2 font-medium">Shopee Price</th>
                      <th className="text-left p-2 font-medium">TikTok Price</th>
                      <th className="text-left p-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="border-b hover:bg-muted/50">
                        <td className="p-2">
                          <div className="font-mono text-sm">{product.masterSku}</div>
                        </td>
                        <td className="p-2">
                          <div className="font-medium">
                            <a 
                              href={`/dashboard/products/${product.id}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {product.name}
                            </a>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {product.brand} • {typeof product.category === 'object' ? product.category?.name || 'No category' : product.category || 'No category'}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="font-medium">
                            {formatPrice(product.basePrice, product.currency)}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="font-medium">
                            {formatPrice(getShopeePrice(product).toString(), product.currency)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Base × 1.15
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="font-medium">
                            {formatPrice(getTikTokPrice(product).toString(), product.currency)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Base × 1.20
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {getSyncStatus(product) === 'not_synced' ? 'Not Synced' : 'Synced'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards - Mobile */}
              <div className="md:hidden space-y-4">
                {products.map((product) => (
                  <Card key={product.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <a 
                            href={`/dashboard/products/${product.id}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          >
                            {product.name}
                          </a>
                          <div className="text-sm text-muted-foreground">
                            {product.masterSku}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {product.brand} • {typeof product.category === 'object' ? product.category?.name || 'No category' : product.category || 'No category'}
                          </div>
                        </div>
                        <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {getSyncStatus(product) === 'not_synced' ? 'Not Synced' : 'Synced'}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-muted-foreground">Master</div>
                          <div className="font-medium">
                            {formatPrice(product.basePrice, product.currency)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Shopee</div>
                          <div className="font-medium">
                            {formatPrice(getShopeePrice(product).toString(), product.currency)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">TikTok</div>
                          <div className="font-medium">
                            {formatPrice(getTikTokPrice(product).toString(), product.currency)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              
              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="mt-4">
                  <CustomPagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
            )}
          </ErrorBoundary>
        </CardContent>
      </Card>
    </div>
  );
}