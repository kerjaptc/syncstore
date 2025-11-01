'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
interface ProductFiltersProps {
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

/**
 * Product filters sidebar component
 */
export function ProductFilters({ searchParams }: ProductFiltersProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState(searchParams.minPrice || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.maxPrice || '');
  const router = useRouter();

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [categoriesResponse, brandsResponse] = await Promise.all([
          fetch('/api/storefront/categories'),
          fetch('/api/storefront/brands'),
        ]);
        
        const categoryList = categoriesResponse.ok ? await categoriesResponse.json() : [];
        const brandList = brandsResponse.ok ? await brandsResponse.json() : [];
        setCategories(categoryList);
        setBrands(brandList);
      } catch (error) {
        console.error('Error loading filter options:', error);
      }
    };

    loadFilterOptions();
  }, []);

  const updateFilters = (updates: Partial<typeof searchParams>) => {
    const params = new URLSearchParams();
    
    // Preserve existing params and apply updates
    const newParams = { ...searchParams, ...updates };
    
    Object.entries(newParams).forEach(([key, value]) => {
      if (value && key !== 'page') { // Reset page when filters change
        params.set(key, value);
      }
    });

    router.push(`/store/products?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push('/store/products');
  };

  const handlePriceFilter = () => {
    updateFilters({
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
    });
  };

  const hasActiveFilters = searchParams.category || searchParams.brand || searchParams.minPrice || searchParams.maxPrice;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Filters</CardTitle>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Categories */}
        {categories.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3">Categories</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {categories.map((category) => (
                <div key={category} className="flex items-center space-x-2">
                  <Checkbox
                    id={`category-${category}`}
                    checked={searchParams.category === category}
                    onCheckedChange={(checked) => {
                      updateFilters({
                        category: checked ? category : undefined,
                      });
                    }}
                  />
                  <Label 
                    htmlFor={`category-${category}`}
                    className="text-sm cursor-pointer"
                  >
                    {category}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Brands */}
        {brands.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3">Brands</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {brands.map((brand) => (
                <div key={brand} className="flex items-center space-x-2">
                  <Checkbox
                    id={`brand-${brand}`}
                    checked={searchParams.brand === brand}
                    onCheckedChange={(checked) => {
                      updateFilters({
                        brand: checked ? brand : undefined,
                      });
                    }}
                  />
                  <Label 
                    htmlFor={`brand-${brand}`}
                    className="text-sm cursor-pointer"
                  >
                    {brand}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Price Range */}
        <div>
          <h3 className="font-semibold mb-3">Price Range</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="min-price" className="text-xs">Min Price</Label>
                <Input
                  id="min-price"
                  type="number"
                  placeholder="0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="max-price" className="text-xs">Max Price</Label>
                <Input
                  id="max-price"
                  type="number"
                  placeholder="1000000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={handlePriceFilter}
            >
              Apply Price Filter
            </Button>
          </div>
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <>
            <Separator />
            <div>
              <h3 className="font-semibold mb-3">Active Filters</h3>
              <div className="space-y-2">
                {searchParams.category && (
                  <div className="flex items-center justify-between bg-muted p-2 rounded text-sm">
                    <span>Category: {searchParams.category}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateFilters({ category: undefined })}
                    >
                      ×
                    </Button>
                  </div>
                )}
                {searchParams.brand && (
                  <div className="flex items-center justify-between bg-muted p-2 rounded text-sm">
                    <span>Brand: {searchParams.brand}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateFilters({ brand: undefined })}
                    >
                      ×
                    </Button>
                  </div>
                )}
                {(searchParams.minPrice || searchParams.maxPrice) && (
                  <div className="flex items-center justify-between bg-muted p-2 rounded text-sm">
                    <span>
                      Price: {searchParams.minPrice || '0'} - {searchParams.maxPrice || '∞'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateFilters({ minPrice: undefined, maxPrice: undefined })}
                    >
                      ×
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}