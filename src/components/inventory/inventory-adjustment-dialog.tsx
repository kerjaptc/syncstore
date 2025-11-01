'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InventoryItem {
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
  availableQuantity: number;
}

interface InventoryAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | null;
  locationId: string;
  onSuccess?: () => void;
}

export function InventoryAdjustmentDialog({
  open,
  onOpenChange,
  item,
  locationId,
  onSuccess,
}: InventoryAdjustmentDialogProps) {
  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('increase');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [reorderPoint, setReorderPoint] = useState('');
  const [reorderQuantity, setReorderQuantity] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialize form when item changes
  useState(() => {
    if (item) {
      setReorderPoint(item.inventoryItem.reorderPoint.toString());
      setReorderQuantity(item.inventoryItem.reorderQuantity.toString());
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !quantity) return;

    try {
      setLoading(true);

      const quantityChange = adjustmentType === 'increase' 
        ? parseInt(quantity) 
        : -parseInt(quantity);

      // Submit inventory adjustment
      const adjustmentResponse = await fetch('/api/inventory/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustments: [{
            productVariantId: item.productVariant.id,
            locationId,
            quantityChange,
            notes: notes || `${adjustmentType === 'increase' ? 'Increase' : 'Decrease'} by ${quantity}`,
          }],
        }),
      });

      if (!adjustmentResponse.ok) {
        throw new Error('Failed to adjust inventory');
      }

      // Update reorder points if changed
      const newReorderPoint = parseInt(reorderPoint) || 0;
      const newReorderQuantity = parseInt(reorderQuantity) || 0;

      if (newReorderPoint !== item.inventoryItem.reorderPoint || 
          newReorderQuantity !== item.inventoryItem.reorderQuantity) {
        const reorderResponse = await fetch('/api/inventory/reorder-points', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updates: [{
              inventoryItemId: item.inventoryItem.id,
              reorderPoint: newReorderPoint,
              reorderQuantity: newReorderQuantity,
            }],
          }),
        });

        if (!reorderResponse.ok) {
          throw new Error('Failed to update reorder points');
        }
      }

      // Reset form
      setQuantity('');
      setNotes('');
      setAdjustmentType('increase');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error adjusting inventory:', error);
      // TODO: Show error toast
    } finally {
      setLoading(false);
    }
  };

  const newQuantity = item ? (
    adjustmentType === 'increase' 
      ? item.inventoryItem.quantityOnHand + (parseInt(quantity) || 0)
      : item.inventoryItem.quantityOnHand - (parseInt(quantity) || 0)
  ) : 0;

  const newAvailable = item ? (
    newQuantity - item.inventoryItem.quantityReserved
  ) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adjust Inventory</DialogTitle>
          <DialogDescription>
            Update stock levels and reorder settings for this item
          </DialogDescription>
        </DialogHeader>

        {item && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Product Info */}
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="font-medium">{item.product.name}</div>
              {item.productVariant.name !== item.product.name && (
                <div className="text-sm text-muted-foreground">
                  {item.productVariant.name}
                </div>
              )}
              <div className="text-sm font-mono text-muted-foreground mt-1">
                SKU: {item.productVariant.variantSku}
              </div>
            </div>

            {/* Current Stock */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{item.inventoryItem.quantityOnHand}</div>
                <div className="text-xs text-muted-foreground">On Hand</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {item.inventoryItem.quantityReserved}
                </div>
                <div className="text-xs text-muted-foreground">Reserved</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {item.availableQuantity}
                </div>
                <div className="text-xs text-muted-foreground">Available</div>
              </div>
            </div>

            {/* Adjustment */}
            <div className="space-y-3">
              <Label>Stock Adjustment</Label>
              <div className="flex gap-2">
                <Select value={adjustmentType} onValueChange={(value: 'increase' | 'decrease') => setAdjustmentType(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-green-600" />
                        Increase
                      </div>
                    </SelectItem>
                    <SelectItem value="decrease">
                      <div className="flex items-center gap-2">
                        <Minus className="h-4 w-4 text-red-600" />
                        Decrease
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="1"
                  className="flex-1"
                />
              </div>

              {quantity && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">Preview:</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">New on hand:</span>
                      <span className={cn(
                        "ml-2 font-medium",
                        newQuantity < 0 ? "text-red-600" : "text-green-600"
                      )}>
                        {newQuantity.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">New available:</span>
                      <span className={cn(
                        "ml-2 font-medium",
                        newAvailable < 0 ? "text-red-600" : "text-green-600"
                      )}>
                        {newAvailable.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {newQuantity < 0 && (
                    <div className="mt-2 text-xs text-red-600">
                      Warning: This will result in negative stock
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Reorder Settings */}
            <div className="space-y-3">
              <Label>Reorder Settings</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="reorderPoint" className="text-xs">Reorder Point</Label>
                  <Input
                    id="reorderPoint"
                    type="number"
                    placeholder="0"
                    value={reorderPoint}
                    onChange={(e) => setReorderPoint(e.target.value)}
                    min="0"
                  />
                </div>
                <div>
                  <Label htmlFor="reorderQuantity" className="text-xs">Reorder Quantity</Label>
                  <Input
                    id="reorderQuantity"
                    type="number"
                    placeholder="0"
                    value={reorderQuantity}
                    onChange={(e) => setReorderQuantity(e.target.value)}
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Reason for adjustment..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!quantity || loading}
                className={cn(
                  adjustmentType === 'increase' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                )}
              >
                {loading ? 'Adjusting...' : `${adjustmentType === 'increase' ? 'Increase' : 'Decrease'} Stock`}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}