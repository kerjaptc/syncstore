'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Package,
  Download,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface InventoryValuation {
  totalValue: number;
  totalQuantity: number;
  valueByLocation: Array<{
    locationId: string;
    locationName: string;
    value: number;
    quantity: number;
  }>;
}

interface InventoryReportsProps {
  className?: string;
}

export function InventoryReports({ className }: InventoryReportsProps) {
  const [valuation, setValuation] = useState<InventoryValuation | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchValuation = async () => {
    try {
      setLoading(true);
      // This would be implemented in the inventory service
      // For now, we'll use mock data
      const mockData: InventoryValuation = {
        totalValue: 125000,
        totalQuantity: 2500,
        valueByLocation: [
          { locationId: '1', locationName: 'Main Warehouse', value: 85000, quantity: 1700 },
          { locationId: '2', locationName: 'Retail Store', value: 25000, quantity: 500 },
          { locationId: '3', locationName: 'Distribution Center', value: 15000, quantity: 300 },
        ],
      };
      setValuation(mockData);
    } catch (error) {
      console.error('Error fetching inventory valuation:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchValuation();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getLocationPercentage = (locationValue: number) => {
    if (!valuation?.totalValue) return 0;
    return (locationValue / valuation.totalValue) * 100;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="h-6 w-32 bg-muted animate-pulse rounded" />
          <div className="h-4 w-48 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Inventory Reports
            </CardTitle>
            <CardDescription>
              Stock valuation and movement analysis
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchValuation}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Total Valuation */}
        {valuation && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Total Inventory Value</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(valuation.totalValue)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {valuation.totalQuantity.toLocaleString()} total units
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Average Unit Value</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(valuation.totalValue / valuation.totalQuantity)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Per unit across all locations
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Value by Location */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Value by Location</h3>
              <div className="space-y-3">
                {valuation.valueByLocation.map((location) => {
                  const percentage = getLocationPercentage(location.value);
                  return (
                    <div key={location.locationId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">{location.locationName}</div>
                        <Badge variant="outline">
                          {percentage.toFixed(1)}% of total
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Value:</span>
                          <span className="ml-2 font-medium text-green-600">
                            {formatCurrency(location.value)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Quantity:</span>
                          <span className="ml-2 font-medium">
                            {location.quantity.toLocaleString()} units
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <div className="text-lg font-semibold">Stock Turnover</div>
                  <div className="text-2xl font-bold text-green-600">4.2x</div>
                  <p className="text-xs text-muted-foreground">Annual rate</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <Package className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-lg font-semibold">Days of Supply</div>
                  <div className="text-2xl font-bold text-blue-600">87</div>
                  <p className="text-xs text-muted-foreground">Average days</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <TrendingDown className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                  <div className="text-lg font-semibold">Carrying Cost</div>
                  <div className="text-2xl font-bold text-orange-600">12.5%</div>
                  <p className="text-xs text-muted-foreground">Of inventory value</p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}