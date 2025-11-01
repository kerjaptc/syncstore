'use client';

/**
 * Platform Comparison Chart Component
 * Compares performance metrics across different platforms
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Store, TrendingUp, DollarSign, ShoppingCart } from 'lucide-react';
import { AnalyticsResult } from '@/types';
import { analyticsUtils } from '@/lib/analytics/utils';

interface PlatformComparisonChartProps {
  data: AnalyticsResult | null;
  isLoading: boolean;
  compact?: boolean;
}

export function PlatformComparisonChart({ 
  data, 
  isLoading, 
  compact = false 
}: PlatformComparisonChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Platform Comparison
          </CardTitle>
          <CardDescription>Performance across platforms</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mock platform data (in real implementation, this would come from the API)
  const platformData = data?.data || [
    {
      platformName: 'Shopee',
      orderCount: 145,
      totalRevenue: 2850000,
      averageOrderValue: 196551,
      marketShare: 45,
    },
    {
      platformName: 'TikTok Shop',
      orderCount: 98,
      totalRevenue: 1920000,
      averageOrderValue: 195918,
      marketShare: 35,
    },
    {
      platformName: 'Custom Website',
      orderCount: 52,
      totalRevenue: 1180000,
      averageOrderValue: 226923,
      marketShare: 20,
    },
  ];

  const totalRevenue = platformData.reduce((sum, platform) => sum + platform.totalRevenue, 0);
  const totalOrders = platformData.reduce((sum, platform) => sum + platform.orderCount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5" />
          Platform Comparison
        </CardTitle>
        <CardDescription>Performance across platforms</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary */}
          {!compact && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-lg font-bold">{analyticsUtils.formatCurrency(totalRevenue)}</div>
                <div className="text-sm text-muted-foreground">Total Revenue</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{totalOrders}</div>
                <div className="text-sm text-muted-foreground">Total Orders</div>
              </div>
            </div>
          )}

          {/* Platform Breakdown */}
          <div className="space-y-4">
            {platformData.map((platform, index) => {
              const revenuePercentage = (platform.totalRevenue / totalRevenue) * 100;
              const orderPercentage = (platform.orderCount / totalOrders) * 100;

              return (
                <div key={index} className="space-y-3 p-4 border rounded-lg">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        index === 0 ? 'bg-blue-500' : 
                        index === 1 ? 'bg-green-500' : 'bg-purple-500'
                      }`} />
                      <span className="font-medium">{platform.platformName}</span>
                    </div>
                    <Badge variant="outline">
                      {platform.marketShare}% share
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <DollarSign className="h-3 w-3" />
                        <span className="text-muted-foreground">Revenue</span>
                      </div>
                      <div className="font-medium">
                        {analyticsUtils.formatCurrency(platform.totalRevenue)}
                      </div>
                      <Progress value={revenuePercentage} className="h-1 mt-1" />
                    </div>

                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <ShoppingCart className="h-3 w-3" />
                        <span className="text-muted-foreground">Orders</span>
                      </div>
                      <div className="font-medium">{platform.orderCount}</div>
                      <Progress value={orderPercentage} className="h-1 mt-1" />
                    </div>

                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <TrendingUp className="h-3 w-3" />
                        <span className="text-muted-foreground">AOV</span>
                      </div>
                      <div className="font-medium">
                        {analyticsUtils.formatCurrency(platform.averageOrderValue)}
                      </div>
                    </div>
                  </div>

                  {!compact && (
                    <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t">
                      <span>
                        {revenuePercentage.toFixed(1)}% of total revenue
                      </span>
                      <span>
                        {orderPercentage.toFixed(1)}% of total orders
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Chart Placeholder */}
          {!compact && (
            <div className="h-[200px] bg-gray-50 rounded-lg flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Store className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Platform comparison chart</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}