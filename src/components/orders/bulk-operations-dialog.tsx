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
import { OrderStatus, FinancialStatus, FulfillmentStatus } from '@/types';

interface BulkOperationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOrderIds: string[];
  onConfirm: (data: {
    status?: OrderStatus;
    financialStatus?: FinancialStatus;
    fulfillmentStatus?: FulfillmentStatus;
    notes?: string;
  }) => void;
  loading?: boolean;
}

export function BulkOperationsDialog({
  open,
  onOpenChange,
  selectedOrderIds,
  onConfirm,
  loading = false,
}: BulkOperationsDialogProps) {
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [financialStatus, setFinancialStatus] = useState<FinancialStatus | undefined>();
  const [fulfillmentStatus, setFulfillmentStatus] = useState<FulfillmentStatus | undefined>();
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    const data: any = {};
    
    if (status) data.status = status;
    if (financialStatus) data.financialStatus = financialStatus;
    if (fulfillmentStatus) data.fulfillmentStatus = fulfillmentStatus;
    if (notes) data.notes = notes;
    
    onConfirm(data);
  };

  const resetForm = () => {
    setStatus(undefined);
    setFinancialStatus(undefined);
    setFulfillmentStatus(undefined);
    setNotes('');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const hasChanges = status || financialStatus || fulfillmentStatus || notes;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Update Orders</DialogTitle>
          <DialogDescription>
            Update status for {selectedOrderIds.length} selected order{selectedOrderIds.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Selected orders:</span>
            <Badge variant="secondary">
              {selectedOrderIds.length} order{selectedOrderIds.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          <div>
            <Label htmlFor="status">Order Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as OrderStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Keep current status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="financialStatus">Financial Status</Label>
            <Select value={financialStatus} onValueChange={(value) => setFinancialStatus(value as FinancialStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Keep current status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="fulfillmentStatus">Fulfillment Status</Label>
            <Select value={fulfillmentStatus} onValueChange={(value) => setFulfillmentStatus(value as FulfillmentStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Keep current status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unfulfilled">Unfulfilled</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="fulfilled">Fulfilled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes to all selected orders..."
              rows={3}
            />
          </div>

          {!hasChanges && (
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
              Select at least one field to update.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !hasChanges}
          >
            {loading ? 'Updating...' : `Update ${selectedOrderIds.length} Order${selectedOrderIds.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}