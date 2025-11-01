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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Table } from 'lucide-react';

interface OrderExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOrderIds?: string[];
  totalOrders: number;
  onExport: (options: {
    format: 'csv' | 'json';
    scope: 'selected' | 'filtered' | 'all';
    orderIds?: string[];
  }) => void;
  loading?: boolean;
}

export function OrderExportDialog({
  open,
  onOpenChange,
  selectedOrderIds = [],
  totalOrders,
  onExport,
  loading = false,
}: OrderExportDialogProps) {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [scope, setScope] = useState<'selected' | 'filtered' | 'all'>('filtered');

  const handleExport = () => {
    const options = {
      format,
      scope,
      orderIds: scope === 'selected' ? selectedOrderIds : undefined,
    };
    
    onExport(options);
  };

  const resetForm = () => {
    setFormat('csv');
    setScope('filtered');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const getExportCount = () => {
    switch (scope) {
      case 'selected':
        return selectedOrderIds.length;
      case 'filtered':
        return totalOrders;
      case 'all':
        return 'all';
      default:
        return 0;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Orders
          </DialogTitle>
          <DialogDescription>
            Choose export format and scope for your order data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Export Format */}
          <div>
            <Label className="text-base font-medium">Export Format</Label>
            <RadioGroup value={format} onValueChange={(value) => setFormat(value as 'csv' | 'json')} className="mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer">
                  <Table className="h-4 w-4" />
                  CSV (Comma Separated Values)
                  <Badge variant="secondary">Recommended</Badge>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="json" id="json" />
                <Label htmlFor="json" className="flex items-center gap-2 cursor-pointer">
                  <FileText className="h-4 w-4" />
                  JSON (JavaScript Object Notation)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Export Scope */}
          <div>
            <Label className="text-base font-medium">Export Scope</Label>
            <RadioGroup value={scope} onValueChange={(value) => setScope(value as any)} className="mt-2">
              {selectedOrderIds.length > 0 && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="selected" id="selected" />
                  <Label htmlFor="selected" className="flex items-center gap-2 cursor-pointer">
                    Selected Orders
                    <Badge variant="outline">{selectedOrderIds.length} orders</Badge>
                  </Label>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="filtered" id="filtered" />
                <Label htmlFor="filtered" className="flex items-center gap-2 cursor-pointer">
                  Current Filtered Results
                  <Badge variant="outline">{totalOrders} orders</Badge>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="cursor-pointer">
                  All Orders (No Filters)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Export Summary */}
          <div className="bg-muted p-3 rounded-md">
            <div className="text-sm">
              <div className="font-medium">Export Summary:</div>
              <div className="text-muted-foreground">
                Format: {format.toUpperCase()} • 
                Scope: {getExportCount()} order{getExportCount() !== 1 && getExportCount() !== 'all' ? 's' : ''}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={loading || (scope === 'selected' && selectedOrderIds.length === 0)}
          >
            {loading ? (
              'Exporting...'
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Orders
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}