'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Zap, 
  Store, 
  RefreshCw, 
  AlertTriangle, 
  Activity,
  Database,
  Settings,
  BarChart3,
  Shield,
  Bell
} from 'lucide-react';

// Import all SyncStore MVP Components
import { 
  // Core Components
  StoreConnectionWizard,
  ConnectionStatusDisplay,
  ProductDashboard,
  
  // Error Handling
  SyncStoreMvpErrorBoundary,
  ErrorDashboard,
  useErrorReporting,
  
  // Loading & Feedback
  LoadingSpinner,
  LoadingButton,
  ProgressIndicator,
  SyncProgressDisplay,
  OperationStatusList,
  ProductListSkeleton,
  ConnectionStatusSkeleton,
  DashboardSkeleton,
  EmptyState,
  LoadingOverlay,
  
  // Notifications
  NotificationProvider,
  NotificationPanel,
  NotificationBell,
  useNotifications,
  useNotificationHelpers,
  
  // Types
  type SyncProgress,
  type OperationStatus,
  type Notification,
  
  // Mock Data
  mockData,
  generateMockSyncProgress,
  generateMockOperation,
} from "@/lib/syncstore-mvp";

// Use mock data from the library
const initialSyncProgress = mockData.syncProgress;
const initialOperations = mockData.operations;

function SyncStoreMvpPageContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showSkeletons, setShowSkeletons] = useState(false);
  const [currentSyncProgress, setCurrentSyncProgress] = useState<SyncProgress>(initialSyncProgress);
  const [currentOperations, setCurrentOperations] = useState<OperationStatus[]>(initialOperations);
  
  const { notifications } = useNotifications();
  const { 
    showSuccess, 
    showError, 
    showWarning, 
    showInfo, 
    showSyncNotification,
    showConnectionNotification 
  } = useNotificationHelpers();

  const handleTestNotifications = () => {
    showSuccess('Success!', 'This is a success notification');
    setTimeout(() => showWarning('Warning!', 'This is a warning notification'), 1000);
    setTimeout(() => showError('Error!', 'This is an error notification'), 2000);
    setTimeout(() => showInfo('Info', 'This is an info notification'), 3000);
  };

  const handleTestSyncNotifications = () => {
    const storeId = 'demo-store';
    showSyncNotification('started', storeId);
    
    setTimeout(() => {
      showSyncNotification('progress', storeId, { 
        progress: 50, 
        itemsProcessed: 25, 
        totalItems: 50 
      });
    }, 2000);
    
    setTimeout(() => {
      showSyncNotification('completed', storeId, { itemsProcessed: 50 });
    }, 5000);
  };

  const handleTestConnectionNotifications = () => {
    const storeId = 'demo-store';
    showConnectionNotification('connected', storeId);
    
    setTimeout(() => {
      showConnectionNotification('disconnected', storeId);
    }, 3000);
    
    setTimeout(() => {
      showConnectionNotification('error', storeId, 'Connection timeout');
    }, 6000);
  };

  const handleTestLoadingOverlay = () => {
    setShowLoadingOverlay(true);
    setLoadingProgress(0);
    
    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setShowLoadingOverlay(false);
          return 0;
        }
        return prev + 10;
      });
    }, 500);
  };

  const handleTestSkeletons = () => {
    setShowSkeletons(true);
    setTimeout(() => setShowSkeletons(false), 3000);
  };

  const handleTestError = () => {
    throw new Error('This is a test error for the error boundary');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Zap className="h-8 w-8 text-blue-500" />
            SyncStore MVP Demo
          </h1>
          <p className="text-muted-foreground">
            Comprehensive demonstration of all SyncStore MVP components and features
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">
            {notifications.length} Active
          </Badge>
        </div>
      </div>

      {/* Feature Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Store className="h-8 w-8 text-green-500" />
              <div>
                <h3 className="font-semibold">Store Management</h3>
                <p className="text-sm text-muted-foreground">Connection & sync</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-red-500" />
              <div>
                <h3 className="font-semibold">Error Handling</h3>
                <p className="text-sm text-muted-foreground">Recovery & logging</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-blue-500" />
              <div>
                <h3 className="font-semibold">Real-time Updates</h3>
                <p className="text-sm text-muted-foreground">Live notifications</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-purple-500" />
              <div>
                <h3 className="font-semibold">Performance</h3>
                <p className="text-sm text-muted-foreground">Optimized & cached</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Demo Tabs */}
      <Tabs defaultValue="components" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="loading">Loading States</TabsTrigger>
          <TabsTrigger value="errors">Error Handling</TabsTrigger>
          <TabsTrigger value="sync">Sync Progress</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboards</TabsTrigger>
        </TabsList>

        {/* Components Tab */}
        <TabsContent value="components" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Core Components</CardTitle>
              <CardDescription>
                Main UI components for store management and product synchronization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Connection Status */}
              <div>
                <h4 className="font-medium mb-3">Connection Status Display</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ConnectionStatusDisplay
                    storeId="demo-store-1"
                    organizationId="demo-org"
                    onConnectionDeleted={() => console.log('Connection deleted')}
                    onConnectionUpdated={(connection) => console.log('Connection updated:', connection)}
                  />
                  <ConnectionStatusDisplay
                    storeId="demo-store-2"
                    organizationId="demo-org"
                    onConnectionDeleted={() => console.log('Connection deleted')}
                    onConnectionUpdated={(connection) => console.log('Connection updated:', connection)}
                  />
                </div>
              </div>

              {/* Store Connection Wizard */}
              <div>
                <h4 className="font-medium mb-3">Store Connection Wizard</h4>
                <Button onClick={() => setShowWizard(true)}>
                  <Store className="h-4 w-4 mr-2" />
                  Open Connection Wizard
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Test Notifications</CardTitle>
                <CardDescription>
                  Try different types of notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={handleTestNotifications} className="w-full">
                  <Bell className="h-4 w-4 mr-2" />
                  Test Basic Notifications
                </Button>
                <Button onClick={handleTestSyncNotifications} className="w-full" variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Test Sync Notifications
                </Button>
                <Button onClick={handleTestConnectionNotifications} className="w-full" variant="outline">
                  <Store className="h-4 w-4 mr-2" />
                  Test Connection Notifications
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Live Notifications</CardTitle>
                <CardDescription>
                  Real-time notification panel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <NotificationPanel maxHeight="400px" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Loading States Tab */}
        <TabsContent value="loading" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Loading Components</CardTitle>
                <CardDescription>
                  Various loading states and indicators
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Loading Spinners</h4>
                  <div className="flex items-center gap-4">
                    <LoadingSpinner size="sm" />
                    <LoadingSpinner size="default" />
                    <LoadingSpinner size="lg" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Progress Indicator</h4>
                  <ProgressIndicator 
                    progress={65} 
                    message="Processing products..." 
                  />
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Loading Buttons</h4>
                  <div className="flex gap-2">
                    <LoadingButton
                      isLoading={isLoading}
                      loadingText="Processing..."
                      onClick={() => {
                        setIsLoading(true);
                        setTimeout(() => setIsLoading(false), 3000);
                      }}
                    >
                      Test Loading
                    </LoadingButton>
                    <Button onClick={handleTestLoadingOverlay} variant="outline">
                      Test Overlay
                    </Button>
                    <Button onClick={handleTestSkeletons} variant="outline">
                      Test Skeletons
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Skeleton Loaders</CardTitle>
                <CardDescription>
                  Loading placeholders for better UX
                </CardDescription>
              </CardHeader>
              <CardContent>
                {showSkeletons ? (
                  <div className="space-y-4">
                    <ConnectionStatusSkeleton />
                    <ProductListSkeleton count={3} />
                  </div>
                ) : (
                  <EmptyState
                    title="No Loading State"
                    description="Click 'Test Skeletons' to see loading placeholders"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Error Handling Tab */}
        <TabsContent value="errors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Error Handling & Recovery</CardTitle>
              <CardDescription>
                Comprehensive error management system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={handleTestError} variant="destructive">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Test Error Boundary
                </Button>
                <Button onClick={() => showError('Test Error', 'This is a test error message')} variant="outline">
                  Test Error Notification
                </Button>
              </div>
              
              <div className="mt-6">
                <ErrorDashboard 
                  className="border rounded-lg"
                  refreshInterval={30000}
                  showFilters={true}
                  showExportOptions={true}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sync Progress Tab */}
        <TabsContent value="sync" className="space-y-6">
          <div className="space-y-6">
            <div className="flex gap-2 mb-4">
              <Button 
                variant="outline" 
                onClick={() => setCurrentSyncProgress(generateMockSyncProgress('connecting'))}
              >
                Test Connecting
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setCurrentSyncProgress(generateMockSyncProgress('processing'))}
              >
                Test Processing
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setCurrentSyncProgress(generateMockSyncProgress('completed'))}
              >
                Test Completed
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setCurrentOperations([...currentOperations, generateMockOperation()])}
              >
                Add Operation
              </Button>
            </div>
            
            <SyncProgressDisplay
              syncProgress={currentSyncProgress}
              onCancel={() => {
                console.log('Sync cancelled');
                setCurrentSyncProgress(generateMockSyncProgress('error'));
              }}
            />

            <Card>
              <CardHeader>
                <CardTitle>Operation Status</CardTitle>
                <CardDescription>
                  Monitor all running operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OperationStatusList
                  operations={currentOperations}
                  onCancel={(id) => {
                    console.log('Cancel:', id);
                    setCurrentOperations(ops => ops.map(op => 
                      op.id === id ? { ...op, status: 'cancelled' as const } : op
                    ));
                  }}
                  onRetry={(id) => {
                    console.log('Retry:', id);
                    setCurrentOperations(ops => ops.map(op => 
                      op.id === id ? { ...op, status: 'running' as const, progress: 0 } : op
                    ));
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <ProductDashboard
            storeId="demo-store"
            organizationId="demo-org"
          />
        </TabsContent>
      </Tabs>

      {/* Store Connection Wizard */}
      {showWizard && (
        <StoreConnectionWizard
          organizationId="demo-org"
          onConnectionComplete={(connection) => {
            console.log('Store connected:', connection);
            setShowWizard(false);
            showConnectionNotification('connected', connection.storeId || 'new-store');
          }}
          onCancel={() => setShowWizard(false)}
        />
      )}

      {/* Loading Overlay */}
      <LoadingOverlay
        isVisible={showLoadingOverlay}
        message="Processing your request..."
        progress={loadingProgress}
        onCancel={() => setShowLoadingOverlay(false)}
      />
    </div>
  );
}

// Wrap with Error Boundary and Notification Provider
export default function SyncStoreMvpPage() {
  return (
    <SyncStoreMvpErrorBoundary context="SyncStore MVP Demo">
      <NotificationProvider>
        <SyncStoreMvpPageContent />
      </NotificationProvider>
    </SyncStoreMvpErrorBoundary>
  );
}