import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  Info, 
  AlertTriangle,
  Clock
} from 'lucide-react';

interface SyncEvent {
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

interface SyncLog {
  sync_id: string;
  product_id: string;
  status: 'running' | 'success' | 'error';
  events: SyncEvent[];
  started_at: string;
  completed_at?: string;
}

interface SyncLogDrawerProps {
  syncId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SyncLogDrawer({ syncId, isOpen, onClose }: SyncLogDrawerProps) {
  const [syncLog, setSyncLog] = useState<SyncLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Fetch sync logs
  const fetchSyncLog = async () => {
    if (!syncId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/sync/logs/${syncId}`);
      const result = await response.json();

      if (result.success) {
        setSyncLog(result.data);
      } else {
        setError(result.error?.message || 'Failed to fetch sync logs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  // Poll for updates when sync is running
  useEffect(() => {
    if (!isOpen || !syncId) return;

    fetchSyncLog();

    // Poll every 1 second if sync is running
    const interval = setInterval(() => {
      if (syncLog?.status === 'running') {
        fetchSyncLog();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, syncId, syncLog?.status]);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [syncLog?.events]);

  const getEventIcon = (type: SyncEvent['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getEventBadge = (type: SyncEvent['type']) => {
    const variants = {
      info: 'bg-blue-100 text-blue-800',
      success: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800',
    };

    return (
      <Badge className={`${variants[type]} text-xs`}>
        {type.toUpperCase()}
      </Badge>
    );
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Sync Log
          </SheetTitle>
          <SheetDescription>
            Real-time sync events and progress tracking
            {syncId && (
              <div className="text-xs font-mono mt-1">
                ID: {syncId}
              </div>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {loading && !syncLog && (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading sync logs...</div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-800">
                <XCircle className="h-4 w-4" />
                <span className="font-medium">Error loading logs</span>
              </div>
              <div className="text-red-600 text-sm mt-1">{error}</div>
            </div>
          )}

          {syncLog && (
            <div className="space-y-4">
              {/* Status Header */}
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {syncLog.status === 'running' && (
                      <Clock className="h-4 w-4 text-yellow-600 animate-pulse" />
                    )}
                    {syncLog.status === 'success' && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                    {syncLog.status === 'error' && (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="font-medium capitalize">{syncLog.status}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Started: {formatTime(syncLog.started_at)}
                  </div>
                </div>
                {syncLog.completed_at && (
                  <div className="text-sm text-muted-foreground mt-1">
                    Completed: {formatTime(syncLog.completed_at)}
                  </div>
                )}
              </div>

              {/* Events List */}
              <div>
                <h4 className="font-medium mb-3">Events ({syncLog.events.length})</h4>
                <ScrollArea className="h-[400px]" ref={scrollAreaRef}>
                  <div className="space-y-3">
                    {syncLog.events.map((event, index) => (
                      <div
                        key={index}
                        className="flex gap-3 p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {getEventIcon(event.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getEventBadge(event.type)}
                            <span className="text-xs text-muted-foreground">
                              {formatTime(event.timestamp)}
                            </span>
                          </div>
                          <div className="text-sm">{event.message}</div>
                          {event.details && (
                            <div className="text-xs text-muted-foreground mt-1 font-mono">
                              {JSON.stringify(event.details, null, 2)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}