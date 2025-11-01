import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Package, Truck, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckoutService } from '@/lib/services/checkout-service';

interface OrderPageProps {
  params: {
    orderId: string;
  };
}

export const dynamic = 'force-dynamic';

const checkoutService = new CheckoutService();

/**
 * Order detail and tracking page
 */
export default async function OrderPage({ params }: OrderPageProps) {
  try {
    const order = await checkoutService.getOrderById(params.orderId);
    
    if (!order) {
      notFound();
    }

    const formatPrice = (price: string | number) => {
      const amount = typeof price === 'string' ? parseFloat(price) : price;
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(amount);
    };

    const formatDate = (date: Date) => {
      return new Intl.DateTimeFormat('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    };

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'pending':
          return <Clock className="w-5 h-5 text-yellow-500" />;
        case 'paid':
          return <CheckCircle className="w-5 h-5 text-green-500" />;
        case 'shipped':
          return <Truck className="w-5 h-5 text-blue-500" />;
        case 'delivered':
          return <Package className="w-5 h-5 text-green-600" />;
        case 'cancelled':
          return <Clock className="w-5 h-5 text-red-500" />;
        default:
          return <Clock className="w-5 h-5 text-gray-500" />;
      }
    };

    const getStatusColor = (status: string) => {
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

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/store">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Store
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Order Details</h1>
              <p className="text-muted-foreground">
                Order #{order.orderNumber} • Placed on {formatDate(order.orderedAt)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Order Items */}
            <div className="lg:col-span-2 space-y-6">
              {/* Order Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getStatusIcon(order.status)}
                    Order Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <Badge variant={getStatusColor(order.status) as any}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Last updated: {formatDate(order.updatedAt)}
                    </span>
                  </div>
                  
                  {/* Order Timeline */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">Order Placed</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(order.orderedAt)}
                        </p>
                      </div>
                    </div>
                    
                    {order.status !== 'pending' && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">Payment Confirmed</p>
                          <p className="text-sm text-muted-foreground">
                            Payment processed successfully
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {order.status === 'shipped' || order.status === 'delivered' ? (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <Truck className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">Order Shipped</p>
                          <p className="text-sm text-muted-foreground">
                            Your order is on its way
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                          <Package className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground">Preparing for Shipment</p>
                          <p className="text-sm text-muted-foreground">
                            We're getting your order ready
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Order Items */}
              <Card>
                <CardHeader>
                  <CardTitle>Items Ordered</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium">{item.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            SKU: {item.sku}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Quantity: {item.quantity}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatPrice(item.totalAmount)}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatPrice(item.price)} each
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Shipping Address */}
              <Card>
                <CardHeader>
                  <CardTitle>Shipping Address</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <p className="font-medium">{order.customerInfo.name}</p>
                    {order.customerInfo.phone && (
                      <p className="text-sm text-muted-foreground">{order.customerInfo.phone}</p>
                    )}
                    <p className="text-sm text-muted-foreground">{order.customerInfo.email}</p>
                    <div className="text-sm text-muted-foreground">
                      <p>{order.customerInfo.address.street}</p>
                      <p>
                        {order.customerInfo.address.city}
                        {order.customerInfo.address.state && `, ${order.customerInfo.address.state}`}
                      </p>
                      <p>{order.customerInfo.address.postalCode}</p>
                      <p>{order.customerInfo.address.country}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>{formatPrice(order.subtotal)}</span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span>Shipping</span>
                      <span>
                        {parseFloat(order.shippingAmount) === 0 ? (
                          <span className="text-green-600">Free</span>
                        ) : (
                          formatPrice(order.shippingAmount)
                        )}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span>Tax</span>
                      <span>{formatPrice(order.taxAmount)}</span>
                    </div>
                    
                    {parseFloat(order.discountAmount) > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount</span>
                        <span>-{formatPrice(order.discountAmount)}</span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>{formatPrice(order.totalAmount)}</span>
                  </div>

                  <Separator />

                  {/* Payment Information */}
                  <div className="space-y-2">
                    <h4 className="font-medium">Payment Information</h4>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>Payment Status:</span>
                        <Badge variant={getStatusColor(order.financialStatus || 'pending') as any}>
                          {(order.financialStatus || 'pending').charAt(0).toUpperCase() + 
                           (order.financialStatus || 'pending').slice(1)}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Payment Method:</span>
                        <span className="capitalize">
                          {order.platformData?.paymentMethod || 'Card'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Order Notes */}
                  {order.notes && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-medium mb-2">Order Notes</h4>
                        <p className="text-sm text-muted-foreground">{order.notes}</p>
                      </div>
                    </>
                  )}

                  {/* Actions */}
                  <div className="space-y-2 pt-4">
                    <Button variant="outline" className="w-full" asChild>
                      <Link href="/store/contact">
                        Contact Support
                      </Link>
                    </Button>
                    <Button variant="outline" className="w-full" asChild>
                      <Link href="/store/products">
                        Continue Shopping
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error loading order:', error);
    notFound();
  }
}