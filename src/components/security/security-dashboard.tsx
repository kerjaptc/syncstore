/**
 * Security Dashboard Component
 * Provides comprehensive security monitoring and management interface
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  AlertTriangle, 
  Eye, 
  Lock, 
  Activity,
  Users,
  FileText,
  Settings,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';

interface SecurityMetrics {
  overview: {
    securityScore: number;
    totalEvents: number;
    failureRate: number;
    anomaliesDetected: number;
    threatsIdentified: number;
  };
  authentication: {
    activeTokens: number;
    revokedTokens: number;
    expiredTokens: number;
    loginFailures: number;
    loginSuccesses: number;
  };
  authorization: {
    accessDenied: number;
    accessGranted: number;
    permissionEscalations: number;
  };
  attacks: {
    csrfAttempts: number;
    xssAttempts: number;
    sqlInjectionAttempts: number;
    suspiciousActivity: number;
  };
  rateLimiting: {
    totalRequests: number;
    blockedRequests: number;
    blockRate: number;
  };
  threats: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    count: number;
    recommendation: string;
  }>;
  recentIncidents: Array<{
    id: string;
    timestamp: string;
    eventType: string;
    severity: string;
    action: string;
    outcome: string;
    ipAddress: string;
  }>;
}

interface DLPData {
  rules: Array<{
    id: string;
    name: string;
    type: string;
    action: string;
    severity: string;
    enabled: boolean;
  }>;
  statistics: {
    totalViolations: number;
    violationsBySeverity: Record<string, number>;
    violationsByType: Record<string, number>;
    blockedAttempts: number;
    topViolatingUsers: Array<{ userId: string; count: number }>;
    topViolatingRules: Array<{ ruleId: string; ruleName: string; count: number }>;
  };
}

export function SecurityDashboard() {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [dlpData, setDLPData] = useState<DLPData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSecurityData = async () => {
    try {
      setRefreshing(true);
      
      // Fetch security metrics
      const metricsResponse = await fetch('/api/security/metrics?timeWindow=24');
      if (!metricsResponse.ok) {
        throw new Error('Failed to fetch security metrics');
      }
      const metricsData = await metricsResponse.json();
      setMetrics(metricsData);

      // Fetch DLP data
      const dlpResponse = await fetch('/api/security/dlp?includeStats=true&timeWindow=24');
      if (!dlpResponse.ok) {
        throw new Error('Failed to fetch DLP data');
      }
      const dlpResponseData = await dlpResponse.json();
      setDLPData(dlpResponseData);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch security data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
    
    // Refresh data every 5 minutes
    const interval = setInterval(fetchSecurityData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const exportAuditLogs = async () => {
    try {
      const response = await fetch('/api/security/audit-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filters: {
            startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            endTime: new Date().toISOString(),
          },
          format: 'csv',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to export audit logs');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export audit logs:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading security dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Security Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor security events, threats, and compliance status
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSecurityData}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportAuditLogs}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Logs
          </Button>
        </div>
      </div>

      {/* Security Score Overview */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Security Score</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(metrics.overview.securityScore)}`}>
                {metrics.overview.securityScore}/100
              </div>
              <Progress 
                value={metrics.overview.securityScore} 
                className="mt-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Security Events</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.overview.totalEvents.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.overview.failureRate.toFixed(1)}% failure rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Threats Detected</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {metrics.overview.threatsIdentified}
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics.overview.anomaliesDetected} anomalies
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.authentication.activeTokens}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.authentication.revokedTokens} revoked
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Threats Alert */}
      {metrics && metrics.threats.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Active Security Threats</AlertTitle>
          <AlertDescription>
            {metrics.threats.length} security threat(s) detected. Immediate attention required.
          </AlertDescription>
        </Alert>
      )}

      {/* Detailed Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="threats">Threats</TabsTrigger>
          <TabsTrigger value="authentication">Authentication</TabsTrigger>
          <TabsTrigger value="dlp">Data Protection</TabsTrigger>
          <TabsTrigger value="incidents">Recent Incidents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {metrics && (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Authentication Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Authentication</CardTitle>
                  <CardDescription>Login and token statistics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Successful Logins</span>
                    <span className="font-medium text-green-600">
                      {metrics.authentication.loginSuccesses}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Failed Logins</span>
                    <span className="font-medium text-red-600">
                      {metrics.authentication.loginFailures}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Tokens</span>
                    <span className="font-medium">{metrics.authentication.activeTokens}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expired Tokens</span>
                    <span className="font-medium text-yellow-600">
                      {metrics.authentication.expiredTokens}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Attack Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle>Attack Attempts</CardTitle>
                  <CardDescription>Security attack detection</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>CSRF Attempts</span>
                    <span className="font-medium text-red-600">
                      {metrics.attacks.csrfAttempts}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>XSS Attempts</span>
                    <span className="font-medium text-red-600">
                      {metrics.attacks.xssAttempts}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>SQL Injection</span>
                    <span className="font-medium text-red-600">
                      {metrics.attacks.sqlInjectionAttempts}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Suspicious Activity</span>
                    <span className="font-medium text-yellow-600">
                      {metrics.attacks.suspiciousActivity}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Rate Limiting */}
              <Card>
                <CardHeader>
                  <CardTitle>Rate Limiting</CardTitle>
                  <CardDescription>API request throttling</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total Requests</span>
                    <span className="font-medium">
                      {metrics.rateLimiting.totalRequests.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Blocked Requests</span>
                    <span className="font-medium text-red-600">
                      {metrics.rateLimiting.blockedRequests.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Block Rate</span>
                    <span className="font-medium">
                      {metrics.rateLimiting.blockRate.toFixed(2)}%
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Authorization */}
              <Card>
                <CardHeader>
                  <CardTitle>Authorization</CardTitle>
                  <CardDescription>Access control statistics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Access Granted</span>
                    <span className="font-medium text-green-600">
                      {metrics.authorization.accessGranted}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Access Denied</span>
                    <span className="font-medium text-red-600">
                      {metrics.authorization.accessDenied}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Permission Escalations</span>
                    <span className="font-medium text-red-600">
                      {metrics.authorization.permissionEscalations}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="threats" className="space-y-4">
          {metrics && metrics.threats.length > 0 ? (
            <div className="space-y-4">
              {metrics.threats.map((threat, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{threat.description}</CardTitle>
                      <Badge variant={getSeverityColor(threat.severity) as any}>
                        {threat.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <CardDescription>
                      Type: {threat.type} • Count: {threat.count}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Recommendation:</strong> {threat.recommendation}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <div className="text-center">
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-muted-foreground">No active threats detected</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="authentication" className="space-y-4">
          {metrics && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Login Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                        <span>Successful Logins</span>
                      </div>
                      <span className="font-bold text-green-600">
                        {metrics.authentication.loginSuccesses}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <XCircle className="h-4 w-4 text-red-600 mr-2" />
                        <span>Failed Logins</span>
                      </div>
                      <span className="font-bold text-red-600">
                        {metrics.authentication.loginFailures}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Token Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Activity className="h-4 w-4 text-green-600 mr-2" />
                        <span>Active Tokens</span>
                      </div>
                      <span className="font-bold">{metrics.authentication.activeTokens}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 text-yellow-600 mr-2" />
                        <span>Expired Tokens</span>
                      </div>
                      <span className="font-bold text-yellow-600">
                        {metrics.authentication.expiredTokens}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <XCircle className="h-4 w-4 text-red-600 mr-2" />
                        <span>Revoked Tokens</span>
                      </div>
                      <span className="font-bold text-red-600">
                        {metrics.authentication.revokedTokens}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="dlp" className="space-y-4">
          {dlpData && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>DLP Violations</CardTitle>
                  <CardDescription>Data loss prevention statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Violations</span>
                      <span className="font-medium text-red-600">
                        {dlpData.statistics.totalViolations}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Blocked Attempts</span>
                      <span className="font-medium text-red-600">
                        {dlpData.statistics.blockedAttempts}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>DLP Rules</CardTitle>
                  <CardDescription>Active protection rules</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Rules</span>
                      <span className="font-medium">{dlpData.rules.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Active Rules</span>
                      <span className="font-medium text-green-600">
                        {dlpData.rules.filter(r => r.enabled).length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4">
          {metrics && metrics.recentIncidents.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Recent Security Incidents</CardTitle>
                <CardDescription>Latest security events requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.recentIncidents.map((incident) => (
                    <div key={incident.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center space-x-3">
                        <Badge variant={getSeverityColor(incident.severity) as any}>
                          {incident.severity}
                        </Badge>
                        <div>
                          <p className="font-medium">{incident.action}</p>
                          <p className="text-sm text-muted-foreground">
                            {incident.eventType} • {incident.ipAddress}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{incident.outcome}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(incident.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <div className="text-center">
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-muted-foreground">No recent security incidents</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}