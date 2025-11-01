'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Package, 
  AlertTriangle, 
  Edit,
  History,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PaginatedResponse } from '@/types';

interface InventoryItem {
  inventoryItem: {
    id: string;
    quantityOnHand: number;
    quantityReserved: number;
    reorderPoint: number;
    reorderQuantity: number;
    updatedAt: string;
  };
  productVariant: {
    id: string;
    variantSku: string;
    name: string;
    costPrice: string | null;
  };
  product: {
    id: string;
    sku: string;
    name: string;
  };
  availableQuantity: number;
}

interface InventoryDataTableProps {
  locationId?: string;
  onEditItem?: (item: InventoryItem) => void;
  onViewHistory?: (productVariantId: string, locationId: string) => void;
}

export function InventoryDataTable({ 
  locationId, 
  onEditItem, 
  onViewHistory 
}: InventoryDataTableProps) {
  const [data, setData] = useState<PaginatedResponse<InventoryItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });

      if (locationId) params.append('locationId', locationId);
      if (search) params.append('search', search);
      if (lowStockOnly) params.append('lowStockOnly', 'true');

      const response = await fetch(`/api/inventory?${params}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [locationId, search, lowStockOnly, page]);

  const getStockStatus = (item: InventoryItem) => {
    if (item.availableQuantity === 0) {
      return { label: 'Out of Stock', variant: 'destructive' as const, color: 'text-red-600' };
    }
    if (item.availableQuantity <= item.inventoryItem.reorderPoint) {
      return { label: 'Low Stock', variant: 'secondary' as const, color: 'text-orange-600' };
    }
    return { label: 'In Stock', variant: 'default' as const, color: 'text-green-600' };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 w-32 bg-muted animate-pulse rounded" />
          <div className="h-4 w-48 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory Items</CardTitle>
        <CardDescription>
          Manage stock levels and monitor inventory across locations
        </CardDescription>
        
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products or SKUs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Button
            variant={lowStockOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setLowStockOnly(!lowStockOnly)}
          >
            <Filter className="h-4 w-4 mr-2" />
            {lowStockOnly ? 'Show All' : 'Low Stock Only'}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {!data || data.data.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {search || lowStockOnly ? 'No items match your filters' : 'No inventory items found'}
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Reorder Point</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((item) => {
                  const status = getStockStatus(item);
                  return (
                    <TableRow key={item.inventoryItem.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.product.name}</div>
                          {item.productVariant.name !== item.product.name && (
                            <div className="text-sm text-muted-foreground">
                              {item.productVariant.name}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-mono text-sm">{item.product.sku}</div>
                          {item.productVariant.variantSku !== item.product.sku && (
                            <div className="font-mono text-xs text-muted-foreground">
                              {item.productVariant.variantSku}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.inventoryItem.quantityOnHand.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.inventoryItem.quantityReserved > 0 ? (
                          <span className="text-blue-600">
                            {item.inventoryItem.quantityReserved.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className={cn("text-right font-medium", status.color)}>
                        {item.availableQuantity.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.inventoryItem.reorderPoint > 0 ? (
                          item.inventoryItem.reorderPoint.toLocaleString()
                        ) : (
                          <span className="text-muted-foreground">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>
                          {status.label}
                        </Badge>
                        {item.availableQuantity <= item.inventoryItem.reorderPoint && 
                         item.inventoryItem.reorderPoint > 0 && (
                          <AlertTriangle className="h-4 w-4 text-orange-500 ml-2 inline" />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditItem?.(item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewHistory?.(
                              item.productVariant.id, 
                              locationId || ''
                            )}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, data.pagination.total)} of{' '}
                  {data.pagination.total} items
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= data.pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}