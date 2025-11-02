/**
 * SyncStore MVP Connection Status Display
 * 
 * This component displays real-time connection status with health monitoring,
 * error handling, and management actions.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  RefreshCw, 
  Settings, 
  Trash2,
  ExternalLink,
  Clock,
  Activity,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface ConnectionStatusDisplayProps {
  storeId: string;
  organizationId: string;
  onConnectionDeleted?: () => void;
  onConnectionUpdated?: (connection: any) => void;
}

interface ConnectionHealth {
  isValid: boolean;
  error?: string;
  lastChecked: Date;
  responseTime?: number;
}

interface MockConnection {
  id: string;
  storeId: string;
  storeName: string;
  platform: string;
  status: 'active' | 'expired' | 'error';
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  credentials: {
    expiresAt: Date;
  };
}

// ============================================================================
// Connection Status Display Component
// ============================================================================

export function ConnectionStatusDisplay({
  storeId,
  organizationId,
  onConnectionDeleted,
  onConnectionUpdated,
}: ConnectionStatusDisplayProps) {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>({
    isValid: true,
    lastChecked: new Date(),
    responseTime: 250,
  });

  // Mock connection data
  const [connectionData, setConnectionData] = useState<MockConnection>({
    id: 'conn_' + storeId,
    storeId,
    storeName: `Demo Store ${storeId.slice(-3)}`,
    platform: 'shopee',
    status: Math.random() > 0.7 ? 'error' : 'active',
    lastSyncAt: new Date(Date.now() - Math.random() * 2 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
    credentials: {
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    },
  });

  const [isLoadingConnection, setIsLoadingConnection] = useState(false);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  // ============================================================================
  // Mock API Functions
  // ============================================================================

  const refreshConnection = {
    mutate: async () => {
      setIsRefreshing(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const updatedConnection = {
          ...connectionData,
          status: 'active' as const,
          updatedAt: new Date(),
          credentials: {
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        };
        
        setConnectionData(updatedConnection);
        setConnectionHealth({
          isValid: true,
          lastChecked: new Date(),
          responseTime: 180,
        });
        
        toast({
          title: 'Connection Refreshed',
          description: 'Store connection has been successfully refreshed',
        });
        
        onConnectionUpdated?.(updatedConnection);
      } catch (error) {
        toast({
          title: 'Refresh Failed',
          description: 'Failed to refresh store connection',
          variant: 'destructive',
        });
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  const deleteConnection = {
    mutate: async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        toast({
          title: 'Connection Deleted',
          description: 'Store connection has been deleted successfully',
        });
        
        onConnectionDeleted?.();
      } catch (error) {
        toast({
          title: 'Delete Failed',
          description: 'Failed to delete store connection',
          variant: 'destructive',
        });
      }
    }
  };

  const validateConnection = async () => {
    setIsLoadingHealth(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const isValid = Math.random() > 0.3; // 70% success rate
      const responseTime = Math.floor(Math.random() * 500) + 100;
      
      setConnectionHealth({
        isValid,
        lastChecked: new Date(),
        responseTime,
        error: isValid ? undefined : 'Connection timeout',
      });
      
      if (isValid) {
        toast({
          title: 'Connection Valid',
          description: `Connection is healthy (${responseTime}ms response time)`,
        });
      } else {
        toast({
          title: 'Connection Issues',
          description: 'Connection validation failed',
          variant: 'destructive',
        });
      }
    } catch (error) {
      setConnectionHealth({
        isValid: false,
        lastChecked: new Date(),
        error: 'Validation failed',
      });
      
      toast({
        title: 'Validation Failed',
        description: 'Failed to validate connection',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingHealth(false);
    }
  };

  // ============================================================================
  // Helper Functions
  // ============================================================================

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'expired':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Active</Badge>;
      case 'expired':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Expired</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800 border-red-300">Error</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const isTokenExpiring = () => {
    const now = new Date();
    const expiresAt = connectionData.credentials.expiresAt;
    const daysUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7;
  };

  // ============================================================================
  // Auto-refresh health check
  // ============================================================================

  useEffect(() => {
    const interval = setInterval(() => {
      if (connectionData.status === 'active') {
        validateConnection();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [connectionData.status]);

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoadingConnection) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading connection...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(connectionData.status)}
            <div>
              <CardTitle className="text-lg">{connectionData.storeName}</CardTitle>
              <CardDescription>
                {connectionData.platform.charAt(0).toUpperCase() + connectionData.platform.slice(1)} Store
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(connectionData.status)}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Connection Health */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Connection Health</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={validateConnection}
              disabled={isLoadingHealth}
            >
              {isLoadingHealth ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Activity className="h-4 w-4" />
              )}
            </Button>
          </div>

          {connectionHealth.isValid ? (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>Healthy</span>
              {connectionHealth.responseTime && (
                <span className="text-muted-foreground">
                  ({connectionHealth.responseTime}ms)
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <XCircle className="h-4 w-4" />
              <span>{connectionHealth.error || 'Unhealthy'}</span>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Last checked: {getTimeAgo(connectionHealth.lastChecked)}
          </div>
        </div>

        {/* Token Expiry Warning */}
        {isTokenExpiring() && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Access token expires on {formatDate(connectionData.credentials.expiresAt)}.
              Consider refreshing the connection.
            </AlertDescription>
          </Alert>
        )}

        {/* Connection Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-muted-foreground">Store ID</span>
            <p className="font-mono text-xs bg-muted px-2 py-1 rounded mt-1">
              {connectionData.storeId}
            </p>
          </div>
          <div>
            <span className="font-medium text-muted-foreground">Last Sync</span>
            <p className="mt-1">
              {connectionData.lastSyncAt ? getTimeAgo(connectionData.lastSyncAt) : 'Never'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-muted-foreground">Connected</span>
            <p className="mt-1">{getTimeAgo(connectionData.createdAt)}</p>
          </div>
          <div>
            <span className="font-medium text-muted-foreground">Updated</span>
            <p className="mt-1">{getTimeAgo(connectionData.updatedAt)}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshConnection.mutate}
            disabled={isRefreshing}
            className="flex-1"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>

          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>

          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Connection</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this store connection? This action cannot be undone.
                  You will need to reconnect the store to resume synchronization.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={deleteConnection.mutate}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete Connection
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

export default ConnectionStatusDisplay;