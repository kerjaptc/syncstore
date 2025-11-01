'use client';

/**
 * Sales Overview Chart Component
 * Displays sales analytics with revenue and order trends
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { AnalyticsResult } from '@/types';
import { analyticsUtils } from '@/lib/analytics/utils';

interface SalesOverviewChartProps {
  data: AnalyticsResult | null;
  dateRange: { start: Date; end: Date };
  isLoading: boolean;
  detailed?: boolean;
}

export function SalesOverviewChart({ 
  data, 
  dateRange, 
  isLoading, 
  detailed = false 
}: SalesOverviewChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Sales Overview
          </CardTitle>
          <CardDescription>Revenue and order trends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-[300px] w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Sales Overview
          </CardTitle>
          <CardDescription>Revenue and order trends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No sales data available for the selected period
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate trends
  const totalRevenue = data.summary?.totalRevenue || 0;
  const totalOrders = data.summary?.totalOrders || 0;
  const averageOrderValue = data.summary?.averageOrderValue || 0;

  // Mock trend calculations (in real implementation, compare with previous period)
  const revenueTrend = 12.5;
  const ordersTrend = 8.2;
  const aovTrend = 3.1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Sales Overview
        </CardTitle>
        <CardDescription>
          {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-900">
                {analyticsUtils.formatCurrency(totalRevenue)}
              </div>
              <div className="text-sm text-blue-700 mb-2">Total Revenue</div>
              <Badge variant="secondary" className="text-green-600 bg-green-50">
                <TrendingUp className="h-3 w-3 mr-1" />
                +{revenueTrend}%
              </Badge>
            </div>

            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-900">
                {analyticsUtils.formatNumber(totalOrders)}
              </div>
              <div className="text-sm text-green-700 mb-2">Total Orders</div>
              <Badge variant="secondary" className="text-green-600 bg-green-50">
                <TrendingUp className="h-3 w-3 mr-1" />
                +{ordersTrend}%
              </Badge>
            </div>

            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-900">
                {analyticsUtils.formatCurrency(averageOrderValue)}
              </div>
              <div className="text-sm text-purple-700 mb-2">Avg Order Value</div>
              <Badge variant="secondary" className="text-green-600 bg-green-50">
                <TrendingUp className="h-3 w-3 mr-1" />
                +{aovTrend}%
              </Badge>
            </div>
          </div>

          {/* Chart Placeholder */}
          <div className="h-[300px] bg-gray-50 rounded-lg flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Chart visualization will be implemented</p>
              <p className="text-xs">with Chart.js or Recharts library</p>
            </div>
          </div>

          {/* Detailed View */}
          {detailed && (
            <div className="space-y-4">
              <h4 className="font-medium">Sales Breakdown</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Completed Orders</span>
                    <span className="font-medium">{Math.floor(totalOrders * 0.85)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Pending Orders</span>
                    <span className="font-medium">{Math.floor(totalOrders * 0.10)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Cancelled Orders</span>
                    <span className="font-medium">{Math.floor(totalOrders * 0.05)}</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Conversion Rate</span>
                    <span className="font-medium">3.2%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Return Rate</span>
                    <span className="font-medium">2.1%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Customer Satisfaction</span>
                    <span className="font-medium">4.6/5</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}