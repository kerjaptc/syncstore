/**
 * Progress Bar Component
 * Task 5.3: Build progress bar UI
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  progress: number; // 0-100
  total?: number;
  completed?: number;
  failed?: number;
  inProgress?: number;
  queued?: number;
  status?: 'queued' | 'processing' | 'completed' | 'failed' | 'mixed';
  showDetails?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export function ProgressBar({
  progress,
  total = 0,
  completed = 0,
  failed = 0,
  inProgress = 0,
  queued = 0,
  status = 'queued',
  showDetails = true,
  className,
  size = 'md',
  animated = true,
}: ProgressBarProps) {
  // Clamp progress between 0 and 100
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  
  // Calculate percentages for different segments
  const completedPercent = total > 0 ? (completed / total) * 100 : 0;
  const failedPercent = total > 0 ? (failed / total) * 100 : 0;
  
  // Size classes
  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  };

  // Status colors
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'mixed':
        return 'text-yellow-600';
      case 'processing':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  // Status badge
  const getStatusBadge = () => {
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    switch (status) {
      case 'completed':
        return (
          <span className={cn(baseClasses, 'bg-green-100 text-green-800')}>
            ✅ Completed
          </span>
        );
      case 'failed':
        return (
          <span className={cn(baseClasses, 'bg-red-100 text-red-800')}>
            ❌ Failed
          </span>
        );
      case 'mixed':
        return (
          <span className={cn(baseClasses, 'bg-yellow-100 text-yellow-800')}>
            ⚠️ Completed with errors
          </span>
        );
      case 'processing':
        return (
          <span className={cn(baseClasses, 'bg-blue-100 text-blue-800')}>
            🔄 Processing
          </span>
        );
      default:
        return (
          <span className={cn(baseClasses, 'bg-gray-100 text-gray-800')}>
            ⏳ Queued
          </span>
        );
    }
  };

  return (
    <div className={cn('w-full', className)}>
      {/* Progress Bar */}
      <div className={cn(
        'w-full bg-gray-200 rounded-full overflow-hidden',
        sizeClasses[size]
      )}>
        <div className="relative h-full">
          {/* Completed segment (green) */}
          <div
            className={cn(
              'absolute left-0 top-0 h-full bg-green-500 transition-all duration-300',
              animated && 'ease-out'
            )}
            style={{ width: `${completedPercent}%` }}
          />
          
          {/* Failed segment (red) */}
          <div
            className={cn(
              'absolute top-0 h-full bg-red-500 transition-all duration-300',
              animated && 'ease-out'
            )}
            style={{ 
              left: `${completedPercent}%`,
              width: `${failedPercent}%` 
            }}
          />
          
          {/* Processing segment (blue) - animated */}
          {inProgress > 0 && (
            <div
              className={cn(
                'absolute top-0 h-full bg-blue-500 transition-all duration-300',
                animated && 'ease-out'
              )}
              style={{ 
                left: `${completedPercent + failedPercent}%`,
                width: `${total > 0 ? (inProgress / total) * 100 : 0}%` 
              }}
            />
          )}
        </div>
      </div>

      {/* Progress Text */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center space-x-2">
          {getStatusBadge()}
          <span className={cn('text-sm font-medium', getStatusColor())}>
            {clampedProgress}%
          </span>
        </div>
        
        {showDetails && total > 0 && (
          <div className="text-sm text-gray-600">
            {completed + failed} / {total} jobs
          </div>
        )}
      </div>

      {/* Detailed Stats */}
      {showDetails && total > 0 && (
        <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
          <div className="flex items-center space-x-4">
            {completed > 0 && (
              <span className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1" />
                {completed} completed
              </span>
            )}
            {failed > 0 && (
              <span className="flex items-center">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-1" />
                {failed} failed
              </span>
            )}
            {inProgress > 0 && (
              <span className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-1" />
                {inProgress} processing
              </span>
            )}
            {queued > 0 && (
              <span className="flex items-center">
                <div className="w-2 h-2 bg-gray-400 rounded-full mr-1" />
                {queued} queued
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Real-time progress bar with auto-refresh
interface RealTimeProgressBarProps extends Omit<ProgressBarProps, 'progress' | 'completed' | 'failed' | 'inProgress' | 'queued' | 'status'> {
  batchId: string;
  refreshInterval?: number; // milliseconds
  onStatusChange?: (status: any) => void;
}

export function RealTimeProgressBar({
  batchId,
  refreshInterval = 2000,
  onStatusChange,
  ...props
}: RealTimeProgressBarProps) {
  const [batchStatus, setBatchStatus] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchBatchStatus = async () => {
      try {
        const response = await fetch(`/api/sync/batch/status?batch_id=${batchId}`);
        const data = await response.json();

        if (data.success) {
          setBatchStatus(data.data);
          setError(null);
          onStatusChange?.(data.data);
        } else {
          setError(data.error?.message || 'Failed to fetch status');
        }
      } catch (err) {
        setError('Network error');
        console.error('Error fetching batch status:', err);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchBatchStatus();

    // Set up polling if batch is not complete
    intervalId = setInterval(() => {
      if (batchStatus?.is_complete) {
        clearInterval(intervalId);
        return;
      }
      fetchBatchStatus();
    }, refreshInterval);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [batchId, refreshInterval, onStatusChange, batchStatus?.is_complete]);

  if (loading) {
    return (
      <div className="w-full">
        <div className="h-3 bg-gray-200 rounded-full animate-pulse" />
        <div className="mt-2 text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="h-3 bg-red-200 rounded-full" />
        <div className="mt-2 text-sm text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!batchStatus) {
    return (
      <div className="w-full">
        <div className="h-3 bg-gray-200 rounded-full" />
        <div className="mt-2 text-sm text-gray-500">No data available</div>
      </div>
    );
  }

  return (
    <ProgressBar
      progress={batchStatus.progress_percentage}
      total={batchStatus.total_jobs}
      completed={batchStatus.completed}
      failed={batchStatus.failed}
      inProgress={batchStatus.in_progress}
      queued={batchStatus.pending}
      status={batchStatus.status}
      {...props}
    />
  );
}