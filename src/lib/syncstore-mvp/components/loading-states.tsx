/**
 * SyncStore MVP Loading States
 * 
 * This module provides comprehensive loading state components with
 * progress indicators, skeleton loaders, and user feedback.
 */

'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Loader2, 
  RefreshCw, 
  Download, 
  Upload, 
  RotateCw, 
  CheckCircle, 
  XCircle,
  Clock,
  Zap,
  Database,
  Globe,
  ShoppingCart,
  Package,
  AlertTriangle,
} from 'lucide-react';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface LoadingState {
  isLoading: boolean;
  progress?: number;
  message?: string;
  stage?: string;
  error?: string;
  canCancel?: boolean;
  onCancel?: () => void;
}

export interface SyncProgress {
  stage: 'connecting' | 'fetching' | 'processing' | 'saving' | 'completed' | 'error';
  progress: number;
  totalItems?: number;
  processedItems?: number;
  currentItem?: string;
  message: string;
  startTime: Date;
  estimatedTimeRemaining?: number;
  errors?: string[];
}

export interface OperationStatus {
  id: string;
  type: 'sync' | 'fetch' | 'save' | 'delete' | 'connect' | 'validate';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message: string;
  startTime: Date;
  endTime?: Date;
  error?: string;
}

// ============================================================================
// Basic Loading Spinner
// ============================================================================

export function LoadingSpinner({ 
  size = 'default',
  className = '',
}: { 
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    default: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <Loader2 className={`animate-spin ${sizeClasses[size]} ${className}`} />
  );
}

// ============================================================================
// Loading Button
// ============================================================================

export function LoadingButton({
  isLoading,
  children,
  loadingText = 'Loading...',
  disabled,
  onClick,
  variant = 'default',
  size = 'default',
  className = '',
  ...props
}: {
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  disabled?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}) {
  return (
    <Button
      variant={variant}
      size={size}
      disabled={isLoading || disabled}
      onClick={onClick}
      className={className}
      {...props}
    >
      {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
      {isLoading ? loadingText : children}
    </Button>
  );
}

// ============================================================================
// Progress Indicator
// ============================================================================

export function ProgressIndicator({
  progress,
  message,
  showPercentage = true,
  className = '',
}: {
  progress: number;
  message?: string;
  showPercentage?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {message && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{message}</span>
          {showPercentage && (
            <span className="font-medium">{Math.round(progress)}%</span>
          )}
        </div>
      )}
      <Progress value={progress} className="h-2" />
    </div>
  );
}

// ============================================================================
// Sync Progress Component
// ============================================================================

