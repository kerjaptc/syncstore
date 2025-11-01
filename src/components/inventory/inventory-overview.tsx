'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  Warehouse,
  MapPin,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface InventorySummary {
  totalProducts: number;
  totalVariants: number;
  totalLocations: number;
  totalStockValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalQuantityOnHand: number;
  totalQuantityReserved: number;
  totalQuantityAvailable: number;
}

interface InventoryOverviewProps {
  onLocationSelect?: (locationId: string | null) => void;
  onShowAlerts?: () => void;
}

export function InventoryOverview({ onLocationSelect, onShowAlerts }: InventoryOverviewProps) {
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/inventory');
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Error fetching inventory summary:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              <div className="h-4 w-4 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded mb-1" />
              <div className="h-3 w-24 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-muted-foreground">Failed to load inventory summary</p>
        </CardContent>
      </Card>
    );
  }

  const alertsCount = summary.lowStockItems + summary.outOfStockItems;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inventory Overview</h2>
          <p className="text-muted-foreground">
            Monitor stock levels and manage inventory across all locations
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchSummary}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalProducts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {summary.totalVariants.toLocaleString()} variants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock on Hand</CardTitle>
            <Warehouse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalQuantityOnHand.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {summary.totalQuantityAvailable.toLocaleString()} available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locations</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalLocations}</div>
            <p className="text-xs text-muted-foreground">
              Active warehouses
            </p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-colors hover:bg-muted/50",
            alertsCount > 0 && "border-orange-200 bg-orange-50/50"
          )}
          onClick={onShowAlerts}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Alerts</CardTitle>
            <AlertTriangle className={cn(
              "h-4 w-4",
              alertsCount > 0 ? "text-orange-500" : "text-muted-foreground"
            )} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alertsCount}</div>
            <div className="flex items-center gap-2 text-xs">
              {summary.lowStockItems > 0 && (
                <Badge variant="outline" className="text-orange-600 border-orange-200">
                  {summary.lowStockItems} low stock
                </Badge>
              )}
              {summary.outOfStockItems > 0 && (
                <Badge variant="outline" className="text-red-600 border-red-200">
                  {summary.outOfStockItems} out of stock
                </Badge>
              )}
              {alertsCount === 0 && (
                <span className="text-muted-foreground">All good</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {summary.totalQuantityReserved > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Reserved Stock</CardTitle>
            <CardDescription>
              Stock currently reserved for pending orders
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold text-blue-600">
                {summary.totalQuantityReserved.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">
                units reserved across all locations
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}