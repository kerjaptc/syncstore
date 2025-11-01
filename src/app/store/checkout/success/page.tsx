import Link from 'next/link';
import { CheckCircle, Package, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CheckoutSuccessPageProps {
  searchParams: {
    orderId?: string;
    sessionId?: string;
  };
}

export const dynamic = 'force-dynamic';

/**
 * Checkout success page shown after successful payment
 */
export default function CheckoutSuccessPage({ searchParams }: CheckoutSuccessPageProps) {
  const { orderId } = searchParams;

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>

        {/* Success Message */}
        <h1 className="text-3xl font-bold mb-4">Order Confirmed!</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Thank you for your purchase. Your order has been successfully placed and is being processed.
        </p>

        {/* Order Details */}
        {orderId && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-left">Order Details</CardTitle>
            </CardHeader>
            <CardContent className="text-left space-y-4">
              <div className="flex justify-between">
                <span className="font-medium">Order Number:</span>
                <span className="font-mono text-sm">{orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Order Date:</span>
                <span>{new Date().toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Status:</span>
                <span className="text-green-600 font-medium">Confirmed</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
              <Package className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Processing</h3>
              <p className="text-sm text-muted-foreground">
                We're preparing your order for shipment
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <Truck className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Shipping</h3>
              <p className="text-sm text-muted-foreground">
                You'll receive tracking information via email
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {orderId && (
            <Button variant="outline" asChild>
              <Link href={`/store/orders/${orderId}`}>
                View Order Details
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link href="/store/products">
              Continue Shopping
            </Link>
          </Button>
        </div>

        {/* Contact Info */}
        <div className="mt-12 p-6 bg-muted/50 rounded-lg">
          <h3 className="font-semibold mb-2">Need Help?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            If you have any questions about your order, please don't hesitate to contact us.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button variant="outline" size="sm" asChild>
              <Link href="/store/contact">Contact Support</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/store/help">Help Center</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}