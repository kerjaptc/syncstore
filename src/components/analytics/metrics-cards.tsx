'use client';

/**
 * Metrics Cards Component
 * Displays key performance indicators in card format
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Store,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { DashboardMetrics } from '@/types';
import { analyticsUtils } from '@/lib/analytics/utils';

interface MetricsCardsProps {
  metrics: DashboardMetrics | null;
  isLoading: boolean;
}

export function MetricsCards({ metrics, isLoading }: MetricsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              No metrics data available
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cards = [
    {
      title: 'Total Revenue',
      value: analyticsUtils.formatCurrency(metrics.orders.revenue),
      change: '+12.5%',
      changeType: 'positive' as const,
      icon: DollarSign,
      description: 'Last 30 days',
    },
    {
      title: 'Total Orders',
      value: analyticsUtils.formatNumber(metrics.orders.total),
      change: '+8.2%',
      changeType: 'positive' as const,
      icon: ShoppingCart,
      description: `${metrics.orders.pending} pending`,
    },
    {
      title: 'Active Products',
      value: analyticsUtils.formatNumber(metrics.products.active),
      change: metrics.products.lowStock > 0 ? `${metrics.products.lowStock} low stock` : 'All in stock',
      changeType: metrics.products.lowStock > 0 ? 'warning' as const : 'neutral' as const,
      icon: Package,
      description: `${metrics.products.total} total products`,
    },
    {
      title: 'Connected Stores',
      value: `${metrics.stores.active}/${metrics.stores.total}`,
      change: metrics.stores.errors > 0 ? `${metrics.stores.errors} errors` : 'All connected',
      changeType: metrics.stores.errors > 0 ? 'negative' as const : 'positive' as const,
      icon: Store,
      description: `${metrics.stores.syncing} syncing`,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-2">{card.value}</div>
              <div className="flex items-center gap-2">
                {card.changeType === 'positive' && (
                  <Badge variant="secondary" className="text-green-600 bg-green-50">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {card.change}
                  </Badge>
                )}
                {card.changeType === 'negative' && (
                  <Badge variant="secondary" className="text-red-600 bg-red-50">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    {card.change}
                  </Badge>
                )}
                {card.changeType === 'warning' && (
                  <Badge variant="secondary" className="text-yellow-600 bg-yellow-50">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {card.change}
                  </Badge>
                )}
                {card.changeType === 'neutral' && (
                  <Badge variant="secondary" className="text-blue-600 bg-blue-50">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {card.change}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}