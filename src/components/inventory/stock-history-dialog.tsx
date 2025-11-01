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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  History, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw,
  User,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { PaginatedResponse } from '@/types';

interface StockTransaction {
  transaction: {
    id: string;
    transactionType: string;
    quantityChange: number;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
    createdAt: string;
  };
  inventoryItem: {
    id: string;
    quantityOnHand: number;
    quantityReserved: number;
  };
  user?: {
    id: string;
    fullName?: string;
    email: string;
  };
}

interface StockHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productVariantId: string | null;
  locationId: string | null;
  productName?: string;
  variantName?: string;
}

export function StockHistoryDialog({
  open,
  onOpenChange,
  productVariantId,
  locationId,
  productName,
  variantName,
}: StockHistoryDialogProps) {
  const [history, setHistory] = useState<PaginatedResponse<StockTransaction> | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const fetchHistory = async () => {
    if (!productVariantId) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        productVariantId,
        page: page.toString(),
        limit: '20',
      });

      if (locationId) {
        params.append('locationId', locationId);
      }

      const response = await fetch(`/api/inventory/history?${params}`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('Error fetching stock history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && productVariantId) {
      setPage(1);
      fetchHistory();
    }
  }, [open, productVariantId, locationId]);

  useEffect(() => {
    if (open && productVariantId) {
      fetchHistory();
    }
  }, [page]);

  const getTransactionIcon = (type: string, change: number) => {
    if (change > 0) {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    } else {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    }
  };

  const getTransactionBadge = (type: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      adjustment: { variant: 'secondary', label: 'Adjustment' },
      sale: { variant: 'destructive', label: 'Sale' },
      purchase: { variant: 'default', label: 'Purchase' },
      transfer: { variant: 'outline', label: 'Transfer' },
      reservation: { variant: 'secondary', label: 'Reservation' },
    };

    const config = variants[type] || { variant: 'outline', label: type };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Stock Movement History
          </DialogTitle>
          <DialogDescription>
            {productName && (
              <div>
                <span className="font-medium">{productName}</span>
                {variantName && variantName !== productName && (
                  <span className="text-muted-foreground"> - {variantName}</span>
                )}
              </div>
            )}
          </DialogDescription>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHistory}
            disabled={loading}
            className="w-fit"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : !history || history.data.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No stock movements found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.data.map((item) => (
                    <TableRow key={item.transaction.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {format(new Date(item.transaction.createdAt), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(item.transaction.createdAt), 'HH:mm:ss')}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getTransactionBadge(item.transaction.transactionType)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {getTransactionIcon(item.transaction.transactionType, item.transaction.quantityChange)}
                          <span className={cn(
                            "font-medium",
                            item.transaction.quantityChange > 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {item.transaction.quantityChange > 0 ? '+' : ''}
                            {item.transaction.quantityChange.toLocaleString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.transaction.referenceType && item.transaction.referenceId ? (
                          <div className="text-sm">
                            <div className="font-medium capitalize">
                              {item.transaction.referenceType}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {item.transaction.referenceId}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.user ? (
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <div className="text-sm">
                              <div className="font-medium">
                                {item.user.fullName || 'Unknown User'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {item.user.email}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">System</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.transaction.notes ? (
                          <div className="text-sm max-w-xs truncate" title={item.transaction.notes}>
                            {item.transaction.notes}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {history.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, history.pagination.total)} of{' '}
                    {history.pagination.total} transactions
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= history.pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}