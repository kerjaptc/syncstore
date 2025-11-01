'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useCart } from '@/hooks/use-cart';
// Removed service imports to avoid client-side database issues
// Services will be called via API routes instead

// Form validation schema
const checkoutSchema = z.object({
  // Customer Information
  email: z.string().email('Please enter a valid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  
  // Shipping Address
  street: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().optional(),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
  
  // Shipping Method
  shippingMethod: z.enum(['standard', 'express']),
  
  // Payment Method
  paymentMethod: z.enum(['stripe', 'paypal']),
  
  // Notes
  notes: z.string().optional(),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

/**
 * Checkout form component with customer information and payment processing
 */
export function CheckoutForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shippingMethods, setShippingMethods] = useState<ShippingInfo[]>([]);
  const { items, clearCart } = useCart();
  const router = useRouter();

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      country: 'ID',
      shippingMethod: 'standard',
      paymentMethod: 'stripe',
    },
  });

  // Calculate shipping methods when address changes
  const watchedAddress = form.watch(['street', 'city', 'state', 'postalCode', 'country']);
  
  React.useEffect(() => {
    if (watchedAddress.every(field => field)) {
      const address = {
        street: watchedAddress[0],
        city: watchedAddress[1],
        state: watchedAddress[2] || '',
        postalCode: watchedAddress[3],
        country: watchedAddress[4],
      };
      
      const methods = checkoutService.getShippingMethods(items, address);
      setShippingMethods(methods);
    }
  }, [watchedAddress, items]);

  const onSubmit = async (data: CheckoutFormData) => {
    if (items.length === 0) {
      setError('Your cart is empty');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Validate cart items
      const validation = await checkoutService.validateCartItems(items);
      if (!validation.valid) {
        setError(validation.errors.join(', '));
        return;
      }

      // Prepare customer info
      const customer: CustomerInfo = {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        address: {
          street: data.street,
          city: data.city,
          state: data.state,
          postalCode: data.postalCode,
          country: data.country,
        },
      };

      // Get shipping info
      const selectedShipping = shippingMethods.find(m => m.method === data.shippingMethod);
      if (!selectedShipping) {
        setError('Please select a shipping method');
        return;
      }

      // Calculate totals
      const totals = checkoutService.calculateTotals(items, selectedShipping.cost);

      if (data.paymentMethod === 'stripe') {
        // Create Stripe checkout session
        const session = await paymentService.createCheckoutSession({
          items,
          customer,
          totals,
          successUrl: `${window.location.origin}/store/checkout/success?sessionId={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/store/checkout`,
        });

        // Redirect to Stripe checkout
        window.location.href = session.url;
      } else {
        // Handle other payment methods (PayPal, etc.)
        setError('PayPal payment is not yet implemented');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during checkout');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">Your cart is empty</h3>
          <p className="text-muted-foreground mb-4">
            Add some items to your cart before proceeding to checkout.
          </p>
          <Button onClick={() => router.push('/store/products')}>
            Continue Shopping
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+62 812 3456 7890" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Shipping Address */}
        <Card>
          <CardHeader>
            <CardTitle>Shipping Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="street"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Street Address *</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main Street" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City *</FormLabel>
                    <FormControl>
                      <Input placeholder="Jakarta" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State/Province</FormLabel>
                    <FormControl>
                      <Input placeholder="DKI Jakarta" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="12345" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ID">Indonesia</SelectItem>
                        <SelectItem value="MY">Malaysia</SelectItem>
                        <SelectItem value="SG">Singapore</SelectItem>
                        <SelectItem value="TH">Thailand</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Shipping Method */}
        {shippingMethods.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Shipping Method</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="shippingMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="space-y-3"
                      >
                        {shippingMethods.map((method) => (
                          <div key={method.method} className="flex items-center space-x-2 border rounded-lg p-4">
                            <RadioGroupItem value={method.method} id={method.method} />
                            <div className="flex-1">
                              <label htmlFor={method.method} className="font-medium cursor-pointer">
                                {method.method === 'standard' ? 'Standard Delivery' : 'Express Delivery'}
                              </label>
                              <p className="text-sm text-muted-foreground">
                                {method.estimatedDays} business days - {paymentService.formatAmount(method.cost)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        {/* Payment Method */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="space-y-3"
                    >
                      <div className="flex items-center space-x-2 border rounded-lg p-4">
                        <RadioGroupItem value="stripe" id="stripe" />
                        <div className="flex-1">
                          <label htmlFor="stripe" className="font-medium cursor-pointer">
                            Credit/Debit Card
                          </label>
                          <p className="text-sm text-muted-foreground">
                            Secure payment with Stripe
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 border rounded-lg p-4 opacity-50">
                        <RadioGroupItem value="paypal" id="paypal" disabled />
                        <div className="flex-1">
                          <label htmlFor="paypal" className="font-medium cursor-pointer">
                            PayPal
                          </label>
                          <p className="text-sm text-muted-foreground">
                            Coming soon
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Order Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Order Notes (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Any special instructions for your order..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <LoadingSpinner className="mr-2" size="sm" />
              Processing...
            </>
          ) : (
            'Proceed to Payment'
          )}
        </Button>
      </form>
    </Form>
  );
}