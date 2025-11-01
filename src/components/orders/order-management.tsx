'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingCart, 
  Download, 
  RefreshCw,
  TrendingUp,
  DollarSign,
  Package,
  Clock
} from 'lucide-react';
import { OrderFilters } from './order-filters';
import { OrderDataTable } from './order-data-table';
import { OrderDetailDialog } from './order-detail-dialog';
import { OrderStatusDialog } from './order-status-dialog';
import { BulkOperationsDialog } from './bulk-operations-dialog';
import { OrderExportDialog } from './order-export-dialog';
import { 
  OrderWithItems, 
  OrderStatus, 
  FinancialStatus, 
  FulfillmentStatus,
  StoreWithRelations,
  PaginatedResponse
} from '@/types';
import { formatCurrency } from '@/lib/db/utils';
import { toast } from 'sonner';

interface OrderManagementProps {
  user: {
    id: string;
    organizationId: string;
  };
}

export function OrderManagement({ user }: OrderManagementProps) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [stores, setStores] = useState<StoreWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  
  // Dialog states
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [statusDialogType, setStatusDialogType] = useState<'status' | 'fulfill' | 'cancel'>('status');
  
  // Filters and pagination
  const [filters, setFilters] = useState<any>({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [sortBy, setSortBy] = useState<'orderedAt' | 'totalAmount' | 'createdAt' | 'updatedAt'>('orderedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Stats
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    shippedOrders: 0,
  });

  // Fetch orders
  const fetchOrders = async (page = 1, newFilters = filters) => {
    try {
      setLoading(page === 1);
      setRefreshing(page !== 1);

      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', pagination.limit.toString());
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      
      Object.entries(newFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          if (value instanceof Date) {
            params.set(key, value.toISOString());
          } else {
            params.set(key, String(value));
          }
        }
      });

      const response = await fetch(`/api/orders?${params}`);
      const result = await response.json();

      if (result.success) {
        setOrders(result.data.data);
        setPagination(result.data.pagination);
      } else {
        toast.error('Failed to fetch orders');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch stores
  const fetchStores = async () => {
    try {
      const response = await fetch('/api/stores');
      const result = await response.json();

      if (result.success) {
        setStores(result.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          if (value instanceof Date) {
            params.set(key, value.toISOString());
          } else {
            params.set(key, String(value));
          }
        }
      });

      const response = await fetch(`/api/orders/stats?${params}`);
      const result = await response.json();

      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Initial load
  useEffect(() => {
    fetchStores();
    fetchOrders();
    fetchStats();
  }, []);

  // Refetch when filters change
  useEffect(() => {
    fetchOrders(1, filters);
    fetchStats();
  }, [filters, sortBy, sortOrder]);

  // Handle filter changes
  const handleFiltersChange = (newFilters: any) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setFilters({});
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Handle order actions
  const handleViewOrder = (order: OrderWithItems) => {
    setSelectedOrder(order);
    setShowOrderDetail(true);
  };

  const handleUpdateStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Order status updated successfully');
        fetchOrders(pagination.page);
        fetchStats();
      } else {
        toast.error(result.error?.message || 'Failed to update order status');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    }
  };

  const handleFulfillOrder = async (orderId: string, data?: any) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/fulfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data || {}),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Order marked as shipped successfully');
        fetchOrders(pagination.page);
        fetchStats();
        setShowStatusDialog(false);
      } else {
        toast.error(result.error?.message || 'Failed to fulfill order');
      }
    } catch (error) {
      console.error('Error fulfilling order:', error);
      toast.error('Failed to fulfill order');
    }
  };

  const handleCancelOrder = async (orderId: string, reason?: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Order cancelled successfully');
        fetchOrders(pagination.page);
        fetchStats();
        setShowStatusDialog(false);
      } else {
        toast.error(result.error?.message || 'Failed to cancel order');
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error('Failed to cancel order');
    }
  };

  // Handle bulk operations
  const handleBulkUpdate = async (updates: any) => {
    try {
      const response = await fetch('/api/orders/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
          updates,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Updated ${result.data.updated} orders successfully`);
        if (result.data.errors.length > 0) {
          toast.warning(`${result.data.errors.length} orders failed to update`);
        }
        fetchOrders(pagination.page);
        fetchStats();
        setSelectedOrderIds([]);
        setShowBulkDialog(false);
      } else {
        toast.error(result.error?.message || 'Failed to update orders');
      }
    } catch (error) {
      console.error('Error bulk updating orders:', error);
      toast.error('Failed to update orders');
    }
  };

  // Handle export
  const handleExport = async (options: any) => {
    try {
      const response = await fetch('/api/orders/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: options.format,
          filters: options.scope === 'filtered' ? filters : {},
          orderIds: options.orderIds,
        }),
      });

      if (options.format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `orders-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const result = await response.json();
        const dataStr = JSON.stringify(result.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(dataBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `orders-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }

      toast.success('Orders exported successfully');
      setShowExportDialog(false);
    } catch (error) {
      console.error('Error exporting orders:', error);
      toast.error('Failed to export orders');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Manage orders and fulfillment across all platforms
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowExportDialog(true)}
            disabled={loading}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            onClick={() => fetchOrders(pagination.page)}
            disabled={loading || refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingOrders.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shipped Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.shippedOrders.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <OrderFilters
        stores={stores}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
      />

      {/* Sorting and Bulk Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="orderedAt">Order Date</SelectItem>
              <SelectItem value="totalAmount">Total Amount</SelectItem>
              <SelectItem value="createdAt">Created Date</SelectItem>
              <SelectItem value="updatedAt">Updated Date</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as any)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Newest</SelectItem>
              <SelectItem value="asc">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedOrderIds.length > 0 && (
          <Button onClick={() => setShowBulkDialog(true)}>
            Bulk Update ({selectedOrderIds.length})
          </Button>
        )}
      </div>

      {/* Orders Table */}
      <OrderDataTable
        orders={orders}
        onViewOrder={handleViewOrder}
        onUpdateStatus={handleUpdateStatus}
        onFulfillOrder={(orderId) => {
          setSelectedOrder(orders.find(o => o.id === orderId) || null);
          setStatusDialogType('fulfill');
          setShowStatusDialog(true);
        }}
        onCancelOrder={(orderId) => {
          setSelectedOrder(orders.find(o => o.id === orderId) || null);
          setStatusDialogType('cancel');
          setShowStatusDialog(true);
        }}
        loading={loading}
      />

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} orders
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchOrders(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchOrders(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <OrderDetailDialog
        order={selectedOrder}
        open={showOrderDetail}
        onOpenChange={setShowOrderDetail}
        onUpdateStatus={handleUpdateStatus}
        onFulfillOrder={(orderId) => handleFulfillOrder(orderId)}
        onCancelOrder={(orderId) => handleCancelOrder(orderId)}
      />

      <OrderStatusDialog
        open={showStatusDialog}
        onOpenChange={setShowStatusDialog}
        onConfirm={(data) => {
          if (selectedOrder) {
            if (statusDialogType === 'fulfill') {
              handleFulfillOrder(selectedOrder.id, data);
            } else if (statusDialogType === 'cancel') {
              handleCancelOrder(selectedOrder.id, data.notes);
            }
          }
        }}
        title={
          statusDialogType === 'fulfill' ? 'Mark Order as Shipped' :
          statusDialogType === 'cancel' ? 'Cancel Order' :
          'Update Order Status'
        }
        description={
          statusDialogType === 'fulfill' ? 'Mark this order as shipped and update fulfillment status.' :
          statusDialogType === 'cancel' ? 'Cancel this order and release any reserved inventory.' :
          'Update the status of this order.'
        }
        type={statusDialogType}
      />

      <BulkOperationsDialog
        open={showBulkDialog}
        onOpenChange={setShowBulkDialog}
        selectedOrderIds={selectedOrderIds}
        onConfirm={handleBulkUpdate}
      />

      <OrderExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        selectedOrderIds={selectedOrderIds}
        totalOrders={pagination.total}
        onExport={handleExport}
      />
    </div>
  );
}