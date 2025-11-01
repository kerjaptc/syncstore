'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Package,
  ShoppingCart,
  RefreshCw,
  Store,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  User,
} from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'order' | 'product' | 'sync' | 'store' | 'user';
  title: string;
  description: string;
  timestamp: Date;
  status?: 'success' | 'warning' | 'error' | 'pending';
  user?: string;
  metadata?: Record<string, any>;
}

// Mock activity data - using static dates for consistent hydration
const mockActivity: ActivityItem[] = [
  {
    id: '1',
    type: 'order',
    title: 'New order received',
    description: 'Order #ORD-2024-001 from TikTok Shop - $89.99',
    timestamp: new Date('2024-10-30T18:22:00Z'), // Static date
    status: 'success',
    user: 'System',
    metadata: { orderId: 'ORD-2024-001', platform: 'TikTok Shop', amount: 89.99 },
  },
  {
    id: '2',
    type: 'sync',
    title: 'Inventory sync completed',
    description: 'Successfully updated 150 products across 2 stores',
    timestamp: new Date('2024-10-30T18:07:00Z'), // Static date
    status: 'success',
    user: 'System',
    metadata: { productCount: 150, storeCount: 2 },
  },
  {
    id: '3',
    type: 'product',
    title: 'Product updated',
    description: 'Wireless Headphones - Price updated to $79.99',
    timestamp: new Date('2024-10-30T17:52:00Z'), // Static date
    status: 'success',
    user: 'John Doe',
    metadata: { productName: 'Wireless Headphones', newPrice: 79.99 },
  },
  {
    id: '4',
    type: 'sync',
    title: 'Sync warning',
    description: 'Product sync delayed for Shopee store due to rate limiting',
    timestamp: new Date('2024-10-30T17:37:00Z'), // Static date
    status: 'warning',
    user: 'System',
    metadata: { platform: 'Shopee', reason: 'rate_limit' },
  },
  {
    id: '5',
    type: 'order',
    title: 'Order fulfilled',
    description: 'Order #ORD-2024-002 shipped via Express Delivery',
    timestamp: new Date('2024-10-30T16:52:00Z'), // Static date
    status: 'success',
    user: 'Jane Smith',
    metadata: { orderId: 'ORD-2024-002', shippingMethod: 'Express' },
  },
  {
    id: '6',
    type: 'store',
    title: 'Store connected',
    description: 'Successfully connected new Shopee store "Fashion Hub"',
    timestamp: new Date('2024-10-30T16:37:00Z'), // Static date
    status: 'success',
    user: 'John Doe',
    metadata: { storeName: 'Fashion Hub', platform: 'Shopee' },
  },
];

export function RecentActivity() {
  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'order':
        return <ShoppingCart className="h-4 w-4" />;
      case 'product':
        return <Package className="h-4 w-4" />;
      case 'sync':
        return <RefreshCw className="h-4 w-4" />;
      case 'store':
        return <Store className="h-4 w-4" />;
      case 'user':
        return <User className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status?: ActivityItem['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-3 w-3 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      case 'pending':
        return <Clock className="h-3 w-3 text-blue-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status?: ActivityItem['status']) => {
    if (!status) return null;

    const variants = {
      success: 'default',
      warning: 'secondary',
      error: 'destructive',
      pending: 'outline',
    } as const;

    return (
      <Badge variant={variants[status]} className="text-xs">
        {status}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp: Date) => {
    // Use a fixed reference time for consistent hydration
    const now = new Date('2024-10-30T18:37:00Z');
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return timestamp.toLocaleDateString('en-US');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Activity Feed */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest updates and changes across your stores
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              View All
              <ArrowUpRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                {/* Icon */}
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  {getActivityIcon(activity.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium leading-none">
                      {activity.title}
                    </p>
                    {getStatusIcon(activity.status)}
                    {getStatusBadge(activity.status)}
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    {activity.description}
                  </p>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatTimestamp(activity.timestamp)}</span>
                    {activity.user && (
                      <>
                        <span>•</span>
                        <span>by {activity.user}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* User Avatar */}
                {activity.user && activity.user !== 'System' && (
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">
                      {activity.user.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}