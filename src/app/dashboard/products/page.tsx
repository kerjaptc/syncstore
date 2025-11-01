'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Plus, 
  Package, 
  Upload, 

  BarChart3,
  AlertTriangle
} from 'lucide-react';
import { ProductDataTable } from '@/components/products/product-data-table';
import { ProductFilters, type ProductFilters as ProductFiltersType } from '@/components/products/product-filters';
import { ProductFormDialog } from '@/components/products/product-form-dialog';
import { BulkOperationsDialog } from '@/components/products/bulk-operations-dialog';
import { PlatformMappingDialog } from '@/components/products/platform-mapping-dialog';
import { CustomPagination } from '@/components/ui/custom-pagination';
import { ProductWithVariants, StoreWithRelations, PaginatedResponse } from '@/types';
import { toast } from 'sonner';
import { useAuth } from '@clerk/nextjs';

export default function ProductsPage() {
  const { isLoaded } = useAuth();
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [stores, setStores] = useState<StoreWithRelations[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  
  // Dialog states
  const [showProductForm, setShowProductForm] = useState(false);
  const [showBulkOperations, setShowBulkOperations] = useState(false);
  const [showPlatformMapping, setShowPlatformMapping] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithVariants | undefined>();
  
  // Filters
  const [filters, setFilters] = useState<ProductFiltersType>({
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  useEffect(() => {
    if (isLoaded) {
      loadProducts();
      loadCategories();
      loadBrands();
      loadStores();
    }
  }, [isLoaded, filters, pagination.page]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy: filters.sortBy || 'createdAt',
        sortOrder: filters.sortOrder || 'desc',
      });

      if (filters.search) params.append('search', filters.search);
      if (filters.category) params.append('category', filters.category);
      if (filters.brand) params.append('brand', filters.brand);
      if (filters.isActive !== undefined) params.append('isActive', filters.isActive.toString());

      const response = await fetch(`/api/products?${params}`);
      if (!response.ok) {
        throw new Error('Failed to load products');
      }

      const result = await response.json();
      const data: PaginatedResponse<ProductWithVariants> = result.data;
      
      setProducts(data.data);
      setPagination(data.pagination);
    } catch (error) {
      toast.error('Failed to load products');
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/products/categories');
      if (response.ok) {
        const result = await response.json();
        setCategories(result.data);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadBrands = async () => {
    try {
      const response = await fetch('/api/products/brands');
      if (response.ok) {
        const result = await response.json();
        setBrands(result.data);
      }
    } catch (error) {
      console.error('Error loading brands:', error);
    }
  };

  const loadStores = async () => {
    try {
      const response = await fetch('/api/stores');
      if (response.ok) {
        const result = await response.json();
        setStores(result.data);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const handleFiltersChange = (newFilters: ProductFiltersType) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const handleCreateProduct = async (data: Record<string, any>) => {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to create product');
    }

    await loadProducts();
    await loadCategories();
    await loadBrands();
  };

  const handleUpdateProduct = async (data: Record<string, any>) => {
    if (!selectedProduct) return;

    const response = await fetch(`/api/products/${selectedProduct.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to update product');
    }

    await loadProducts();
    await loadCategories();
    await loadBrands();
  };

  const handleEditProduct = (product: ProductWithVariants) => {
    setSelectedProduct(product);
    setShowProductForm(true);
  };

  const handleViewProduct = (product: ProductWithVariants) => {
    // For now, just show the edit dialog
    handleEditProduct(product);
  };

  const handleDeleteProduct = async (product: ProductWithVariants) => {
    if (!confirm(`Are you sure you want to delete "${product.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete product');
      }

      toast.success('Product deleted successfully');
      await loadProducts();
    } catch (error) {
      toast.error('Failed to delete product');
    }
  };

  const handleDuplicateProduct = (product: ProductWithVariants) => {
    const duplicateData = {
      ...product,
      name: `${product.name} (Copy)`,
      sku: '', // Let it auto-generate
    };
    setSelectedProduct(duplicateData as ProductWithVariants);
    setShowProductForm(true);
  };



  const handleProductFormClose = () => {
    setShowProductForm(false);
    setSelectedProduct(undefined);
  };

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">
            Manage your product catalog and platform mappings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowBulkOperations(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Bulk Operations
          </Button>
          <Button onClick={() => setShowProductForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination.total}</div>
            <p className="text-xs text-muted-foreground">
              Active products in catalog
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
            <p className="text-xs text-muted-foreground">
              Product categories
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Brands</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{brands.length}</div>
            <p className="text-xs text-muted-foreground">
              Product brands
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected Stores</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stores.length}</div>
            <p className="text-xs text-muted-foreground">
              Platform connections
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <ProductFilters
        onFiltersChange={handleFiltersChange}
        categories={categories}
        brands={brands}
      />

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>
            Manage your product catalog, variants, and platform mappings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading products...</div>
            </div>
          ) : (
            <>
              <ProductDataTable
                products={products}
                onEdit={handleEditProduct}
                onView={handleViewProduct}
                onDelete={handleDeleteProduct}
                onDuplicate={handleDuplicateProduct}
              />
              
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
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ProductFormDialog
        open={showProductForm}
        onOpenChange={handleProductFormClose}
        product={selectedProduct}
        onSubmit={selectedProduct?.id ? handleUpdateProduct : handleCreateProduct}
        categories={categories}
        brands={brands}
      />

      <BulkOperationsDialog
        open={showBulkOperations}
        onOpenChange={setShowBulkOperations}
        onImportComplete={loadProducts}
      />

      {selectedProduct && (
        <PlatformMappingDialog
          open={showPlatformMapping}
          onOpenChange={setShowPlatformMapping}
          product={selectedProduct}
          stores={stores}
        />
      )}
    </div>
  );
}