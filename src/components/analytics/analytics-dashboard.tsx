'use client';

/**
 * Analytics Dashboard Component
 * Main dashboard with sales analytics, platform comparison, and customizable widgets
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Store,
  RefreshCw,
  Download,
  Settings,
  Calendar
} from 'lucide-react';
import { SalesOverviewChart } from './sales-overview-chart';
import { PlatformComparisonChart } from './platform-comparison-chart';
import { InventoryAnalyticsChart } from './inventory-analytics-chart';
import { MetricsCards } from './metrics-cards';
import { ReportsPanel } from './reports-panel';
import { CustomizableDashboard } from './customizable-dashboard';
import { DateRangePicker } from './date-range-picker';
import { useAnalytics } from '@/hooks/use-analytics';
import { analyticsUtils } from '@/lib/analytics/utils';

export function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState(() => analyticsUtils.getDateRange('month'));
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    dashboardMetrics,
    salesAnalytics,
    platformComparison,
    inventoryAnalytics,
    isLoading,
    error,
    refresh
  } = useAnalytics({
    dateRange,
    storeIds: selectedStores,
    includeRealTime: true,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh(true); // Force refresh
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDateRangeChange = (newRange: { start: Date; end: Date }) => {
    setDateRange(newRange);
  };

  const handleExportData = () => {
    // TODO: Implement data export functionality
    console.log('Exporting analytics data...');
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-destructive mb-4">Failed to load analytics data</p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-wrap gap-2">
          <DateRangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
          />
          
          <Select value={selectedStores.join(',')} onValueChange={(value) => setSelectedStores(value ? value.split(',') : [])}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Stores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stores</SelectItem>
              {/* TODO: Add store options from API */}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportData}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Real-time Status */}
      {dashboardMetrics && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>Live data • Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      )}

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics Cards */}
          <MetricsCards 
            metrics={dashboardMetrics}
            isLoading={isLoading}
          />

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SalesOverviewChart 
              data={salesAnalytics}
              dateRange={dateRange}
              isLoading={isLoading}
            />
            
            <PlatformComparisonChart 
              data={platformComparison}
              isLoading={isLoading}
            />
          </div>

          {/* Additional Insights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Top Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {salesAnalytics?.topProducts?.slice(0, 5).map((product: any, index: number) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-sm truncate">{product.productName}</span>
                      <Badge variant="secondary">
                        {analyticsUtils.formatCurrency(product.revenue)}
                      </Badge>
                    </div>
                  )) || (
                    <div className="text-sm text-muted-foreground">No data available</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-blue-500" />
                    <span>5 new orders in the last hour</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-green-500" />
                    <span>12 products synced successfully</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-purple-500" />
                    <span>All stores are connected</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Sync Success Rate</span>
                    <Badge variant="outline" className="text-green-600">
                      {dashboardMetrics?.sync?.successRate?.toFixed(1) || 0}%
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Avg Order Value</span>
                    <span className="text-sm font-medium">
                      {analyticsUtils.formatCurrency(salesAnalytics?.averageOrderValue || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Conversion Rate</span>
                    <span className="text-sm font-medium">
                      {salesAnalytics?.conversionRate?.toFixed(2) || 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sales Tab */}
        <TabsContent value="sales" className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <SalesOverviewChart 
                data={salesAnalytics}
                dateRange={dateRange}
                isLoading={isLoading}
                detailed={true}
              />
            </div>
            <div className="space-y-6">
              <PlatformComparisonChart 
                data={platformComparison}
                isLoading={isLoading}
                compact={true}
              />
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Sales Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-blue-900">Growth Trend</span>
                      </div>
                      <p className="text-sm text-blue-700">
                        Revenue increased by 15% compared to last period
                      </p>
                    </div>
                    
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Store className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-900">Best Platform</span>
                      </div>
                      <p className="text-sm text-green-700">
                        Shopee is your top performing platform this month
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="space-y-6">
          <InventoryAnalyticsChart 
            data={inventoryAnalytics}
            dateRange={dateRange}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <ReportsPanel 
            dateRange={dateRange}
            selectedStores={selectedStores}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}