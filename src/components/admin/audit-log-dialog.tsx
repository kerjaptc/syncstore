'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  User, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Plus, 
  Edit, 
  Trash2, 
  TestTube,
  AlertTriangle
} from 'lucide-react';

interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  settingKey: string;
  success: boolean;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

interface AuditLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditLogDialog({ open, onOpenChange }: AuditLogDialogProps) {
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchAuditLog();
    }
  }, [open]);

  const fetchAuditLog = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/settings/audit?limit=50');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch audit log');
      }

      setAuditLog(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit log');
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'update':
        return <Edit className="h-4 w-4 text-blue-600" />;
      case 'delete':
        return <Trash2 className="h-4 w-4 text-red-600" />;
      case 'test':
        return <TestTube className="h-4 w-4 text-purple-600" />;
      case 'view':
        return <Shield className="h-4 w-4 text-gray-600" />;
      default:
        return <Shield className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'create':
        return 'Created';
      case 'update':
        return 'Updated';
      case 'delete':
        return 'Deleted';
      case 'test':
        return 'Tested';
      case 'view':
        return 'Viewed';
      default:
        return action;
    }
  };

  const getActionBadge = (action: string, success: boolean) => {
    if (!success) {
      return <Badge variant="destructive">Failed</Badge>;
    }

    switch (action) {
      case 'create':
        return <Badge className="bg-green-100 text-green-800">Created</Badge>;
      case 'update':
        return <Badge className="bg-blue-100 text-blue-800">Updated</Badge>;
      case 'delete':
        return <Badge className="bg-red-100 text-red-800">Deleted</Badge>;
      case 'test':
        return <Badge className="bg-purple-100 text-purple-800">Tested</Badge>;
      case 'view':
        return <Badge variant="secondary">Viewed</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  const formatUserAgent = (userAgent?: string) => {
    if (!userAgent) return 'Unknown';
    
    // Extract browser info from user agent
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    
    return 'Unknown Browser';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
      relative: getRelativeTime(date),
    };
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Audit Log
          </DialogTitle>
          <DialogDescription>
            Track all changes to API configurations and sensitive settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {auditLog.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No audit log entries found
                  </div>
                ) : (
                  auditLog.map((entry) => {
                    const dateInfo = formatDate(entry.createdAt);
                    
                    return (
                      <div
                        key={entry.id}
                        className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-shrink-0 mt-1">
                          {entry.success ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {getActionIcon(entry.action)}
                            <span className="font-medium">
                              {getActionLabel(entry.action)} {entry.settingKey}
                            </span>
                            {getActionBadge(entry.action, entry.success)}
                          </div>

                          {entry.errorMessage && (
                            <div className="text-sm text-red-600 mb-2">
                              Error: {entry.errorMessage}
                            </div>
                          )}

                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{entry.userId}</span>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span title={`${dateInfo.date} ${dateInfo.time}`}>
                                {dateInfo.relative}
                              </span>
                            </div>

                            {entry.ipAddress && (
                              <span>IP: {entry.ipAddress}</span>
                            )}

                            <span>{formatUserAgent(entry.userAgent)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-4">
            <span>Showing last 50 entries</span>
            <span>All times are in your local timezone</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}