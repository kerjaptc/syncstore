/**
 * SyncStore MVP Error Dashboard
 * 
 * This component provides a comprehensive dashboard for monitoring
 * errors, recovery attempts, and system health.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp,
  TrendingDown,
  Activity,
  Shield,
  RefreshCw,
  Download,
  Filter,
  Search,
  Calendar,
  BarChart3,
  PieChart,
  AlertCircle,
  Info,
  Bug,
  Zap,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getErrorLoggingService,
  getErrorRecoveryService,
  getGlobalErrorHandler,
  type ErrorLogEntry,
  type ErrorMetrics,
  type RecoverySession,
  type ErrorAlert,
} from '../index';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface ErrorDashboardProps {
  className?: string;
  refreshInterval?: number;
  showFilters?: boolean;
  showExportOptions?: boolean;
}

interface ErrorFilter {
  level?: string[];
  category?: string[];
  severity?: string[];
  timeRange?: {
    start: Date;
    end: Date;
  };
  searchTerm?: string;
}

interface ErrorStats {
  total: number;
  byLevel: Record<string, number>;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  resolved: number;
  unresolved: number;
  recentTrend: 'up' | 'down' | 'stable';
}

// ============================================================================
// Error Statistics Component
// ============================================================================

function ErrorStatistics({ stats }: { stats: ErrorStats }) {
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-green-500" />;
      default:
        return <Activity className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Errors</p>
              <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-1">
              {getTrendIcon(stats.recentTrend)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Resolved</p>
              <p className="text-2xl font-bold text-green-600">{stats.resolved.toLocaleString()}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <div className="mt-2">
            <Progress 
              value={stats.total > 0 ? (stats.resolved / stats.total) * 100 : 0} 
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Unresolved</p>
              <p className="text-2xl font-bold text-red-600">{stats.unresolved.toLocaleString()}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">By Severity</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(stats.bySeverity).map(([severity, count]) => (
                <Badge key={severity} className={getSeverityColor(severity)}>
                  {severity}: {count}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Error List Component
// ============================================================================

function ErrorList({ 
  errors, 
  onResolve,
  onViewDetails,
}: { 
  errors: ErrorLogEntry[];
  onResolve: (errorId: string) => void;
  onViewDetails: (error: ErrorLogEntry) => void;
}) {
  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'fatal':
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warn':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return <Bug className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge className="bg-red-100 text-red-800 border-red-300">Critical</Badge>;
      case 'high':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-300">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Medium</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Low</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {errors.map((error) => (
        <Card key={error.id} className={error.resolved ? 'opacity-60' : ''}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className="mt-1">
                  {getLevelIcon(error.level)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate">{error.message}</h4>
                    {getSeverityBadge(error.severity)}
                    {error.resolved && (
                      <Badge className="bg-green-100 text-green-800 border-green-300">
                        Resolved
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{error.timestamp.toLocaleString()}</span>
                    <span className="capitalize">{error.category}</span>
                    {error.context.storeId && (
                      <span>Store: {error.context.storeId}</span>
                    )}
                    {error.tags.length > 0 && (
                      <span>Tags: {error.tags.join(', ')}</span>
                    )}
                  </div>
                  {error.resolved && error.resolution && (
                    <div className="mt-2 p-2 bg-green-50 rounded text-sm">
                      <strong>Resolution:</strong> {error.resolution}
                      {error.resolvedBy && (
                        <span className="text-muted-foreground"> by {error.resolvedBy}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewDetails(error)}
                >
                  Details
                </Button>
                {!error.resolved && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onResolve(error.id)}
                  >
                    Resolve
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {errors.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Errors Found</h3>
            <p className="text-muted-foreground">
              Great! No errors match your current filters.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Recovery Sessions Component
// ============================================================================

function RecoverySessions({ sessions }: { sessions: RecoverySession[] }) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'active':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'timeout':
        return <Clock className="w-4 h-4 text-orange-500" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Completed</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 border-red-300">Failed</Badge>;
      case 'active':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Active</Badge>;
      case 'timeout':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-300">Timeout</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {sessions.map((session) => (
        <Card key={session.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className="mt-1">
                  {getStatusIcon(session.status)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{session.error.message}</h4>
                    {getStatusBadge(session.status)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                    <span>Started: {session.startTime.toLocaleString()}</span>
                    {session.endTime && (
                      <span>Ended: {session.endTime.toLocaleString()}</span>
                    )}
                    <span>Attempts: {session.attempts.length}</span>
                  </div>
                  
                  {session.attempts.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Recovery Attempts:</p>
                      {session.attempts.map((attempt) => (
                        <div key={attempt.id} className="flex items-center gap-2 text-sm">
                          {attempt.success ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : (
                            <XCircle className="w-3 h-3 text-red-500" />
                          )}
                          <span>{attempt.strategyId}</span>
                          <span className="text-muted-foreground">
                            ({attempt.startTime.toLocaleTimeString()})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {sessions.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Shield className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Recovery Sessions</h3>
            <p className="text-muted-foreground">
              No error recovery sessions are currently active or recent.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Active Alerts Component
// ============================================================================

function ActiveAlerts({ 
  alerts, 
  onAcknowledge,
}: { 
  alerts: ErrorAlert[];
  onAcknowledge: (alertId: string) => void;
}) {
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'threshold':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'pattern':
        return <TrendingUp className="w-4 h-4 text-yellow-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {alerts.map((alert) => (
        <Alert key={alert.id} className="border-l-4 border-l-red-500">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {getAlertIcon(alert.type)}
              <div>
                <h4 className="font-medium">{alert.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {alert.description}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Triggered: {alert.triggeredAt?.toLocaleString()}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAcknowledge(alert.id)}
            >
              Acknowledge
            </Button>
          </div>
        </Alert>
      ))}
      
      {alerts.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Active Alerts</h3>
            <p className="text-muted-foreground">
              All alerts have been acknowledged or resolved.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Main Error Dashboard Component
// ============================================================================

export function ErrorDashboard({
  className = '',
  refreshInterval = 30000,
  showFilters = true,
  showExportOptions = true,
}: ErrorDashboardProps) {
  const [errorMetrics, setErrorMetrics] = useState<ErrorMetrics | null>(null);
  const [recentErrors, setRecentErrors] = useState<ErrorLogEntry[]>([]);
  const [recoverySessions, setRecoverySessions] = useState<RecoverySession[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<ErrorAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<ErrorFilter>({});
  const [selectedError, setSelectedError] = useState<ErrorLogEntry | null>(null);

  const { toast } = useToast();
  const errorLoggingService = getErrorLoggingService();
  const errorRecoveryService = getErrorRecoveryService();

  // Load data
  const loadData = async () => {
    try {
      setIsLoading(true);

      // Get error metrics
      const metrics = errorLoggingService.getErrorMetrics(filter.timeRange);
      setErrorMetrics(metrics);
      setRecentErrors(metrics.recentErrors);

      // Get recovery sessions
      const sessions = errorRecoveryService.getActiveSessions();
      setRecoverySessions(sessions);

      // Get active alerts (would be implemented in logging service)
      // const alerts = errorLoggingService.getActiveAlerts();
      // setActiveAlerts(alerts);

    } catch (error) {
      console.error('Failed to load error dashboard data:', error);
      toast({
        title: 'Error Loading Data',
        description: 'Failed to load error dashboard data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh data
  useEffect(() => {
    loadData();
    
    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, filter]);

  // Handle error resolution
  const handleResolveError = async (errorId: string) => {
    try {
      const success = await errorLoggingService.resolveError(
        errorId,
        'Manually resolved from dashboard',
        'Dashboard User'
      );

      if (success) {
        toast({
          title: 'Error Resolved',
          description: 'The error has been marked as resolved.',
        });
        loadData(); // Refresh data
      } else {
        toast({
          title: 'Resolution Failed',
          description: 'Failed to resolve the error.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to resolve error:', error);
      toast({
        title: 'Resolution Failed',
        description: 'An error occurred while resolving the error.',
        variant: 'destructive',
      });
    }
  };

  // Handle alert acknowledgment
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      // This would be implemented in the logging service
      toast({
        title: 'Alert Acknowledged',
        description: 'The alert has been acknowledged.',
      });
      loadData(); // Refresh data
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      toast({
        title: 'Acknowledgment Failed',
        description: 'Failed to acknowledge the alert.',
        variant: 'destructive',
      });
    }
  };

  // Calculate error statistics
  const errorStats: ErrorStats = errorMetrics ? {
    total: errorMetrics.totalErrors,
    byLevel: errorMetrics.errorsByLevel,
    byCategory: errorMetrics.errorsByCategory,
    bySeverity: errorMetrics.errorsBySeverity,
    resolved: errorMetrics.recentErrors.filter(e => e.resolved).length,
    unresolved: errorMetrics.recentErrors.filter(e => !e.resolved).length,
    recentTrend: 'stable', // Would calculate based on historical data
  } : {
    total: 0,
    byLevel: {},
    byCategory: {},
    bySeverity: {},
    resolved: 0,
    unresolved: 0,
    recentTrend: 'stable',
  };

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading error dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Error Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and manage application errors and recovery attempts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {showExportOptions && (
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Statistics */}
      <ErrorStatistics stats={errorStats} />

      {/* Main Content */}
      <Tabs defaultValue="errors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="errors">Recent Errors</TabsTrigger>
          <TabsTrigger value="recovery">Recovery Sessions</TabsTrigger>
          <TabsTrigger value="alerts">Active Alerts</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Errors</CardTitle>
              <CardDescription>
                Latest errors and their resolution status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ErrorList
                errors={recentErrors}
                onResolve={handleResolveError}
                onViewDetails={setSelectedError}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recovery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recovery Sessions</CardTitle>
              <CardDescription>
                Active and recent error recovery attempts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecoverySessions sessions={recoverySessions} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Alerts</CardTitle>
              <CardDescription>
                Critical errors and system alerts requiring attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActiveAlerts
                alerts={activeAlerts}
                onAcknowledge={handleAcknowledgeAlert}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Error Trends</CardTitle>
                <CardDescription>
                  Error frequency over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <BarChart3 className="w-8 h-8 mr-2" />
                  <span>Chart would be implemented here</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error Distribution</CardTitle>
                <CardDescription>
                  Breakdown by category and severity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <PieChart className="w-8 h-8 mr-2" />
                  <span>Chart would be implemented here</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ErrorDashboard;