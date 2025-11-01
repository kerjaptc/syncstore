/**
 * Batch Sync Dashboard Page
 * Task 5.3: Build progress bar UI
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RealTimeProgressBar } from '@/components/ui/progress-bar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Play, Pause, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface BatchJob {
  batch_id: string;
  total_jobs: number;
  status: string;
  progress_percentage: number;
  started_at?: string;
  estimated_completion_time?: string;
}

export default function BatchSyncDashboard() {
  const [activeBatches, setActiveBatches] = useState<BatchJob[]>([]);
  const [queueStats, setQueueStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New batch form
  const [newBatch, setNewBatch] = useState({
    productIds: '',
    platform: 'both' as 'shopee' | 'tiktok' | 'both',
  });
  const [creating, setCreating] = useState(false);

  // Fetch queue statistics
  const fetchQueueStats = async () => {
    try {
      const response = await fetch('/api/sync/queue/stats');
      const data = await response.json();
      
      if (data.success) {
        setQueueStats(data.data.queue_stats);
      }
    } catch (err) {
      console.error('Error fetching queue stats:', err);
    }
  };

  // Create new batch
  const createBatch = async () => {
    if (!newBatch.productIds.trim()) {
      alert('Please enter product IDs');
      return;
    }

    setCreating(true);
    try {
      const productIds = newBatch.productIds
        .split('\n')
        .map(id => id.trim())
        .filter(id => id.length > 0);

      const response = await fetch('/api/sync/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_ids: productIds,
          platform: newBatch.platform,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Add to active batches
        setActiveBatches(prev => [...prev, {
          batch_id: data.batch_id,
          total_jobs: data.total_jobs,
          status: 'queued',
          progress_percentage: 0,
        }]);

        // Reset form
        setNewBatch({ productIds: '', platform: 'both' });
        
        // Refresh stats
        fetchQueueStats();
      } else {
        alert(`Error: ${data.error?.message || 'Failed to create batch'}`);
      }
    } catch (err) {
      console.error('Error creating batch:', err);
      alert('Network error occurred');
    } finally {
      setCreating(false);
    }
  };

  // Remove completed batch from active list
  const handleBatchComplete = (batchId: string, status: any) => {
    if (status.is_complete) {
      setTimeout(() => {
        setActiveBatches(prev => prev.filter(batch => batch.batch_id !== batchId));
      }, 5000); // Remove after 5 seconds
    }
  };

  useEffect(() => {
    fetchQueueStats();
    const interval = setInterval(fetchQueueStats, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Batch Sync Dashboard</h1>
          <p className="text-muted-foreground">Monitor and manage product synchronization batches</p>
        </div>
        <Button onClick={fetchQueueStats} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Queue Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Queue Statistics
          </CardTitle>
          <CardDescription>Real-time job queue status</CardDescription>
        </CardHeader>
        <CardContent>
          {queueStats ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{queueStats.active}</div>
                <div className="text-sm text-muted-foreground">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{queueStats.waiting}</div>
                <div className="text-sm text-muted-foreground">Waiting</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{queueStats.completed}</div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{queueStats.failed}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{queueStats.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">Loading statistics...</div>
          )}
        </CardContent>
      </Card>

      {/* Create New Batch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Play className="w-5 h-5 mr-2" />
            Create New Batch
          </CardTitle>
          <CardDescription>Start a new batch synchronization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="productIds">Product IDs (one per line)</Label>
              <textarea
                id="productIds"
                className="w-full h-32 p-3 border rounded-md resize-none"
                placeholder="Enter product IDs, one per line..."
                value={newBatch.productIds}
                onChange={(e) => setNewBatch(prev => ({ ...prev, productIds: e.target.value }))}
              />
              <div className="text-sm text-muted-foreground">
                {newBatch.productIds.split('\n').filter(id => id.trim()).length} products
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="platform">Target Platform</Label>
                <Select
                  value={newBatch.platform}
                  onValueChange={(value: 'shopee' | 'tiktok' | 'both') => 
                    setNewBatch(prev => ({ ...prev, platform: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shopee">Shopee Only</SelectItem>
                    <SelectItem value="tiktok">TikTok Shop Only</SelectItem>
                    <SelectItem value="both">Both Platforms</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={createBatch} 
                disabled={creating || !newBatch.productIds.trim()}
                className="w-full"
              >
                {creating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Creating Batch...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Batch Sync
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Batches */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <RefreshCw className="w-5 h-5 mr-2" />
            Active Batches
          </CardTitle>
          <CardDescription>Monitor running synchronization batches</CardDescription>
        </CardHeader>
        <CardContent>
          {activeBatches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No active batches. Create a new batch to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {activeBatches.map((batch) => (
                <div key={batch.batch_id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Batch {batch.batch_id}</h3>
                      <p className="text-sm text-muted-foreground">
                        {batch.total_jobs} products
                      </p>
                    </div>
                    <Badge variant="outline">
                      {batch.status}
                    </Badge>
                  </div>
                  
                  <RealTimeProgressBar
                    batchId={batch.batch_id}
                    showDetails={true}
                    size="md"
                    onStatusChange={(status) => handleBatchComplete(batch.batch_id, status)}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}