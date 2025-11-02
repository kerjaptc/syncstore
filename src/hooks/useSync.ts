import { useState } from 'react';
import { toast } from 'sonner';
import { getSyncError } from '@/lib/sync-errors';

interface SyncState {
  [productId: string]: {
    isLoading: boolean;
    status: 'idle' | 'loading' | 'success' | 'error';
    message?: string;
  };
}

interface SyncResponse {
  success: boolean;
  data?: {
    sync_id: string;
    status: string;
    message: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export function useSync() {
  const [syncStates, setSyncStates] = useState<SyncState>({});

  const syncProduct = async (productId: string, target: 'shopee' = 'shopee') => {
    // Set loading state
    setSyncStates(prev => ({
      ...prev,
      [productId]: {
        isLoading: true,
        status: 'loading',
        message: 'Starting sync...',
      },
    }));

    try {
      const response = await fetch('/api/sync/product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: productId,
          target,
        }),
      });

      const result: SyncResponse = await response.json();

      if (result.success) {
        // Set success state temporarily
        setSyncStates(prev => ({
          ...prev,
          [productId]: {
            isLoading: false,
            status: 'success',
            message: result.data?.message || 'Sync completed successfully',
          },
        }));

        // Show success toast
        toast.success('Product synced successfully');

        // Reset to idle after 3 seconds
        setTimeout(() => {
          setSyncStates(prev => ({
            ...prev,
            [productId]: {
              isLoading: false,
              status: 'idle',
            },
          }));
        }, 3000);

        return { success: true, sync_id: result.data?.sync_id };
      } else {
        // Handle error with enhanced error handling
        const errorMessage = result.error?.message || 'Sync failed';
        const syncError = getSyncError(errorMessage);
        
        setSyncStates(prev => ({
          ...prev,
          [productId]: {
            isLoading: false,
            status: 'error',
            message: syncError.userMessage,
          },
        }));

        // Show user-friendly error toast
        toast.error(syncError.userMessage, {
          description: syncError.suggestion,
          duration: syncError.retryable ? 8000 : 5000, // Longer duration for retryable errors
        });

        // Reset to idle after appropriate time
        const resetDelay = syncError.retryable ? 8000 : 5000;
        setTimeout(() => {
          setSyncStates(prev => ({
            ...prev,
            [productId]: {
              isLoading: false,
              status: 'idle',
            },
          }));
        }, resetDelay);

        return { success: false, error: errorMessage, syncError };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      const syncError = getSyncError(errorMessage);
      
      setSyncStates(prev => ({
        ...prev,
        [productId]: {
          isLoading: false,
          status: 'error',
          message: syncError.userMessage,
        },
      }));

      // Show user-friendly error toast for network errors
      toast.error(syncError.userMessage, {
        description: syncError.suggestion,
        duration: 8000,
      });

      // Reset to idle after 8 seconds for network errors (usually retryable)
      setTimeout(() => {
        setSyncStates(prev => ({
          ...prev,
          [productId]: {
            isLoading: false,
            status: 'idle',
          },
        }));
      }, 8000);

      return { success: false, error: errorMessage, syncError };
    }
  };

  const getSyncState = (productId: string) => {
    return syncStates[productId] || {
      isLoading: false,
      status: 'idle' as const,
    };
  };

  return {
    syncProduct,
    getSyncState,
  };
}