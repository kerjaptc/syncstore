'use client';

import { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { 
  MoreHorizontal, 
  Eye, 
  Package,
  ShoppingCart,
  Truck,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  DollarSign
} from 'lucide-react';
import { OrderWithItems, OrderStatus, FinancialStatus, FulfillmentStatus } from '@/types';
import { formatCurrency } from '@/lib/db/utils';
import { format } from 'date-fns';

interface OrderDataTableProps {
  orders: OrderWithItems[];
  onViewOrder: (order: OrderWithItems) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onFulfillOrder: (orderId: string) => void;
  onCancelOrder: (orderId: string) => void;
  loading?: boolean;
}

export function OrderDataTable({ 
  orders, 
  onViewOrder, 
  onUpdateStatus,
  onFulfillOrder,
  onCancelOrder,
  loading = false
}: OrderDataTableProps) {
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleAllOrders = () => {
    setSelectedOrders(prev => 
      prev.length === orders.length 
        ? [] 
        : orders.map(o => o.id)
    );
  };

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'paid':
        return <DollarSign className="h-4 w-4" />;
      case 'shipped':
        return <Truck className="h-4 w-4" />;
      case 'delivered':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <X className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusVariant = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'paid':
        return 'default';
      case 'shipped':
        return 'default';
      case 'delivered':
        return 'default';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getFinancialStatusVariant = (status: FinancialStatus) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'paid':
        return 'default';
      case 'refunded':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getFulfillmentStatusVariant = (status: FulfillmentStatus) => {
    switch (status) {
      case 'unfulfilled':
        return 'secondary';
      case 'partial':
        return 'outline';
      case 'fulfilled':
        return 'default';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Financial</TableHead>
              <TableHead>Fulfillment</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><div className="h-4 w-4 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-6 w-16 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-6 w-16 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-6 w-16 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-4 w-8 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-8 w-8 bg-muted animate-pulse rounded" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selectedOrders.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground">
            {selectedOrders.length} order(s) selected
          </span>
          <Button variant="outline" size="sm">
            Bulk Update Status
          </Button>
          <Button variant="outline" size="sm">
            Export Selected
          </Button>
          <Button variant="outline" size="sm">
            Mark as Shipped
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={selectedOrders.length === orders.length && orders.length > 0}
                  onChange={toggleAllOrders}
                  className="rounded border-gray-300"
                />
              </TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Financial</TableHead>
              <TableHead>Fulfillment</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ShoppingCart className="h-8 w-8" />
                    <p>No orders found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedOrders.includes(order.id)}
                      onChange={() => toggleOrderSelection(order.id)}
                      className="rounded border-gray-300"
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {order.orderNumber || `#${order.id.slice(-8)}`}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {order.platformOrderId}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {(order.customerInfo as any)?.name || 'Unknown'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {(order.customerInfo as any)?.email || ''}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{order.store.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {order.store.platform.displayName}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(order.status as OrderStatus)} className="gap-1">
                      {getStatusIcon(order.status as OrderStatus)}
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getFinancialStatusVariant(order.financialStatus as FinancialStatus)}>
                      {order.financialStatus || 'pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getFulfillmentStatusVariant(order.fulfillmentStatus as FulfillmentStatus)}>
                      {order.fulfillmentStatus || 'unfulfilled'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {order._count.items} item{order._count.items !== 1 ? 's' : ''}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {formatCurrency(parseFloat(order.totalAmount))}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {order.currency}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {format(new Date(order.orderedAt), 'MMM dd, yyyy')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(order.orderedAt), 'HH:mm')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewOrder(order)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {order.status !== 'shipped' && order.status !== 'delivered' && (
                          <DropdownMenuItem onClick={() => onFulfillOrder(order.id)}>
                            <Package className="h-4 w-4 mr-2" />
                            Mark as Shipped
                          </DropdownMenuItem>
                        )}
                        {order.status !== 'cancelled' && (
                          <DropdownMenuItem 
                            onClick={() => onCancelOrder(order.id)}
                            className="text-destructive"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel Order
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}