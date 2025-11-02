/**
 * SyncStore MVP Notification System
 * 
 * This module provides comprehensive notification and toast management
 * with different types, priorities, and user interaction capabilities.
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  X,
  Bell,
  BellRing,
  Clock,
  Zap,
  RefreshCw,
  Download,
  Upload,
  RotateCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
// Note: useToast is imported but not used in this component
// The NotificationProvider manages its own toast system

// ============================================================================
// Types and Interfaces
// ============================================================================

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'loading';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';
export type NotificationCategory = 'sync' | 'connection' | 'system' | 'user' | 'security';

export interface NotificationAction {
  label: string;
  action: () => void | Promise<void>;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
}

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  dismissed: boolean;
  persistent?: boolean;
  autoClose?: boolean;
  duration?: number;
  progress?: number;
  actions?: NotificationAction[];
  metadata?: Record<string, any>;
}

export interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read' | 'dismissed'>) => string;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
  updateProgress: (id: string, progress: number) => void;
}

// ============================================================================
// Notification Context
// ============================================================================

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

// ============================================================================
// Notification Provider
// ============================================================================

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const generateId = () => `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addNotification = useCallback((
    notificationData: Omit<Notification, 'id' | 'timestamp' | 'read' | 'dismissed'>
  ): string => {
    const id = generateId();
    const notification: Notification = {
      ...notificationData,
      id,
      timestamp: new Date(),
      read: false,
      dismissed: false,
      autoClose: notificationData.autoClose ?? true,
      duration: notificationData.duration ?? 5000,
    };

    setNotifications(prev => [notification, ...prev]);

    // Auto-close notification if specified
    if (notification.autoClose && !notification.persistent) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration);
    }

    // Note: Toast integration can be added here if needed
    // For now, we rely on the notification panel for display

    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, dismissed: true } : n)
    );
    // Remove after animation
    setTimeout(() => removeNotification(id), 300);
  }, [removeNotification]);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const updateProgress = useCallback((id: string, progress: number) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, progress } : n)
    );
  }, []);

  const unreadCount = notifications.filter(n => !n.read && !n.dismissed).length;

  const value: NotificationContextType = {
    notifications: notifications.filter(n => !n.dismissed),
    unreadCount,
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll,
    updateProgress,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// ============================================================================
// Notification Item Component
// ============================================================================

function NotificationItem({ 
  notification, 
  onDismiss, 
  onMarkAsRead,
  compact = false,
}: { 
  notification: Notification;
  onDismiss: (id: string) => void;
  onMarkAsRead: (id: string) => void;
  compact?: boolean;
}) {
  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
      case 'loading':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'sync':
        return <RotateCw className="w-4 h-4" />;
      case 'connection':
        return <Zap className="w-4 h-4" />;
      case 'system':
        return <AlertCircle className="w-4 h-4" />;
      case 'security':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getPriorityBadge = (priority: NotificationPriority) => {
    switch (priority) {
      case 'urgent':
        return <Badge className="bg-red-100 text-red-800 border-red-300">Urgent</Badge>;
      case 'high':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-300">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Medium</Badge>;
      default:
        return null;
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
  };

  return (
    <Card 
      className={`transition-all duration-200 ${
        notification.read ? 'opacity-75' : 'border-l-4 border-l-blue-500'
      } ${notification.priority === 'urgent' ? 'border-l-red-500' : ''}`}
      onClick={handleClick}
    >
      <CardContent className={compact ? 'p-3' : 'p-4'}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {getIcon(notification.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className={`font-medium ${compact ? 'text-sm' : ''}`}>
                {notification.title}
              </h4>
              {getPriorityBadge(notification.priority)}
              {!notification.read && (
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </div>
            
            <p className={`text-muted-foreground ${compact ? 'text-xs' : 'text-sm'} mb-2`}>
              {notification.message}
            </p>

            {/* Progress bar for loading notifications */}
            {notification.type === 'loading' && notification.progress !== undefined && (
              <Progress value={notification.progress} className="h-1 mb-2" />
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {getCategoryIcon(notification.category)}
                <span className="capitalize">{notification.category}</span>
                <span>•</span>
                <span>{formatTimeAgo(notification.timestamp)}</span>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(notification.id);
                }}
                className="h-6 w-6 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>

            {/* Actions */}
            {notification.actions && notification.actions.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                {notification.actions.map((action, index) => (
                  <Button
                    key={index}
                    variant={action.variant || 'outline'}
                    size="sm"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await action.action();
                    }}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Notification Panel
// ============================================================================

export function NotificationPanel({ 
  className = '',
  maxHeight = '400px',
  compact = false,
}: { 
  className?: string;
  maxHeight?: string;
  compact?: boolean;
}) {
  const { 
    notifications, 
    unreadCount, 
    dismissNotification, 
    markAsRead, 
    markAllAsRead, 
    clearAll 
  } = useNotifications();

  const sortedNotifications = [...notifications].sort((a, b) => {
    // Sort by priority first, then by timestamp
    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    
    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  return (
    <div className={`bg-background border rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <BellRing className="w-5 h-5" />
          <h3 className="font-medium">Notifications</h3>
          {unreadCount > 0 && (
            <Badge className="bg-blue-100 text-blue-800 border-blue-300">
              {unreadCount}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              Mark all read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Notification List */}
      <div 
        className="overflow-y-auto"
        style={{ maxHeight }}
      >
        {sortedNotifications.length > 0 ? (
          <div className="p-2 space-y-2">
            {sortedNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onDismiss={dismissNotification}
                onMarkAsRead={markAsRead}
                compact={compact}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="font-medium mb-2">No notifications</h4>
            <p className="text-sm text-muted-foreground">
              You're all caught up! New notifications will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Notification Bell Icon
// ============================================================================

export function NotificationBell({ 
  onClick,
  className = '',
}: { 
  onClick?: () => void;
  className?: string;
}) {
  const { unreadCount } = useNotifications();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={`relative ${className}`}
    >
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </div>
      )}
    </Button>
  );
}

// ============================================================================
// Notification Hooks
// ============================================================================

export function useNotificationHelpers() {
  const { addNotification, updateProgress } = useNotifications();

  const showSuccess = useCallback((title: string, message: string, actions?: NotificationAction[]) => {
    return addNotification({
      type: 'success',
      priority: 'medium',
      category: 'user',
      title,
      message,
      actions,
    });
  }, [addNotification]);

  const showError = useCallback((title: string, message: string, actions?: NotificationAction[]) => {
    return addNotification({
      type: 'error',
      priority: 'high',
      category: 'system',
      title,
      message,
      persistent: true,
      autoClose: false,
      actions,
    });
  }, [addNotification]);

  const showWarning = useCallback((title: string, message: string, actions?: NotificationAction[]) => {
    return addNotification({
      type: 'warning',
      priority: 'medium',
      category: 'system',
      title,
      message,
      actions,
    });
  }, [addNotification]);

  const showInfo = useCallback((title: string, message: string, actions?: NotificationAction[]) => {
    return addNotification({
      type: 'info',
      priority: 'low',
      category: 'user',
      title,
      message,
      actions,
    });
  }, [addNotification]);

  const showLoading = useCallback((title: string, message: string, progress?: number) => {
    return addNotification({
      type: 'loading',
      priority: 'medium',
      category: 'system',
      title,
      message,
      progress,
      persistent: true,
      autoClose: false,
    });
  }, [addNotification]);

  const showSyncNotification = useCallback((
    type: 'started' | 'progress' | 'completed' | 'failed',
    storeId: string,
    details?: { progress?: number; error?: string; itemsProcessed?: number; totalItems?: number }
  ) => {
    const baseData = {
      category: 'sync' as NotificationCategory,
      metadata: { storeId, ...details },
    };

    switch (type) {
      case 'started':
        return addNotification({
          ...baseData,
          type: 'loading',
          priority: 'medium',
          title: 'Sync Started',
          message: `Product synchronization started for store ${storeId}`,
          persistent: true,
          autoClose: false,
        });

      case 'progress':
        return addNotification({
          ...baseData,
          type: 'loading',
          priority: 'low',
          title: 'Sync in Progress',
          message: details?.itemsProcessed && details?.totalItems
            ? `Processed ${details.itemsProcessed} of ${details.totalItems} products`
            : `Synchronizing products for store ${storeId}`,
          progress: details?.progress,
          persistent: true,
          autoClose: false,
        });

      case 'completed':
        return addNotification({
          ...baseData,
          type: 'success',
          priority: 'medium',
          title: 'Sync Completed',
          message: details?.itemsProcessed
            ? `Successfully synchronized ${details.itemsProcessed} products`
            : `Product synchronization completed for store ${storeId}`,
        });

      case 'failed':
        return addNotification({
          ...baseData,
          type: 'error',
          priority: 'high',
          title: 'Sync Failed',
          message: details?.error || `Product synchronization failed for store ${storeId}`,
          persistent: true,
          autoClose: false,
          actions: [
            {
              label: 'Retry Sync',
              action: () => {
                // This would trigger a sync retry
                console.log('Retrying sync for store:', storeId);
              },
            },
          ],
        });
    }
  }, [addNotification]);

  const showConnectionNotification = useCallback((
    type: 'connected' | 'disconnected' | 'error',
    storeId: string,
    error?: string
  ) => {
    const baseData = {
      category: 'connection' as NotificationCategory,
      metadata: { storeId },
    };

    switch (type) {
      case 'connected':
        return addNotification({
          ...baseData,
          type: 'success',
          priority: 'medium',
          title: 'Store Connected',
          message: `Successfully connected to store ${storeId}`,
        });

      case 'disconnected':
        return addNotification({
          ...baseData,
          type: 'warning',
          priority: 'medium',
          title: 'Store Disconnected',
          message: `Connection to store ${storeId} has been lost`,
          actions: [
            {
              label: 'Reconnect',
              action: () => {
                // This would trigger a reconnection
                console.log('Reconnecting to store:', storeId);
              },
            },
          ],
        });

      case 'error':
        return addNotification({
          ...baseData,
          type: 'error',
          priority: 'high',
          title: 'Connection Error',
          message: error || `Failed to connect to store ${storeId}`,
          persistent: true,
          autoClose: false,
          actions: [
            {
              label: 'Retry Connection',
              action: () => {
                // This would trigger a connection retry
                console.log('Retrying connection to store:', storeId);
              },
            },
          ],
        });
    }
  }, [addNotification]);

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoading,
    showSyncNotification,
    showConnectionNotification,
    updateProgress,
  };
}

export default {
  NotificationProvider,
  NotificationPanel,
  NotificationBell,
  useNotifications,
  useNotificationHelpers,
};