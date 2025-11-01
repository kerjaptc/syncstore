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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OrderStatus, FinancialStatus, FulfillmentStatus } from '@/types';

interface OrderStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: {
    status?: OrderStatus;
    financialStatus?: FinancialStatus;
    fulfillmentStatus?: FulfillmentStatus;
    trackingNumber?: string;
    carrier?: string;
    notes?: string;
  }) => void;
  title: string;
  description: string;
  type: 'status' | 'fulfill' | 'cancel';
  loading?: boolean;
}

export function OrderStatusDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  type,
  loading = false,
}: OrderStatusDialogProps) {
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [financialStatus, setFinancialStatus] = useState<FinancialStatus | undefined>();
  const [fulfillmentStatus, setFulfillmentStatus] = useState<FulfillmentStatus | undefined>();
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    const data: any = {};
    
    if (type === 'status') {
      if (status) data.status = status;
      if (financialStatus) data.financialStatus = financialStatus;
      if (fulfillmentStatus) data.fulfillmentStatus = fulfillmentStatus;
    } else if (type === 'fulfill') {
      data.fulfillmentStatus = 'fulfilled';
      if (trackingNumber) data.trackingNumber = trackingNumber;
      if (carrier) data.carrier = carrier;
    } else if (type === 'cancel') {
      data.status = 'cancelled';
      data.fulfillmentStatus = 'unfulfilled';
    }
    
    if (notes) data.notes = notes;
    
    onConfirm(data);
  };

  const resetForm = () => {
    setStatus(undefined);
    setFinancialStatus(undefined);
    setFulfillmentStatus(undefined);
    setTrackingNumber('');
    setCarrier('');
    setNotes('');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {type === 'status' && (
            <>
              <div>
                <Label htmlFor="status">Order Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as OrderStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
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
                    <SelectValue placeholder="Select financial status" />
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
                    <SelectValue placeholder="Select fulfillment status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unfulfilled">Unfulfilled</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="fulfilled">Fulfilled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {type === 'fulfill' && (
            <>
              <div>
                <Label htmlFor="trackingNumber">Tracking Number (Optional)</Label>
                <Input
                  id="trackingNumber"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number"
                />
              </div>

              <div>
                <Label htmlFor="carrier">Carrier (Optional)</Label>
                <Input
                  id="carrier"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="e.g., JNE, J&T, SiCepat"
                />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="notes">
              {type === 'cancel' ? 'Cancellation Reason' : 'Notes'} (Optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                type === 'cancel' 
                  ? 'Enter reason for cancellation...' 
                  : 'Add any additional notes...'
              }
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading}
            variant={type === 'cancel' ? 'destructive' : 'default'}
          >
            {loading ? 'Processing...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}