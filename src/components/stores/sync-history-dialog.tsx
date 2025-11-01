'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  RefreshCw,
  Download,
  Upload,
  Loader2,
  Calendar,
  Filter
} from 'lucide-react';
import { StoreWithRelations, SyncJobWithLogs } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface SyncHistoryDialogProps {
  store: StoreWithRelations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SyncLog {
  id: string;
  jobType: string;
  status: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  error?: string;
  logs: {
    level: string;
    message: string;
    timestamp: Date;
    details?: any;
  }[];
}

export function SyncHistoryDialog({ 
  store, 
  open, 
  onOpenChange 
}: SyncHistoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [syncHistory, setSyncHistory] = useState<SyncLog[]>([]);
  const [selectedJob, setSelectedJob] = useState<SyncLog | null>(null);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed' | 'running'>('all');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchSyncHistory();
    }
  }, [open, store.id]);

  const fetchSyncHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/stores/${store.id}/sync-history`);
      if (!response.ok) throw new Error('Failed to fetch sync history');
      
      const data = await response.json();
      setSyncHistory(data.history || []);
    } catch (error) {
      console.error('Error fetching sync history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load sync history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerManualSync = async (syncType: 'products' | 'inventory' | 'orders') => {
    try {
      const response = await fetch(`/api/stores/${store.id}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: syncType }),
      });

      if (!response.ok) throw new Error('Failed to trigger sync');

      toast({
        title: 'Success',
        description: `${syncType} sync started successfully`,
      });

      // Refresh history after a short delay
      setTimeout(fetchSyncHistory, 1000);
    } catch (error) {
      console.error('Error triggering sync:', error);
      toast({
        title: 'Error',
        description: `Failed to start ${syncType} sync`,
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Running</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getJobTypeIcon = (jobType: string) => {
    switch (jobType) {
      case 'product_sync':
        return <RefreshCw className="h-4 w-4" />;
      case 'inventory_push':
        return <Upload className="h-4 w-4" />;
      case 'order_fetch':
        return <Download className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A';
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
  };

  const formatJobType = (jobType: string) => {
    switch (jobType) {
      case 'product_sync':
        return 'Product Sync';
      case 'inventory_push':
        return 'Inventory Push';
      case 'order_fetch':
        return 'Order Fetch';
      default:
        return jobType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const filteredHistory = syncHistory.filter(job => {
    if (filter === 'all') return true;
    if (filter === 'success') return job.status === 'completed';
    if (filter === 'failed') return job.status === 'failed';
    if (filter === 'running') return job.status === 'running';
    return true;
  });

  const renderSyncHistory = () => (
    <div className="space-y-4">
      {/* Manual Sync Triggers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Manual Sync</CardTitle>
          <CardDescription>Trigger immediate synchronization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => triggerManualSync('products')}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Products
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => triggerManualSync('inventory')}
            >
              <Upload className="h-4 w-4 mr-2" />
              Push Inventory
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => triggerManualSync('orders')}
            >
              <Download className="h-4 w-4 mr-2" />
              Fetch Orders
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(value) => setFilter(value as any)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="success">Success</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
          <TabsTrigger value="running">Running</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* History List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sync history found
            </div>
          ) : (
            filteredHistory.map((job) => (
              <Card 
                key={job.id} 
                className={`cursor-pointer transition-colors ${
                  selectedJob?.id === job.id ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
                }`}
                onClick={() => setSelectedJob(job)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getJobTypeIcon(job.jobType)}
                      <div>
                        <div className="font-medium">{formatJobType(job.jobType)}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(job.startedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-sm">
                        <div>{job.itemsSucceeded}/{job.itemsProcessed} items</div>
                        <div className="text-muted-foreground">
                          {formatDuration(job.duration)}
                        </div>
                      </div>
                      {getStatusBadge(job.status)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const renderJobDetails = () => {
    if (!selectedJob) {
      return (
        <div className="flex items-center justify-center h-[400px] text-muted-foreground">
          Select a sync job to view details
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              {getJobTypeIcon(selectedJob.jobType)}
              {formatJobType(selectedJob.jobType)}
            </CardTitle>
            <CardDescription>
              {new Date(selectedJob.startedAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium">Status</div>
                <div className="mt-1">{getStatusBadge(selectedJob.status)}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Duration</div>
                <div className="mt-1 text-sm">{formatDuration(selectedJob.duration)}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Items Processed</div>
                <div className="mt-1 text-sm">{selectedJob.itemsProcessed}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Success Rate</div>
                <div className="mt-1 text-sm">
                  {selectedJob.itemsProcessed > 0 
                    ? `${Math.round((selectedJob.itemsSucceeded / selectedJob.itemsProcessed) * 100)}%`
                    : 'N/A'
                  }
                </div>
              </div>
            </div>

            {selectedJob.error && (
              <div>
                <div className="text-sm font-medium text-destructive">Error</div>
                <div className="mt-1 text-sm bg-destructive/10 p-2 rounded">
                  {selectedJob.error}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {selectedJob.logs.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No logs available</div>
                ) : (
                  selectedJob.logs.map((log, index) => (
                    <div key={index} className="text-sm">
                      <div className="flex items-start gap-2">
                        <Badge 
                          variant={log.level === 'error' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {log.level}
                        </Badge>
                        <div className="flex-1">
                          <div>{log.message}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      {index < selectedJob.logs.length - 1 && (
                        <Separator className="my-2" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Sync History - {store.name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium mb-4">Recent Sync Jobs</h3>
            {renderSyncHistory()}
          </div>
          <div>
            <h3 className="font-medium mb-4">Job Details</h3>
            {renderJobDetails()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}