export function SyncProgressDisplay({
  syncProgress,
  onCancel,
  className = '',
}: {
  syncProgress: SyncProgress;
  onCancel?: () => void;
  className?: string;
}) {
  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'connecting':
        return <Globe className="w-5 h-5 text-blue-500" />;
      case 'fetching':
        return <Download className="w-5 h-5 text-blue-500" />;
      case 'processing':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'saving':
        return <Database className="w-5 h-5 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <RotateCw className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'connecting':
        return 'Connecting to store';
      case 'fetching':
        return 'Fetching products';
      case 'processing':
        return 'Processing data';
      case 'saving':
        return 'Saving to database';
      case 'completed':
        return 'Sync completed';
      case 'error':
        return 'Sync failed';
      default:
        return 'Synchronizing';
    }
  };

  const formatTimeRemaining = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatElapsedTime = (startTime: Date) => {
    const elapsed = (Date.now() - startTime.getTime()) / 1000;
    return formatTimeRemaining(elapsed);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStageIcon(syncProgress.stage)}
            <div>
              <CardTitle className="text-lg">{getStageLabel(syncProgress.stage)}</CardTitle>
              <CardDescription>{syncProgress.message}</CardDescription>
            </div>
          </div>
          {syncProgress.stage !== 'completed' && syncProgress.stage !== 'error' && (
            <Badge variant="secondary" className="animate-pulse">
              In Progress
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <ProgressIndicator
          progress={syncProgress.progress}
          message={
            syncProgress.totalItems && syncProgress.processedItems
              ? `${syncProgress.processedItems} of ${syncProgress.totalItems} items processed`
              : undefined
          }
        />

        {/* Current Item */}
        {syncProgress.currentItem && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Current:</span> {syncProgress.currentItem}
          </div>
        )}

        {/* Time Information */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>Elapsed: {formatElapsedTime(syncProgress.startTime)}</span>
            </div>
            {syncProgress.estimatedTimeRemaining && syncProgress.stage !== 'completed' && (
              <div className="flex items-center gap-1">
                <Zap className="w-4 h-4" />
                <span>Remaining: {formatTimeRemaining(syncProgress.estimatedTimeRemaining)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Errors */}
        {syncProgress.errors && syncProgress.errors.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-orange-600">
              <AlertTriangle className="w-4 h-4" />
              <span>Warnings ({syncProgress.errors.length})</span>
            </div>
            <div className="space-y-1">
              {syncProgress.errors.slice(0, 3).map((error, index) => (
                <div key={index} className="text-sm text-muted-foreground bg-orange-50 p-2 rounded">
                  {error}
                </div>
              ))}
              {syncProgress.errors.length > 3 && (
                <div className="text-sm text-muted-foreground">
                  ... and {syncProgress.errors.length - 3} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {onCancel && syncProgress.stage !== 'completed' && syncProgress.stage !== 'error' && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel Sync
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Operation Status List
// ============================================================================

export function OperationStatusList({
  operations,
  onCancel,
  onRetry,
  className = '',
}: {
  operations: OperationStatus[];
  onCancel?: (operationId: string) => void;
  onRetry?: (operationId: string) => void;
  className?: string;
}) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-500" />;
      case 'running':
        return <LoadingSpinner size="sm" className="text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sync':
        return <RotateCw className="w-4 h-4" />;
      case 'fetch':
        return <Download className="w-4 h-4" />;
      case 'save':
        return <Database className="w-4 h-4" />;
      case 'delete':
        return <XCircle className="w-4 h-4" />;
      case 'connect':
        return <Globe className="w-4 h-4" />;
      case 'validate':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'running':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Running</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Completed</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 border-red-300">Failed</Badge>;
      case 'cancelled':
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatDuration = (startTime: Date, endTime?: Date) => {
    const end = endTime || new Date();
    const duration = (end.getTime() - startTime.getTime()) / 1000;
    
    if (duration < 60) return `${Math.round(duration)}s`;
    const minutes = Math.floor(duration / 60);
    const seconds = Math.round(duration % 60);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {operations.map((operation) => (
        <Card key={operation.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-2">
                  {getTypeIcon(operation.type)}
                  {getStatusIcon(operation.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium capitalize">{operation.type} Operation</span>
                    {getStatusBadge(operation.status)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{operation.message}</p>
                  
                  {/* Progress bar for running operations */}
                  {operation.status === 'running' && (
                    <ProgressIndicator
                      progress={operation.progress}
                      showPercentage={true}
                      className="mb-2"
                    />
                  )}
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Started: {operation.startTime.toLocaleTimeString()}</span>
                    <span>Duration: {formatDuration(operation.startTime, operation.endTime)}</span>
                  </div>
                  
                  {operation.error && (
                    <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                      <strong>Error:</strong> {operation.error}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-2 ml-4">
                {operation.status === 'running' && onCancel && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCancel(operation.id)}
                  >
                    Cancel
                  </Button>
                )}
                {operation.status === 'failed' && onRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRetry(operation.id)}
                  >
                    Retry
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {operations.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Operations</h3>
            <p className="text-muted-foreground">
              No operations are currently running or queued.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Skeleton Loaders
// ============================================================================

export function ProductListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="w-16 h-16 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ConnectionStatusSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-16" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="w-8 h-8 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <ProductListSkeleton count={3} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-52" />
          </CardHeader>
          <CardContent>
            <ConnectionStatusSkeleton />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// Empty States
// ============================================================================

export function EmptyState({
  icon: Icon = Package,
  title,
  description,
  action,
  className = '',
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-8 text-center">
        <Icon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">{title}</h3>
        <p className="text-muted-foreground mb-4">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Loading Overlay
// ============================================================================

export function LoadingOverlay({
  isVisible,
  message = 'Loading...',
  progress,
  onCancel,
  className = '',
}: {
  isVisible: boolean;
  message?: string;
  progress?: number;
  onCancel?: () => void;
  className?: string;
}) {
  if (!isVisible) return null;

  return (
    <div className={`fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center ${className}`}>
      <Card className="w-full max-w-md mx-4">
        <CardContent className="p-6 text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">{message}</h3>
          
          {progress !== undefined && (
            <ProgressIndicator
              progress={progress}
              className="mb-4"
            />
          )}
          
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default {
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
};