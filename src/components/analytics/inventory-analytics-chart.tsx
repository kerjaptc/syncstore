'use client';

/**
 * Inventory Analytics Chart Component
 * Displays inventory turnover rates and stock level trends
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, TrendingUp, TrendingDown, AlertTriangle, BarChart3 } from 'lucide-react';
import { AnalyticsResult } from '@/types';
import { analyticsUtils } from '@/lib/analytics/utils';

interface InventoryAnalyticsChartProps {
  data: AnalyticsResult | null;
  dateRange: { start: Date; end: Date };
  isLoading: boolean;
}

export function InventoryAnalyticsChart({ 
  data, 
  dateRange, 
  isLoading 
}: InventoryAnalyticsChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Inventory Analytics
          </CardTitle>
          <CardDescription>Stock levels and turnover analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 border rounded-lg">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
            <Skeleton className="h-[300px] w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mock inventory data (in real implementation, this would come from the API)
  const inventoryMetrics = {
    totalProducts: 245,
    averageTurnover: 2.3,
    lowStockItems: 12,
    outOfStockItems: 3,
    topMovers: [
      { productName: 'Wireless Headphones', sku: 'WH-001', turnoverRate: 4.2, currentStock: 45 },
      { productName: 'Smartphone Case', sku: 'SC-002', turnoverRate: 3.8, currentStock: 120 },
      { productName: 'USB Cable', sku: 'UC-003', turnoverRate: 3.5, currentStock: 200 },
      { productName: 'Power Bank', sku: 'PB-004', turnoverRate: 3.1, currentStock: 80 },
      { productName: 'Screen Protector', sku: 'SP-005', turnoverRate: 2.9, currentStock: 150 },
    ],
    slowMovers: [
      { productName: 'Vintage Watch', sku: 'VW-001', turnoverRate: 0.2, currentStock: 25 },
      { productName: 'Leather Wallet', sku: 'LW-002', turnoverRate: 0.4, currentStock: 35 },
      { productName: 'Desk Lamp', sku: 'DL-003', turnoverRate: 0.6, currentStock: 15 },
    ],
    stockAlerts: [
      { productName: 'Wireless Mouse', sku: 'WM-001', currentStock: 5, reorderPoint: 10, status: 'low' },
      { productName: 'Keyboard', sku: 'KB-002', currentStock: 0, reorderPoint: 15, status: 'out' },
      { productName: 'Monitor Stand', sku: 'MS-003', currentStock: 8, reorderPoint: 12, status: 'low' },
    ],
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Inventory Analytics
        </CardTitle>
        <CardDescription>
          Stock levels and turnover analysis for {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-900">
                {inventoryMetrics.totalProducts}
              </div>
              <div className="text-sm text-blue-700">Total Products</div>
            </div>

            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-900">
                {inventoryMetrics.averageTurnover.toFixed(1)}x
              </div>
              <div className="text-sm text-green-700">Avg Turnover</div>
            </div>

            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-900">
                {inventoryMetrics.lowStockItems}
              </div>
              <div className="text-sm text-yellow-700">Low Stock Items</div>
            </div>

            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-900">
                {inventoryMetrics.outOfStockItems}
              </div>
              <div className="text-sm text-red-700">Out of Stock</div>
            </div>
          </div>

          {/* Detailed Analytics */}
          <Tabs defaultValue="turnover" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="turnover">Turnover Analysis</TabsTrigger>
              <TabsTrigger value="trends">Stock Trends</TabsTrigger>
              <TabsTrigger value="alerts">Stock Alerts</TabsTrigger>
            </TabsList>

            {/* Turnover Analysis */}
            <TabsContent value="turnover" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Movers */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    Top Moving Products
                  </h4>
                  <div className="space-y-2">
                    {inventoryMetrics.topMovers.map((product, index) => (
                      <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                        <div>
                          <div className="font-medium text-sm">{product.productName}</div>
                          <div className="text-xs text-muted-foreground">{product.sku}</div>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className="text-green-600 bg-green-50">
                            {product.turnoverRate.toFixed(1)}x
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1">
                            {product.currentStock} in stock
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Slow Movers */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    Slow Moving Products
                  </h4>
                  <div className="space-y-2">
                    {inventoryMetrics.slowMovers.map((product, index) => (
                      <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                        <div>
                          <div className="font-medium text-sm">{product.productName}</div>
                          <div className="text-xs text-muted-foreground">{product.sku}</div>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className="text-red-600 bg-red-50">
                            {product.turnoverRate.toFixed(1)}x
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1">
                            {product.currentStock} in stock
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Stock Trends */}
            <TabsContent value="trends" className="space-y-4">
              <div className="h-[300px] bg-gray-50 rounded-lg flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Stock movement trends chart</p>
                  <p className="text-xs">Shows inbound vs outbound inventory over time</p>
                </div>
              </div>
            </TabsContent>

            {/* Stock Alerts */}
            <TabsContent value="alerts" className="space-y-4">
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Stock Alerts
                </h4>
                <div className="space-y-2">
                  {inventoryMetrics.stockAlerts.map((alert, index) => (
                    <div key={index} className={`flex justify-between items-center p-3 border rounded-lg ${
                      alert.status === 'out' ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'
                    }`}>
                      <div>
                        <div className="font-medium text-sm">{alert.productName}</div>
                        <div className="text-xs text-muted-foreground">{alert.sku}</div>
                      </div>
                      <div className="text-right">
                        <Badge variant={alert.status === 'out' ? 'destructive' : 'secondary'}>
                          {alert.status === 'out' ? 'Out of Stock' : 'Low Stock'}
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">
                          {alert.currentStock}/{alert.reorderPoint} units
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}