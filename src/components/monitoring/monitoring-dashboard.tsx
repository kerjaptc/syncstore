/**
 * Monitoring Dashboard Component
 * Displays comprehensive system monitoring information
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Activity, 
  Database, 
  HardDrive, 
  Cpu, 
  MemoryStick, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Download,
  Upload
} from 'lucide-react';

interface MonitoringData {
  health: {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    checks: Record<string, any>;
    metrics: {
      memory: { used: number; total: number; percentage: number };
      cpu: { usage: number };
      database: { connectionCount: number; slowQueries: number; averageQueryTime: number };
      cache: { hitRate: number; totalSize: number; entryCount: number };
      requests: { total: number; successful: number; failed: number; averageResponseTime: number };
    };
  };
  performance: {
    alerts: Array<{
      id: string;
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      timestamp: string;
    }>;
    database: {
      slowQueries: Array<{
        queryHash: string;
        query: string;
        count: number;
        averageDuration: number;
        maxDuration: number;
      }>;
      optimizationSuggestions: Array<{
        id: string;
        issue: string;
        suggestion: string;
        severity: 'low' | 'medium' | 'high';
      }>;
    };
  };
  backups: {
    totalBackups: number;
    successfulBackups: number;
    failedBackups: number;
    lastBackup?: string;
  };
}

export function MonitoringDashboard() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [healthResponse, performanceResponse] = await Promise.all([
        fetch('/api/monitoring/health?type=full'),
        fetch('/api/monitoring/performance?type=overview'),
      ]);

      const healthData = await healthResponse.json();
      const performanceData = await performanceResponse.json();

      setData({
        health: healthData.health,
        performance: {
          alerts: performanceData.overview.alerts || [],
          database: {
            slowQueries: performanceData.overview.database.slowQueries || [],
            optimizationSuggestions: performanceData.overview.database.optimizationSuggestions || [],
          },
        },
        backups: healthData.backups,
      });
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  const resolveAlert = async (alertId: string) => {
    try {
      await fetch('/api/monitoring/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve_alert', alertId }),
      });
      await fetchData();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load monitoring data</AlertDescription>
      </Alert>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'unhealthy':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatUptime = (uptime: number) => {
    const days = Math.floor(uptime / (24 * 60 * 60 * 1000));
    const hours = Math.floor((uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((uptime % (60 * 60 * 1000)) / (60 * 1000));
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Monitoring</h1>
          <p className="text-muted-foreground">
            Real-time system health and performance monitoring
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            {getStatusIcon(data.health.overall)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{data.health.overall}</div>
            <p className="text-xs text-muted-foreground">
              Uptime: {formatUptime(data.health.uptime)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <MemoryStick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.health.metrics.memory.percentage}%</div>
            <Progress value={data.health.metrics.memory.percentage} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {data.health.metrics.memory.used}MB / {data.health.metrics.memory.total}MB
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.health.metrics.cpu.usage}%</div>
            <Progress value={data.health.metrics.cpu.usage} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.health.metrics.cache.hitRate}%</div>
            <Progress value={data.health.metrics.cache.hitRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {data.health.metrics.cache.entryCount} entries
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Monitoring */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="backups">Backups</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Alerts</CardTitle>
              <CardDescription>
                Current system alerts and warnings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.performance.alerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No active alerts</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.performance.alerts.map((alert) => (
                    <Alert key={alert.id} className={
                      alert.severity === 'critical' ? 'border-red-500' :
                      alert.severity === 'high' ? 'border-orange-500' :
                      alert.severity === 'medium' ? 'border-yellow-500' :
                      'border-blue-500'
                    }>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="flex items-center justify-between">
                        <span>{alert.type.replace(/_/g, ' ').toUpperCase()}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            alert.severity === 'critical' ? 'destructive' :
                            alert.severity === 'high' ? 'destructive' :
                            alert.severity === 'medium' ? 'default' :
                            'secondary'
                          }>
                            {alert.severity}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resolveAlert(alert.id)}
                          >
                            Resolve
                          </Button>
                        </div>
                      </AlertTitle>
                      <AlertDescription>
                        {alert.message}
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {new Date(alert.timestamp).toLocaleString()}
                        </span>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Slow Queries</CardTitle>
                <CardDescription>
                  Queries taking longer than expected
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.performance.database.slowQueries.length === 0 ? (
                  <p className="text-muted-foreground">No slow queries detected</p>
                ) : (
                  <div className="space-y-3">
                    {data.performance.database.slowQueries.slice(0, 5).map((query, index) => (
                      <div key={index} className="border rounded p-3">
                        <div className="flex justify-between items-start mb-2">
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {query.query.substring(0, 50)}...
                          </code>
                          <Badge variant="outline">{query.count}x</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Avg: {query.averageDuration}ms | Max: {query.maxDuration}ms
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Optimization Suggestions</CardTitle>
                <CardDescription>
                  Recommendations to improve performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.performance.database.optimizationSuggestions.length === 0 ? (
                  <p className="text-muted-foreground">No suggestions available</p>
                ) : (
                  <div className="space-y-3">
                    {data.performance.database.optimizationSuggestions.slice(0, 5).map((suggestion) => (
                      <div key={suggestion.id} className="border rounded p-3">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium">{suggestion.issue}</h4>
                          <Badge variant={
                            suggestion.severity === 'high' ? 'destructive' :
                            suggestion.severity === 'medium' ? 'default' :
                            'secondary'
                          }>
                            {suggestion.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {suggestion.suggestion}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total</span>
                    <span className="font-medium">{data.health.metrics.requests.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Successful</span>
                    <span className="font-medium text-green-600">{data.health.metrics.requests.successful}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Failed</span>
                    <span className="font-medium text-red-600">{data.health.metrics.requests.failed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Response</span>
                    <span className="font-medium">{data.health.metrics.requests.averageResponseTime}ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Database</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Connections</span>
                    <span className="font-medium">{data.health.metrics.database.connectionCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Slow Queries</span>
                    <span className="font-medium">{data.health.metrics.database.slowQueries}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Query Time</span>
                    <span className="font-medium">{data.health.metrics.database.averageQueryTime}ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cache</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Hit Rate</span>
                    <span className="font-medium">{data.health.metrics.cache.hitRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Entries</span>
                    <span className="font-medium">{data.health.metrics.cache.entryCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Size</span>
                    <span className="font-medium">
                      {Math.round(data.health.metrics.cache.totalSize / 1024 / 1024)}MB
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="backups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Backup Status</CardTitle>
              <CardDescription>
                System backup and recovery information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{data.backups.totalBackups}</div>
                  <p className="text-sm text-muted-foreground">Total Backups</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{data.backups.successfulBackups}</div>
                  <p className="text-sm text-muted-foreground">Successful</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{data.backups.failedBackups}</div>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium">
                    {data.backups.lastBackup 
                      ? new Date(data.backups.lastBackup).toLocaleDateString()
                      : 'Never'
                    }
                  </div>
                  <p className="text-sm text-muted-foreground">Last Backup</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}