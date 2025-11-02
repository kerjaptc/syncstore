import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { useSync } from '@/hooks/useSync';

interface SyncButtonProps {
  productId: string;
  currentStatus: 'pending' | 'syncing' | 'synced' | 'error';
  disabled?: boolean;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'secondary';
  onSyncComplete?: () => void;
  onSyncStart?: (syncId: string) => void;
}

export function SyncButton({ 
  productId, 
  currentStatus, 
  disabled = false,
  size = 'sm',
  variant = 'outline',
  onSyncComplete,
  onSyncStart
}: SyncButtonProps) {
  const { syncProduct, getSyncState } = useSync();
  const syncState = getSyncState(productId);

  const handleSync = async () => {
    const result = await syncProduct(productId, 'shopee');
    
    if (result.success) {
      // Notify parent about sync start with sync ID
      if (onSyncStart && result.sync_id) {
        onSyncStart(result.sync_id);
      }
      
      // Immediately refresh to show syncing status
      if (onSyncComplete) {
        onSyncComplete();
        
        // Refresh again after processing to get final status
        setTimeout(() => {
          onSyncComplete();
        }, 3000); // Wait for backend to process
      }
    }
  };

  // Determine button state based on sync state and current status
  const getButtonState = () => {
    if (syncState.isLoading || currentStatus === 'syncing') {
      return {
        text: 'Syncing...',
        icon: RefreshCw,
        className: 'text-yellow-600',
        disabled: true,
        animate: true,
      };
    }

    if (syncState.status === 'success') {
      return {
        text: '✓ Synced',
        icon: CheckCircle,
        className: 'text-green-600 bg-green-50 border-green-200',
        disabled: true,
        animate: false,
      };
    }

    if (syncState.status === 'error') {
      return {
        text: '✗ Error',
        icon: XCircle,
        className: 'text-red-600 bg-red-50 border-red-200',
        disabled: false,
        animate: false,
      };
    }

    // Default state
    return {
      text: 'Sync Now',
      icon: RefreshCw,
      className: '',
      disabled: disabled,
      animate: false,
    };
  };

  const buttonState = getButtonState();
  const Icon = buttonState.icon;

  return (
    <Button
      size={size}
      variant={variant}
      onClick={handleSync}
      disabled={buttonState.disabled}
      className={`text-xs ${buttonState.className}`}
    >
      <Icon 
        className={`h-3 w-3 mr-1 ${buttonState.animate ? 'animate-spin' : ''}`} 
      />
      {buttonState.text}
    </Button>
  );
}