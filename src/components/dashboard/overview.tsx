'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Store,
  Package,
  ShoppingCart,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Plus,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { RecentActivity } from './recent-activity';
import { QuickActions } from './quick-actions';

interface User {
  id: string;
  email: string;
  fullName?: string;
  organizationId: string;
  role: string;
}

interface DashboardOverviewProps {
  user: User;
}

// Mock data - in real implementation, this would come from the database
const mockMetrics = {
  stores: {
    total: 3,
    connected: 2,
    syncing: 1,
    change: '+1',
    changeType: 'increase' as const,
  },
  products: {
    total: 1247,
    active: 1180,
    lowStock: 23,
    change: '+12%',
    changeType: 'increase' as const,
  },
  orders: {
    total: 89,
    pending: 12,
    processing: 8,
    change: '+23%',
    changeType: 'increase' as const,
  },
  revenue: {
    total: 24567.89,
    thisMonth: 8234.56,
    change: '+15.3%',
    changeType: 'increase' as const,
  },
};

const mockSyncStatus = {
  lastSync: new Date('2024-10-30T18:22:00Z'), // Static date for consistent hydration
  nextSync: new Date('2024-10-30T19:07:00Z'), // Static date for consistent hydration
  status: 'success' as const,
  syncedStores: 2,
  totalStores: 3,
};

export function DashboardOverview({ user }: DashboardOverviewProps) {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {user.fullName || user.email.split('@')[0]}!
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening with your stores today.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Connected Stores */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected Stores</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockMetrics.stores.total}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{mockMetrics.stores.connected} active</span>
              <Badge variant="secondary" className="text-xs">
                {mockMetrics.stores.change}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Products */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(mockMetrics.products.total)}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{mockMetrics.products.active} active</span>
              <div className="flex items-center gap-1 text-green-600">
                <TrendingUp className="h-3 w-3" />
                <span>{mockMetrics.products.change}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders Today</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockMetrics.orders.total}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{mockMetrics.orders.pending} pending</span>
              <div className="flex items-center gap-1 text-green-600">
                <TrendingUp className="h-3 w-3" />
                <span>{mockMetrics.orders.change}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(mockMetrics.revenue.thisMonth)}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>This month</span>
              <div className="flex items-center gap-1 text-green-600">
                <TrendingUp className="h-3 w-3" />
                <span>{mockMetrics.revenue.change}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Synchronization Status
              </CardTitle>
              <CardDescription>
                Real-time sync status across all connected platforms
              </CardDescription>
            </div>
            <Badge variant={mockSyncStatus.status === 'success' ? 'default' : 'destructive'}>
              {mockSyncStatus.status === 'success' ? 'Healthy' : 'Issues'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>Sync Progress</span>
              <span>{mockSyncStatus.syncedStores}/{mockSyncStatus.totalStores} stores</span>
            </div>
            <Progress 
              value={(mockSyncStatus.syncedStores / mockSyncStatus.totalStores) * 100} 
              className="h-2"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Last sync: {formatTime(mockSyncStatus.lastSync)}</span>
              <span>Next sync: {formatTime(mockSyncStatus.nextSync)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="actions">Quick Actions</TabsTrigger>
          <TabsTrigger value="alerts">Alerts & Issues</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <RecentActivity />
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <QuickActions />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Alerts</CardTitle>
              <CardDescription>
                Important notifications and issues that need attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/10">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Low Stock Alert
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      23 products are running low on stock and need restocking.
                    </p>
                    <Button size="sm" variant="outline" className="mt-2">
                      View Inventory
                    </Button>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/10">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      All Systems Operational
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      All platform integrations are working normally.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}