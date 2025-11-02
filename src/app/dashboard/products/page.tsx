'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Package, 
  Search,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  FileText
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { CustomPagination } from '@/components/ui/custom-pagination';
import { ErrorBoundary, TableLoadingSkeleton } from '@/components/ui/error-boundary';
import { toast } from 'sonner';
import { useAuth } from '@clerk/nextjs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { SyncButton } from '@/components/dashboard/SyncButton';
import { ProgressBar } from '@/components/dashboard/ProgressBar';
import { SyncLogDrawer } from '@/components/dashboard/SyncLogDrawer';
import { SyncErrorBoundary } from '@/components/dashboard/SyncErrorBoundary';

// Types for Phase 3 product sync
interface Product {
  id: string;
  title: string;
  base_price: number;
  shopee_price: number;
  status: 'pending' | 'syncing' | 'synced' | 'error';
  last_synced_at: string | null;
  last_sync_error: string | null;
}

interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
}

export default function ProductsPage() {
  const { isLoaded } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20, // Phase 3 requirement: 20 products per page
    total: 0,
    totalPages: 0,
  });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [syncLogOpen, setSyncLogOpen] = useState(false);
  const [currentSyncId, setCurrentSyncId] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [batchSyncing, setBatchSyncing] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      loadProducts();
    }
  }, [isLoaded, pagination.page, searchQuery]);

  // Auto-refresh when there are syncing products
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadProducts();
    }, 3000); // Refresh every 3 seconds when auto-refresh is enabled

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Check if any products are syncing to enable auto-refresh
  useEffect(() => {
    const hasSyncingProducts = products.some(product => product.status === 'syncing');
    setAutoRefresh(hasSyncingProducts);
  }, [products]);

  const handleSyncStart = (syncId: string) => {
    setCurrentSyncId(syncId);
    setSyncLogOpen(true);
  };

  const getSyncingCount = () => {
    return products.filter(product => product.status === 'syncing').length;
  };

  const getTotalProducts = () => {
    return products.length;
  };

  const handleSelectProduct = (productId: string, selected: boolean) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(productId);
      } else {
        newSet.delete(productId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedProducts(new Set(products.map(p => p.id)));
    } else {
      setSelectedProducts(new Set());
    }
  };

  const handleBatchSync = async () => {
    if (selectedProducts.size === 0) {
      toast.error('Please select products to sync');
      return;
    }

    setBatchSyncing(true);
    const selectedProductIds = Array.from(selectedProducts);
    
    try {
      const response = await fetch('/api/sync/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_ids: selectedProductIds,
          target: 'shopee',
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Started batch sync for ${selectedProductIds.length} products`);
        setSelectedProducts(new Set()); // Clear selection
        loadProducts(); // Refresh to show syncing status
        
        // Set the first sync ID for log viewing
        if (result.data.sync_operations && result.data.sync_operations.length > 0) {
          setCurrentSyncId(result.data.sync_operations[0].sync_id);
        }
      } else {
        throw new Error(result.error?.message || 'Batch sync failed');
      }
    } catch (error) {
      toast.error('Batch sync failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setBatchSyncing(false);
    }
  };

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

      console.log('Loading products with params:', params.toString());
      
      const response = await fetch(`/api/products?${params}`);
      console.log('Products API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Products API error response:', errorText);
        throw new Error(`Failed to load products: ${response.status}`);
      }

      const result = await response.json();
      console.log('Products API result:', result);
      
      if (result.success) {
        const data: ProductsResponse = result.data;
        console.log('Setting products:', data.products.length, 'products');
        setProducts(data.products);
        setPagination({
          page: data.page,
          limit: data.limit || 20,
          total: data.total,
          totalPages: Math.ceil(data.total / (data.limit || 20)),
        });
      } else {
        throw new Error(result.error?.message || 'Failed to load products');
      }
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

  const formatPrice = (price: number, currency: string = 'IDR') => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  const getStatusBadge = (status: Product['status'], lastSyncError?: string | null) => {
    const variants = {
      pending: { 
        color: 'bg-gray-100 text-gray-800 border-gray-200', 
        icon: Clock, 
        text: 'Pending',
        title: 'Product has not been synced yet'
      },
      syncing: { 
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
        icon: RefreshCw, 
        text: 'Syncing',
        title: 'Product is currently being synced'
      },
      synced: { 
        color: 'bg-green-100 text-green-800 border-green-200', 
        icon: CheckCircle, 
        text: 'Synced',
        title: 'Product successfully synced'
      },
      error: { 
        color: 'bg-red-100 text-red-800 border-red-200', 
        icon: XCircle, 
        text: 'Error',
        title: lastSyncError || 'Sync failed with unknown error'
      },
    };
    
    const variant = variants[status];
    const Icon = variant.icon;
    
    return (
      <Badge 
        className={`${variant.color} inline-flex items-center gap-1 cursor-help`}
        title={variant.title}
      >
        <Icon className={`h-3 w-3 ${status === 'syncing' ? 'animate-spin' : ''}`} />
        {variant.text}
      </Badge>
    );
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
          <div className="flex items-center gap-2">
            {autoRefresh && (
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Auto-updating
              </div>
            )}
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{pagination.total}</div>
          <p className="text-xs text-muted-foreground">
            Products in master catalog
            {autoRefresh && ' • Live updates enabled'}
          </p>
        </CardContent>
      </Card>

      {/* Progress Bar */}
      {(getSyncingCount() > 0 || batchSyncing) && (
        <ProgressBar
          current={batchSyncing ? 0 : getTotalProducts() - getSyncingCount()}
          total={batchSyncing ? selectedProducts.size : getTotalProducts()}
          isActive={true}
        />
      )}

      {/* Search and Controls */}
      <div className="flex items-center justify-between space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-8"
          />
        </div>
        
        <div className="flex items-center gap-2">
          {selectedProducts.size > 0 && (
            <Button
              type="button"
              onClick={handleBatchSync}
              disabled={batchSyncing}
              className="flex items-center gap-2"
            >
              {batchSyncing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Syncing {selectedProducts.size} products...
                </>
              ) : (
                <>
                  Sync Selected ({selectedProducts.size})
                </>
              )}
            </Button>
          )}
          
          {currentSyncId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSyncLogOpen(true)}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              View Sync Log
            </Button>
          )}
          
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const response = await fetch('/api/debug/products');
                const result = await response.json();
                console.log('Debug info:', result);
                toast.success('Debug info logged to console');
              } catch (error) {
                console.error('Debug error:', error);
                toast.error('Debug failed');
              }
            }}
            className="flex items-center gap-2"
          >
            Debug
          </Button>
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
                  {searchQuery ? (
                    <div className="text-sm text-muted-foreground mt-1">
                      Try adjusting your search query
                    </div>
                  ) : (
                    <div className="mt-4">
                      <div className="space-y-2">
                        <Button
                          type="button"
                          onClick={async () => {
                            try {
                              const response = await fetch('/api/test/simple-products', {
                                method: 'POST',
                              });
                              const result = await response.json();
                              if (result.success) {
                                toast.success(result.data.message || 'Added test products successfully');
                                loadProducts();
                              } else {
                                toast.error('Failed to add test products: ' + result.error?.message);
                              }
                            } catch (error) {
                              toast.error('Error adding test products');
                            }
                          }}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Add 5 Test Products
                        </Button>
                        
                        <Button
                          type="button"
                          onClick={async () => {
                            try {
                              const response = await fetch('/api/test/simple-products');
                              const result = await response.json();
                              console.log('Simple products test:', result);
                              if (result.success) {
                                toast.success(`Found ${result.data.count} products in database`);
                              } else {
                                toast.error('Test failed: ' + result.error?.message);
                              }
                            } catch (error) {
                              toast.error('Test error');
                            }
                          }}
                          variant="outline"
                          className="ml-2"
                        >
                          Test Database
                        </Button>
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">
                        Click to add 5 sample products for testing the dashboard
                      </div>
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
                      <th className="text-left p-3 font-medium w-12">
                        <Checkbox
                          checked={selectedProducts.size === products.length && products.length > 0}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all products"
                        />
                      </th>
                      <th className="text-left p-3 font-medium">ID</th>
                      <th className="text-left p-3 font-medium">Title</th>
                      <th className="text-left p-3 font-medium">Master Price</th>
                      <th className="text-left p-3 font-medium">Shopee Price</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Last Sync</th>
                      <th className="text-left p-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="border-b hover:bg-muted/50">
                        <td className="p-3">
                          <Checkbox
                            checked={selectedProducts.has(product.id)}
                            onCheckedChange={(checked) => handleSelectProduct(product.id, checked as boolean)}
                            aria-label={`Select ${product.title}`}
                          />
                        </td>
                        <td className="p-3">
                          <div className="font-mono text-sm text-muted-foreground">
                            {product.id.slice(0, 8)}...
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-medium max-w-xs truncate">
                            {product.title}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-medium">
                            {formatPrice(product.base_price)}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-medium">
                            {formatPrice(product.shopee_price)}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            {getStatusBadge(product.status, product.last_sync_error)}
                            {product.status === 'synced' && product.last_synced_at && (
                              <div className="text-xs text-green-600 font-medium">
                                ✓ {formatRelativeTime(product.last_synced_at)}
                              </div>
                            )}
                            {product.status === 'error' && product.last_sync_error && (
                              <div className="text-xs text-red-600 max-w-xs truncate bg-red-50 px-1 py-0.5 rounded" title={product.last_sync_error}>
                                {product.last_sync_error}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-sm text-muted-foreground">
                            {formatRelativeTime(product.last_synced_at)}
                          </div>
                        </td>
                        <td className="p-3">
                          <SyncErrorBoundary>
                            <SyncButton
                              productId={product.id}
                              currentStatus={product.status}
                              onSyncComplete={loadProducts}
                              onSyncStart={handleSyncStart}
                            />
                          </SyncErrorBoundary>
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
                        <div className="flex items-start gap-3 flex-1">
                          <Checkbox
                            checked={selectedProducts.has(product.id)}
                            onCheckedChange={(checked) => handleSelectProduct(product.id, checked as boolean)}
                            aria-label={`Select ${product.title}`}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="font-medium">
                              {product.title}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ID: {product.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                        {getStatusBadge(product.status, product.last_sync_error)}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-muted-foreground">Master Price</div>
                          <div className="font-medium">
                            {formatPrice(product.base_price)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Shopee Price</div>
                          <div className="font-medium">
                            {formatPrice(product.shopee_price)}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="text-sm text-muted-foreground">
                          Last sync: {formatRelativeTime(product.last_synced_at)}
                        </div>
                        <SyncErrorBoundary>
                          <SyncButton
                            productId={product.id}
                            currentStatus={product.status}
                            onSyncComplete={loadProducts}
                            onSyncStart={handleSyncStart}
                          />
                        </SyncErrorBoundary>
                      </div>

                      {product.status === 'error' && product.last_sync_error && (
                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                          Error: {product.last_sync_error}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
              
              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="mt-6">
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

      {/* Sync Log Drawer */}
      <SyncLogDrawer
        syncId={currentSyncId}
        isOpen={syncLogOpen}
        onClose={() => setSyncLogOpen(false)}
      />
    </div>
  );
}