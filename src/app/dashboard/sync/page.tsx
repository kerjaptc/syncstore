'use client';

import { useState } from 'react';
import { requireAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Play, Activity, AlertTriangle } from 'lucide-react';

// Import SyncStore MVP Components
import { 
  SyncProgressDisplay,
  OperationStatusList,
  ErrorDashboard,
  NotificationProvider,
  NotificationPanel,
  LoadingButton,
  useNotificationHelpers,
  type SyncProgress,
  type OperationStatus
} from "@/lib/syncstore-mvp";

// Mock data for demonstration
const mockSyncProgress: SyncProgress = {
  stage: 'processing',
  progress: 65,
  totalItems: 150,
  processedItems: 98,
  currentItem: 'Smartphone Samsung Galaxy A54',
  message: 'Memproses produk dari Shopee...',
  startTime: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
  estimatedTimeRemaining: 120, // 2 minutes
  errors: [
    'Produk "Laptop Gaming" tidak memiliki gambar',
    'SKU duplikat ditemukan untuk "Mouse Wireless"'
  ]
};

const mockOperations: OperationStatus[] = [
  {
    id: '1',
    type: 'sync',
    status: 'running',
    progress: 75,
    message: 'Sinkronisasi produk Toko Elektronik',
    startTime: new Date(Date.now() - 3 * 60 * 1000),
  },
  {
    id: '2',
    type: 'fetch',
    status: 'completed',
    progress: 100,
    message: 'Mengambil data pesanan dari Shopee',
    startTime: new Date(Date.now() - 10 * 60 * 1000),
    endTime: new Date(Date.now() - 8 * 60 * 1000),
  },
  {
    id: '3',
    type: 'connect',
    status: 'failed',
    progress: 0,
    message: 'Menghubungkan ke Fashion Store',
    startTime: new Date(Date.now() - 15 * 60 * 1000),
    endTime: new Date(Date.now() - 14 * 60 * 1000),
    error: 'Token expired - perlu reauthorization'
  }
];

function SyncPageContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [showLegacyView, setShowLegacyView] = useState(false);
  const { showSyncNotification } = useNotificationHelpers();

  const handleSyncNow = async () => {
    setIsLoading(true);
    try {
      // Simulate sync operation
      showSyncNotification('started', 'all-stores');
      await new Promise(resolve => setTimeout(resolve, 2000));
      showSyncNotification('completed', 'all-stores', { itemsProcessed: 150 });
    } catch (error) {
      showSyncNotification('failed', 'all-stores', { error: 'Sync failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelOperation = (operationId: string) => {
    console.log('Cancelling operation:', operationId);
  };

  const handleRetryOperation = (operationId: string) => {
    console.log('Retrying operation:', operationId);
  };

  if (showLegacyView) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Synchronization</h1>
            <p className="text-muted-foreground">
              Monitor and manage data synchronization
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowLegacyView(false)}
            >
              SyncStore MVP
            </Button>
            <Button disabled>
              <Play className="h-4 w-4 mr-2" />
              Sync Now
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Sync Management
            </CardTitle>
            <CardDescription>
              Legacy sync management interface
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Sync status monitoring, job scheduling, error logs, and manual sync triggers will be available here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Synchronization</h1>
          <p className="text-muted-foreground">
            Monitor and manage data synchronization with SyncStore MVP
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowLegacyView(true)}
          >
            Legacy View
          </Button>
          <LoadingButton
            isLoading={isLoading}
            loadingText="Syncing..."
            onClick={handleSyncNow}
          >
            <Play className="h-4 w-4 mr-2" />
            Sync Now
          </LoadingButton>
        </div>
      </div>

      {/* Current Sync Progress */}
      <SyncProgressDisplay
        syncProgress={mockSyncProgress}
        onCancel={() => console.log('Sync cancelled')}
      />

      {/* Operations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Operations
          </CardTitle>
          <CardDescription>
            Monitor all sync and data operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OperationStatusList
            operations={mockOperations}
            onCancel={handleCancelOperation}
            onRetry={handleRetryOperation}
          />
        </CardContent>
      </Card>

      {/* Notifications Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Live Notifications
          </CardTitle>
          <CardDescription>
            Real-time sync and error notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationPanel maxHeight="300px" compact />
        </CardContent>
      </Card>

      {/* Error Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Error Monitoring
          </CardTitle>
          <CardDescription>
            Comprehensive error tracking and recovery
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ErrorDashboard 
            className="border-0 shadow-none p-0"
            refreshInterval={60000}
            showFilters={false}
            showExportOptions={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// Wrap with NotificationProvider
export default function SyncPage() {
  return (
    <NotificationProvider>
      <SyncPageContent />
    </NotificationProvider>
  );
}