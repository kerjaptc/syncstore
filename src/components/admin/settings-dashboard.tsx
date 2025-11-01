'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Settings, 
  Key, 
  TestTube, 
  Shield, 
  CheckCircle, 
  XCircle, 
  Clock,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle,
  History
} from 'lucide-react';
import { ApiKeyConfigDialog } from './api-key-config-dialog';
import { AuditLogDialog } from './audit-log-dialog';

interface Setting {
  key: string;
  value: string;
  isSensitive: boolean;
  description?: string;
  lastTested?: string;
  testStatus: 'untested' | 'success' | 'failed';
  testError?: string;
}

interface ConnectionTestResult {
  success: boolean;
  message: string;
  timestamp: string;
}

export function SettingsDashboard() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState<Setting | null>(null);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  // Predefined API configurations
  const apiConfigs = [
    {
      key: 'shopee_api_config',
      name: 'Shopee API',
      description: 'Shopee marketplace integration credentials',
      icon: '🛍️',
      fields: [
        { name: 'appKey', label: 'App Key', type: 'text' as const, required: true },
        { name: 'appSecret', label: 'App Secret', type: 'password' as const, required: true },
        { name: 'partnerId', label: 'Partner ID', type: 'text' as const, required: true },
      ],
    },
    {
      key: 'tiktokshop_api_config',
      name: 'TikTok Shop API',
      description: 'TikTok Shop marketplace integration credentials',
      icon: '🎵',
      fields: [
        { name: 'appKey', label: 'App Key', type: 'text' as const, required: true },
        { name: 'appSecret', label: 'App Secret', type: 'password' as const, required: true },
      ],
    },
    {
      key: 'sentry_dsn',
      name: 'Sentry Error Monitoring',
      description: 'Error tracking and monitoring service',
      icon: '🐛',
      fields: [
        { name: 'dsn', label: 'DSN URL', type: 'text' as const, required: true },
      ],
    },
    {
      key: 'redis_url',
      name: 'Redis Cache',
      description: 'Redis caching service configuration',
      icon: '⚡',
      fields: [
        { name: 'url', label: 'Redis URL', type: 'text' as const, required: true },
      ],
    },
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/settings?masked=true');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch settings');
      }

      setSettings(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (key: string) => {
    try {
      setTestingKey(key);
      const response = await fetch('/api/admin/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Connection test failed');
      }

      // Update the setting's test status
      setSettings(prev => prev.map(setting => 
        setting.key === key 
          ? { 
              ...setting, 
              testStatus: data.data.success ? 'success' : 'failed',
              testError: data.data.success ? undefined : data.data.message,
              lastTested: data.data.timestamp,
            }
          : setting
      ));

    } catch (err) {
      console.error('Connection test failed:', err);
    } finally {
      setTestingKey(null);
    }
  };

  const deleteSetting = async (key: string) => {
    if (!confirm('Are you sure you want to delete this configuration?')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to delete setting');
      }

      setSettings(prev => prev.filter(setting => setting.key !== key));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete setting');
    }
  };

  const toggleShowValue = (key: string) => {
    setShowValues(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">Connected</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Not Tested</Badge>;
    }
  };

  const getConfigForKey = (key: string) => {
    return apiConfigs.find(config => config.key === key);
  };

  const getSettingForKey = (key: string) => {
    return settings.find(setting => setting.key === key);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Configuration</h1>
          <p className="text-muted-foreground">
            Manage your marketplace integrations and external service configurations
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setAuditDialogOpen(true)}
          >
            <History className="h-4 w-4 mr-2" />
            Audit Log
          </Button>
          <Button onClick={fetchSettings}>
            <Settings className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="integrations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="integrations">Marketplace Integrations</TabsTrigger>
          <TabsTrigger value="services">System Services</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {apiConfigs
              .filter(config => config.key.includes('api_config'))
              .map((config) => {
                const setting = getSettingForKey(config.key);
                const isConfigured = !!setting;

                return (
                  <Card key={config.key} className="relative">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{config.icon}</span>
                          <div>
                            <CardTitle className="text-lg">{config.name}</CardTitle>
                            <CardDescription>{config.description}</CardDescription>
                          </div>
                        </div>
                        {isConfigured && getStatusBadge(setting.testStatus)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {isConfigured ? (
                        <>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {getStatusIcon(setting.testStatus)}
                            <span>
                              {setting.testStatus === 'success' && 'Connection verified'}
                              {setting.testStatus === 'failed' && `Error: ${setting.testError}`}
                              {setting.testStatus === 'untested' && 'Not tested yet'}
                            </span>
                          </div>

                          {setting.lastTested && (
                            <p className="text-xs text-muted-foreground">
                              Last tested: {new Date(setting.lastTested).toLocaleString()}
                            </p>
                          )}

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => testConnection(config.key)}
                              disabled={testingKey === config.key}
                            >
                              <TestTube className="h-4 w-4 mr-1" />
                              {testingKey === config.key ? 'Testing...' : 'Test'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingSetting(setting);
                                setConfigDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteSetting(config.key)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-muted-foreground mb-4">Not configured</p>
                          <Button
                            onClick={() => {
                              setEditingSetting(null);
                              setConfigDialogOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Configure
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {apiConfigs
              .filter(config => !config.key.includes('api_config'))
              .map((config) => {
                const setting = getSettingForKey(config.key);
                const isConfigured = !!setting;

                return (
                  <Card key={config.key}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{config.icon}</span>
                          <div>
                            <CardTitle className="text-lg">{config.name}</CardTitle>
                            <CardDescription>{config.description}</CardDescription>
                          </div>
                        </div>
                        {isConfigured && getStatusBadge(setting.testStatus)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {isConfigured ? (
                        <>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {getStatusIcon(setting.testStatus)}
                            <span>
                              {setting.testStatus === 'success' && 'Service connected'}
                              {setting.testStatus === 'failed' && `Error: ${setting.testError}`}
                              {setting.testStatus === 'untested' && 'Not tested yet'}
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => testConnection(config.key)}
                              disabled={testingKey === config.key}
                            >
                              <TestTube className="h-4 w-4 mr-1" />
                              {testingKey === config.key ? 'Testing...' : 'Test'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingSetting(setting);
                                setConfigDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteSetting(config.key)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-muted-foreground mb-4">Not configured</p>
                          <Button
                            onClick={() => {
                              setEditingSetting(null);
                              setConfigDialogOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Configure
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </TabsContent>
      </Tabs>

      <ApiKeyConfigDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        configs={apiConfigs}
        editingSetting={editingSetting}
        onSaved={() => {
          fetchSettings();
          setConfigDialogOpen(false);
          setEditingSetting(null);
        }}
      />

      <AuditLogDialog
        open={auditDialogOpen}
        onOpenChange={setAuditDialogOpen}
      />
    </div>
  );
}