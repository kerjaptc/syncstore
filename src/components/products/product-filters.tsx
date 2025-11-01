'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Filter, 
  X,
  SlidersHorizontal
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';

interface ProductFiltersProps {
  onFiltersChange: (filters: ProductFilters) => void;
  categories: string[];
  brands: string[];
}

export interface ProductFilters {
  search?: string;
  category?: string;
  brand?: string;
  isActive?: boolean;
  sortBy?: 'name' | 'sku' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export function ProductFilters({ onFiltersChange, categories, brands }: ProductFiltersProps) {
  const [filters, setFilters] = useState<ProductFilters>({
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      const newFilters = { ...filters };
      if (searchValue.trim()) {
        newFilters.search = searchValue.trim();
      } else {
        delete newFilters.search;
      }
      setFilters(newFilters);
      onFiltersChange(newFilters);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchValue]);

  const updateFilter = (key: keyof ProductFilters, value: any) => {
    const newFilters = { ...filters };
    if (value === undefined || value === '' || value === 'all') {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    const newFilters: ProductFilters = {
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };
    setFilters(newFilters);
    setSearchValue('');
    onFiltersChange(newFilters);
  };

  const activeFiltersCount = Object.keys(filters).filter(
    key => key !== 'sortBy' && key !== 'sortOrder' && filters[key as keyof ProductFilters] !== undefined
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-10"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Filters</h4>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear all
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={filters.category || 'all'}
                    onValueChange={(value) => updateFilter('category', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="brand">Brand</Label>
                  <Select
                    value={filters.brand || 'all'}
                    onValueChange={(value) => updateFilter('brand', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All brands" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All brands</SelectItem>
                      {brands.map((brand) => (
                        <SelectItem key={brand} value={brand}>
                          {brand}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={filters.isActive === undefined ? 'all' : filters.isActive.toString()}
                    onValueChange={(value) => 
                      updateFilter('isActive', value === 'all' ? undefined : value === 'true')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Select
          value={`${filters.sortBy}-${filters.sortOrder}`}
          onValueChange={(value) => {
            const [sortBy, sortOrder] = value.split('-') as [
              'name' | 'sku' | 'createdAt' | 'updatedAt',
              'asc' | 'desc'
            ];
            updateFilter('sortBy', sortBy);
            updateFilter('sortOrder', sortOrder);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt-desc">Newest first</SelectItem>
            <SelectItem value="createdAt-asc">Oldest first</SelectItem>
            <SelectItem value="name-asc">Name A-Z</SelectItem>
            <SelectItem value="name-desc">Name Z-A</SelectItem>
            <SelectItem value="sku-asc">SKU A-Z</SelectItem>
            <SelectItem value="sku-desc">SKU Z-A</SelectItem>
            <SelectItem value="updatedAt-desc">Recently updated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {filters.category && (
            <Badge variant="secondary" className="gap-1">
              Category: {filters.category}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-1"
                onClick={() => updateFilter('category', undefined)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.brand && (
            <Badge variant="secondary" className="gap-1">
              Brand: {filters.brand}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-1"
                onClick={() => updateFilter('brand', undefined)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.isActive !== undefined && (
            <Badge variant="secondary" className="gap-1">
              Status: {filters.isActive ? 'Active' : 'Inactive'}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-1"
                onClick={() => updateFilter('isActive', undefined)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}