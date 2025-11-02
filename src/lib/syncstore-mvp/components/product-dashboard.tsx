/**
 * SyncStore MVP Product Dashboard
 * 
 * This component provides a comprehensive product management interface
 * with filtering, sorting, bulk operations, and sync capabilities.
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Search, 
  RefreshCw, 
  Download, 
  Upload, 
  Trash2,
  Edit,
  Eye,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Filter,
  SortAsc,
  SortDesc,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Simple debounce hook implementation
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============================================================================
// Types and Interfaces
// ============================================================================

interface ProductDashboardProps {
  storeId: string;
  organizationId: string;
}

interface ProductFilters {
  search: string;
  status: 'all' | 'active' | 'inactive';
  sortBy: 'name' | 'price' | 'stock' | 'lastSyncAt';
  sortOrder: 'asc' | 'desc';
}

interface MockProduct {
  id: string;
  platformProductId: string;
  name: string;
  description?: string;
  sku: string;
  price: number;
  stock: number;
  images: string[];
  status: 'active' | 'inactive';
  lastSyncAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Product Dashboard Component
// ============================================================================

export function ProductDashboard({ storeId, organizationId }: ProductDashboardProps) {
  const { toast } = useToast();
  const [filters, setFilters] = useState<ProductFilters>({
    search: '',
    status: 'all',
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Debounce search input
  const debouncedSearch = useDebounce(filters.search, 500);

  // Mock data for demonstration
  const mockProducts: MockProduct[] = [
    {
      id: '1',
      platformProductId: 'shopee_123',
      name: 'Smartphone Samsung Galaxy A54',
      description: 'Smartphone terbaru dengan kamera 50MP',
      sku: 'SAMSUNG-A54-001',
      price: 4500000,
      stock: 25,
      images: ['https://via.placeholder.com/150'],
      status: 'active',
      lastSyncAt: new Date(Date.now() - 30 * 60 * 1000),
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 30 * 60 * 1000),
    },
    {
      id: '2',
      platformProductId: 'shopee_124',
      name: 'Laptop Gaming ASUS ROG',
      description: 'Laptop gaming dengan RTX 4060',
      sku: 'ASUS-ROG-001',
      price: 15000000,
      stock: 8,
      images: ['https://via.placeholder.com/150'],
      status: 'active',
      lastSyncAt: new Date(Date.now() - 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 60 * 60 * 1000),
    },
    {
      id: '3',
      platformProductId: 'shopee_125',
      name: 'Mouse Wireless Logitech',
      description: 'Mouse wireless dengan sensor presisi tinggi',
      sku: 'LOGITECH-MX3-001',
      price: 850000,
      stock: 0,
      images: ['https://via.placeholder.com/150'],
      status: 'inactive',
      lastSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      id: '4',
      platformProductId: 'shopee_126',
      name: 'Headphone Sony WH-1000XM4',
      description: 'Headphone noise cancelling premium',
      sku: 'SONY-WH1000XM4-001',
      price: 3200000,
      stock: 15,
      images: ['https://via.placeholder.com/150'],
      status: 'active',
      lastSyncAt: new Date(Date.now() - 45 * 60 * 1000),
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 45 * 60 * 1000),
    },
    {
      id: '5',
      platformProductId: 'shopee_127',
      name: 'Keyboard Mechanical Keychron K2',
      description: 'Keyboard mechanical wireless',
      sku: 'KEYCHRON-K2-001',
      price: 1250000,
      stock: 12,
      images: ['https://via.placeholder.com/150'],
      status: 'active',
      lastSyncAt: new Date(Date.now() - 90 * 60 * 1000),
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 90 * 60 * 1000),
    },
  ];

  // Filter and sort products
  const filteredProducts = mockProducts
    .filter(product => {
      const matchesSearch = !debouncedSearch || 
        product.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        product.sku.toLowerCase().includes(debouncedSearch.toLowerCase());
      
      const matchesStatus = filters.status === 'all' || product.status === filters.status;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const aValue = a[filters.sortBy];
      const bValue = b[filters.sortBy];
      
      if (filters.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleSyncProducts = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast({
        title: 'Sync Started',
        description: `Product synchronization started for ${filteredProducts.length} products`,
      });
    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: 'Failed to start product synchronization',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectProduct = (productId: string, checked: boolean) => {
    if (checked) {
      setSelectedProducts(prev => [...prev, productId]);
    } else {
      setSelectedProducts(prev => prev.filter(id => id !== productId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(filteredProducts.map(p => p.id));
    } else {
      setSelectedProducts([]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedProducts.length === 0) return;
    
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: 'Products Deleted',
        description: `${selectedProducts.length} products have been deleted`,
      });
      setSelectedProducts([]);
    } catch (error) {
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete products',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Active</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300">Inactive</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) {
      return <Badge className="bg-red-100 text-red-800 border-red-300">Out of Stock</Badge>;
    } else if (stock < 10) {
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Low Stock</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-800 border-green-300">In Stock</Badge>;
    }
  };

  // ============================================================================
  // Statistics
  // ============================================================================

  const stats = {
    total: filteredProducts.length,
    active: filteredProducts.filter(p => p.status === 'active').length,
    inactive: filteredProducts.filter(p => p.status === 'inactive').length,
    lowStock: filteredProducts.filter(p => p.stock < 10 && p.stock > 0).length,
    outOfStock: filteredProducts.filter(p => p.stock === 0).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Product Dashboard</h2>
          <p className="text-muted-foreground">
            Manage and monitor your store products
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSyncProducts} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Sync Products
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Inactive</p>
                <p className="text-2xl font-bold text-gray-600">{stats.inactive}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.lowStock}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Out of Stock</p>
                <p className="text-2xl font-bold text-red-600">{stats.outOfStock}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Product Management</CardTitle>
          <CardDescription>
            Filter, search, and manage your products
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <Select
              value={filters.status}
              onValueChange={(value: any) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select
              value={filters.sortBy}
              onValueChange={(value: any) => setFilters(prev => ({ ...prev, sortBy: value }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="stock">Stock</SelectItem>
                <SelectItem value="lastSyncAt">Last Sync</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => setFilters(prev => ({ 
                ...prev, 
                sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' 
              }))}
            >
              {filters.sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
            </Button>
          </div>

          {/* Bulk Actions */}
          {selectedProducts.length > 0 && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium">
                {selectedProducts.length} products selected
              </span>
              <Button size="sm" variant="destructive" onClick={handleDeleteSelected}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
            </div>
          )}

          {/* Products Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={(checked) => handleSelectProduct(product.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Package className="h-5 w-5 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {product.description?.substring(0, 50)}...
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {product.sku}
                      </code>
                    </TableCell>
                    <TableCell>{formatCurrency(product.price)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{product.stock}</span>
                        {getStockStatus(product.stock)}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(product.status)}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(product.lastSyncAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Products Found</h3>
              <p className="text-muted-foreground">
                {filters.search || filters.status !== 'all' 
                  ? 'Try adjusting your filters to see more products.'
                  : 'Start by syncing products from your store.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ProductDashboard;