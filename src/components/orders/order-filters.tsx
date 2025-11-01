'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { 
  Filter, 
  X, 
  CalendarIcon,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { OrderStatus, FinancialStatus, FulfillmentStatus, StoreWithRelations } from '@/types';

interface OrderFiltersProps {
  stores: StoreWithRelations[];
  filters: {
    search?: string;
    storeId?: string;
    status?: OrderStatus;
    financialStatus?: FinancialStatus;
    fulfillmentStatus?: FulfillmentStatus;
    startDate?: Date;
    endDate?: Date;
  };
  onFiltersChange: (filters: any) => void;
  onClearFilters: () => void;
}

export function OrderFilters({ 
  stores, 
  filters, 
  onFiltersChange, 
  onClearFilters 
}: OrderFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = (key: string, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const removeFilter = (key: string) => {
    const newFilters = { ...filters };
    delete newFilters[key as keyof typeof filters];
    onFiltersChange(newFilters);
  };

  const activeFiltersCount = Object.keys(filters).filter(key => 
    filters[key as keyof typeof filters] !== undefined && 
    filters[key as keyof typeof filters] !== ''
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders by number, customer name, or platform order ID..."
            value={filters.search || ''}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onClearFilters();
                      setIsOpen(false);
                    }}
                  >
                    Clear all
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="store">Store</Label>
                  <Select
                    value={filters.storeId || 'all'}
                    onValueChange={(value) => updateFilter('storeId', value === 'all' ? undefined : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All stores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All stores</SelectItem>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name} ({store.platform.displayName})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status">Order Status</Label>
                  <Select
                    value={filters.status || 'all'}
                    onValueChange={(value) => updateFilter('status', value === 'all' ? undefined : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="financialStatus">Financial Status</Label>
                  <Select
                    value={filters.financialStatus || 'all'}
                    onValueChange={(value) => updateFilter('financialStatus', value === 'all' ? undefined : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All financial statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All financial statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="fulfillmentStatus">Fulfillment Status</Label>
                  <Select
                    value={filters.fulfillmentStatus || 'all'}
                    onValueChange={(value) => updateFilter('fulfillmentStatus', value === 'all' ? undefined : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All fulfillment statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All fulfillment statuses</SelectItem>
                      <SelectItem value="unfulfilled">Unfulfilled</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="fulfilled">Fulfilled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filters.startDate ? (
                            format(filters.startDate, 'MMM dd, yyyy')
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={filters.startDate}
                          onSelect={(date) => updateFilter('startDate', date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filters.endDate ? (
                            format(filters.endDate, 'MMM dd, yyyy')
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={filters.endDate}
                          onSelect={(date) => updateFilter('endDate', date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active filters display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.storeId && (
            <Badge variant="secondary" className="gap-1">
              Store: {stores.find(s => s.id === filters.storeId)?.name}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => removeFilter('storeId')}
              />
            </Badge>
          )}
          {filters.status && (
            <Badge variant="secondary" className="gap-1">
              Status: {filters.status}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => removeFilter('status')}
              />
            </Badge>
          )}
          {filters.financialStatus && (
            <Badge variant="secondary" className="gap-1">
              Financial: {filters.financialStatus}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => removeFilter('financialStatus')}
              />
            </Badge>
          )}
          {filters.fulfillmentStatus && (
            <Badge variant="secondary" className="gap-1">
              Fulfillment: {filters.fulfillmentStatus}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => removeFilter('fulfillmentStatus')}
              />
            </Badge>
          )}
          {filters.startDate && (
            <Badge variant="secondary" className="gap-1">
              From: {format(filters.startDate, 'MMM dd, yyyy')}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => removeFilter('startDate')}
              />
            </Badge>
          )}
          {filters.endDate && (
            <Badge variant="secondary" className="gap-1">
              To: {format(filters.endDate, 'MMM dd, yyyy')}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => removeFilter('endDate')}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}