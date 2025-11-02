import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  XCircle, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { getSyncError, formatRetryTime, type SyncError } from '@/lib/sync-errors';

interface ErrorToastProps {
  errorMessage: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorToast({ errorMessage, onRetry, onDismiss, className = '' }: ErrorToastProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  
  const syncError: SyncError = getSyncError(errorMessage);

  const handleRetry = () => {
    if (syncError.retryAfter && syncError.retryAfter > 0) {
      // Start countdown for retry delay
      setRetryCountdown(syncError.retryAfter);
      
      const countdown = setInterval(() => {
        setRetryCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(countdown);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    if (onRetry) {
      onRetry();
    }
  };

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-red-800">Sync Failed</span>
              <Badge className="bg-red-100 text-red-800 text-xs">
                {syncError.code}
              </Badge>
            </div>
            <p className="text-red-700 text-sm">{syncError.userMessage}</p>
            
            {/* Suggestion */}
            <div className="mt-2 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-700 text-sm">{syncError.suggestion}</p>
            </div>
          </div>
        </div>
        
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="text-red-600 hover:text-red-800 h-6 w-6 p-0"
          >
            ×
          </Button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          {syncError.retryable && onRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRetry}
              disabled={retryCountdown !== null}
              className="text-red-700 border-red-300 hover:bg-red-100"
            >
              {retryCountdown !== null ? (
                <>
                  <Clock className="h-3 w-3 mr-1" />
                  Retry in {retryCountdown}s
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Try Again
                  {syncError.retryAfter && (
                    <span className="ml-1 text-xs">
                      (wait {formatRetryTime(syncError.retryAfter)})
                    </span>
                  )}
                </>
              )}
            </Button>
          )}
        </div>

        {/* Expandable Details */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-800 text-xs"
            >
              {isExpanded ? (
                <>
                  Hide Details
                  <ChevronUp className="h-3 w-3 ml-1" />
                </>
              ) : (
                <>
                  Show Details
                  <ChevronDown className="h-3 w-3 ml-1" />
                </>
              )}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-3">
            <div className="bg-red-100 rounded p-3">
              <div className="text-xs font-medium text-red-800 mb-1">
                Technical Details:
              </div>
              <div className="text-xs text-red-700 font-mono break-all">
                {syncError.technicalMessage}
              </div>
              {errorMessage !== syncError.technicalMessage && (
                <>
                  <div className="text-xs font-medium text-red-800 mb-1 mt-2">
                    Original Error:
                  </div>
                  <div className="text-xs text-red-700 font-mono break-all">
                    {errorMessage}
                  </div>
                </>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}