'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  stock: number;
  syncStatus: 'pending' | 'synced' | 'syncing' | 'error';
  lastSyncAt: string | null;
}

interface SyncStatus {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
}

export default function Phase4Dashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Fetch products
  useEffect(() => {
    fetchProducts();
  }, [page, search]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search }),
      });

      const response = await fetch(`/api/products-phase4?${params}`);
      const data = await response.json();

      if (data.success) {
        setProducts(data.data);
        setTotalPages(data.meta.pagination.totalPages);
      } else {
        toast.error('Failed to load products');
      }
    } catch (error) {
      toast.error('Error loading products');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  const handleSelectProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleSync = async () => {
    if (selectedProducts.size === 0) {
      toast.error('Please select products to sync');
      return;
    }

    try {
      setSyncing(true);
      const response = await fetch('/api/sync-phase4/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: Array.from(selectedProducts),
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Sync started: ${data.data.syncId}`);
        setSyncStatus(data.data);
        // Poll for status
        pollSyncStatus(data.data.syncId);
      } else {
        toast.error('Failed to start sync');
      }
    } catch (error) {
      toast.error('Error starting sync');
      console.error(error);
    } finally {
      setSyncing(false);
    }
  };

  const pollSyncStatus = async (syncId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/sync-phase4/status?syncId=${syncId}`);
        const data = await response.json();

        if (data.success) {
          setSyncStatus(data.data);

          if (data.data.status === 'completed' || data.data.status === 'failed') {
            clearInterval(interval);
            toast.success(`Sync ${data.data.status}`);
            fetchProducts(); // Refresh products
          }
        }
      } catch (error) {
        console.error('Error polling sync status:', error);
        clearInterval(interval);
      }
    }, 1000);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      synced: 'default',
      pending: 'secondary',
      syncing: 'outline',
      error: 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Phase 4 Dashboard</h1>
          <p className="text-muted-foreground">Product sync and management</p>
        </div>
        <Button onClick={fetchProducts} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Sync Status Card */}
      {syncStatus && syncStatus.status === 'running' && (
        <Card>
          <CardHeader>
            <CardTitle>Sync in Progress</CardTitle>
            <CardDescription>
              {syncStatus.progress.completed} of {syncStatus.progress.total} products synced
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-secondary rounded-full h-2.5">
              <div
                className="bg-primary h-2.5 rounded-full transition-all"
                style={{ width: `${syncStatus.progress.percentage}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {syncStatus.progress.percentage.toFixed(0)}% complete
            </p>
          </CardContent>
        </Card>
      )}

      {/* Search and Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Input
              placeholder="Search products by name or SKU..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="flex-1"
            />
            <Button
              onClick={handleSync}
              disabled={selectedProducts.size === 0 || syncing}
            >
              Sync Selected ({selectedProducts.size})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>
            {products.length} products found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No products found. Run <code>npm run seed:products</code> to add products.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">
                        <Checkbox
                          checked={selectedProducts.size === products.length}
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                      <th className="text-left p-2">SKU</th>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Category</th>
                      <th className="text-left p-2">Brand</th>
                      <th className="text-right p-2">Price</th>
                      <th className="text-right p-2">Stock</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="border-b hover:bg-muted/50">
                        <td className="p-2">
                          <Checkbox
                            checked={selectedProducts.has(product.id)}
                            onCheckedChange={() => handleSelectProduct(product.id)}
                          />
                        </td>
                        <td className="p-2 font-mono text-sm">{product.sku}</td>
                        <td className="p-2">{product.name}</td>
                        <td className="p-2">{product.category}</td>
                        <td className="p-2">{product.brand}</td>
                        <td className="p-2 text-right">Rp {product.price.toFixed(2)}</td>
                        <td className="p-2 text-right">{product.stock}</td>
                        <td className="p-2">{getStatusBadge(product.syncStatus)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
