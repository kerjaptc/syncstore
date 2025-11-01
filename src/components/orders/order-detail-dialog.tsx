'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { 
  Package,
  User,
  MapPin,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Truck,
  Edit,
  X,
  CheckCircle
} from 'lucide-react';
import { OrderWithItems, OrderStatus, FinancialStatus, FulfillmentStatus } from '@/types';
import { formatCurrency } from '@/lib/db/utils';
import { format } from 'date-fns';

interface OrderDetailDialogProps {
  order: OrderWithItems | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onFulfillOrder: (orderId: string) => void;
  onCancelOrder: (orderId: string) => void;
}

export function OrderDetailDialog({
  order,
  open,
  onOpenChange,
  onUpdateStatus,
  onFulfillOrder,
  onCancelOrder,
}: OrderDetailDialogProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  if (!order) return null;

  const customerInfo = order.customerInfo as any;
  const address = customerInfo?.address || {};

  const handleFulfill = async () => {
    setIsUpdating(true);
    try {
      await onFulfillOrder(order.id);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = async () => {
    setIsUpdating(true);
    try {
      await onCancelOrder(order.id);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'shipped': return 'bg-blue-100 text-blue-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'unfulfilled': return 'bg-gray-100 text-gray-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      case 'fulfilled': return 'bg-green-100 text-green-800';
      case 'refunded': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Details
          </DialogTitle>
          <DialogDescription>
            {order.orderNumber || `Order #${order.id.slice(-8)}`} • {order.store.platform.displayName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Status and Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge className={getStatusColor(order.status)}>
                {order.status}
              </Badge>
              <Badge className={getStatusColor(order.financialStatus || 'pending')}>
                {order.financialStatus || 'pending'}
              </Badge>
              <Badge className={getStatusColor(order.fulfillmentStatus || 'unfulfilled')}>
                {order.fulfillmentStatus || 'unfulfilled'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {order.status !== 'shipped' && order.status !== 'delivered' && (
                <Button 
                  onClick={handleFulfill} 
                  disabled={isUpdating}
                  size="sm"
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Mark as Shipped
                </Button>
              )}
              {order.status !== 'cancelled' && (
                <Button 
                  variant="destructive" 
                  onClick={handleCancel} 
                  disabled={isUpdating}
                  size="sm"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel Order
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="font-medium">{customerInfo?.name || 'Unknown Customer'}</div>
                  {customerInfo?.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {customerInfo.email}
                    </div>
                  )}
                  {customerInfo?.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {customerInfo.phone}
                    </div>
                  )}
                </div>
                
                {address && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium mb-1">
                      <MapPin className="h-3 w-3" />
                      Shipping Address
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {address.street && <div>{address.street}</div>}
                      <div>
                        {[address.city, address.state, address.postalCode]
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                      {address.country && <div>{address.country}</div>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Order Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Order Number</div>
                    <div className="font-medium">
                      {order.orderNumber || `#${order.id.slice(-8)}`}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Platform Order ID</div>
                    <div className="font-medium">{order.platformOrderId}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Store</div>
                    <div className="font-medium">{order.store.name}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Platform</div>
                    <div className="font-medium">{order.store.platform.displayName}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Order Date</div>
                    <div className="font-medium">
                      {format(new Date(order.orderedAt), 'MMM dd, yyyy HH:mm')}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Currency</div>
                    <div className="font-medium">{order.currency}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items ({order._count.items})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {order.items.map((item, index) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                        {item.productVariant?.images && Array.isArray(item.productVariant.images) && item.productVariant.images.length > 0 ? (
                          <img
                            src={item.productVariant.images[0] as string}
                            alt={item.name}
                            className="w-full h-full object-cover rounded-md"
                          />
                        ) : (
                          <Package className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{item.name}</div>
                        {item.sku && (
                          <div className="text-sm text-muted-foreground">SKU: {item.sku}</div>
                        )}
                        <div className="text-sm text-muted-foreground">
                          Quantity: {item.quantity}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {formatCurrency(parseFloat(item.price))} each
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Total: {formatCurrency(parseFloat(item.totalAmount))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(parseFloat(order.subtotal))}</span>
                </div>
                {parseFloat(order.taxAmount || '0') > 0 && (
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span>{formatCurrency(parseFloat(order.taxAmount))}</span>
                  </div>
                )}
                {parseFloat(order.shippingAmount || '0') > 0 && (
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span>{formatCurrency(parseFloat(order.shippingAmount))}</span>
                  </div>
                )}
                {parseFloat(order.discountAmount || '0') > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(parseFloat(order.discountAmount))}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(parseFloat(order.totalAmount))}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {order.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}