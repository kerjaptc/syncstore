'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  XCircle, 
  Package, 
  MapPin,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlertItem {
  inventoryItem: {
    id: string;
    quantityOnHand: number;
    quantityReserved: number;
    reorderPoint: number;
    reorderQuantity: number;
  };
  productVariant: {
    id: string;
    variantSku: string;
    name: string;
  };
  product: {
    id: string;
    sku: string;
    name: string;
  };
  location: {
    id: string;
    name: string;
  };
  availableQuantity?: number;
  alertLevel?: 'low' | 'critical';
}

interface StockAlertsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditItem?: (item: AlertItem) => void;
}

export function StockAlertsDialog({ 
  open, 
  onOpenChange, 
  onEditItem 
}: StockAlertsDialogProps) {
  const [alerts, setAlerts] = useState<{
    lowStock: AlertItem[];
    outOfStock: AlertItem[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/inventory/alerts');
      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchAlerts();
    }
  }, [open]);

  const totalAlerts = alerts ? alerts.lowStock.length + alerts.outOfStock.length : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Stock Alerts
            {totalAlerts > 0 && (
              <Badge variant="secondary">{totalAlerts}</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Items that need attention due to low or out of stock levels
          </DialogDescription>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAlerts}
            disabled={loading}
            className="w-fit"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : !alerts || totalAlerts === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium text-green-600">All Good!</p>
            <p className="text-muted-foreground">No stock alerts at this time</p>
          </div>
        ) : (
          <Tabs defaultValue="low-stock" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="low-stock" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Low Stock ({alerts.lowStock.length})
              </TabsTrigger>
              <TabsTrigger value="out-of-stock" className="flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Out of Stock ({alerts.outOfStock.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="low-stock" className="space-y-3 max-h-96 overflow-y-auto">
              {alerts.lowStock.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">No low stock items</p>
                </div>
              ) : (
                alerts.lowStock.map((item) => (
                  <div
                    key={`${item.inventoryItem.id}`}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{item.product.name}</div>
                        {item.productVariant.name !== item.product.name && (
                          <div className="text-sm text-muted-foreground">
                            {item.productVariant.name}
                          </div>
                        )}
                        <div className="text-xs font-mono text-muted-foreground">
                          SKU: {item.productVariant.variantSku}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.alertLevel === 'critical' && (
                          <Badge variant="destructive">Critical</Badge>
                        )}
                        <Badge variant="secondary">Low Stock</Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{item.location.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span>
                          Available: <span className="font-medium text-orange-600">
                            {item.availableQuantity?.toLocaleString() || 0}
                          </span>
                        </span>
                        <span>
                          Reorder at: <span className="font-medium">
                            {item.inventoryItem.reorderPoint.toLocaleString()}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditItem?.(item)}
                      >
                        Adjust Stock
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="out-of-stock" className="space-y-3 max-h-96 overflow-y-auto">
              {alerts.outOfStock.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">No out of stock items</p>
                </div>
              ) : (
                alerts.outOfStock.map((item) => (
                  <div
                    key={`${item.inventoryItem.id}`}
                    className="border border-red-200 bg-red-50/50 rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{item.product.name}</div>
                        {item.productVariant.name !== item.product.name && (
                          <div className="text-sm text-muted-foreground">
                            {item.productVariant.name}
                          </div>
                        )}
                        <div className="text-xs font-mono text-muted-foreground">
                          SKU: {item.productVariant.variantSku}
                        </div>
                      </div>
                      <Badge variant="destructive">Out of Stock</Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{item.location.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span>
                          On Hand: <span className="font-medium text-red-600">
                            {item.inventoryItem.quantityOnHand.toLocaleString()}
                          </span>
                        </span>
                        <span>
                          Reserved: <span className="font-medium text-blue-600">
                            {item.inventoryItem.quantityReserved.toLocaleString()}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditItem?.(item)}
                      >
                        Restock
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}