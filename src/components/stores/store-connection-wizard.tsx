'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { SelectPlatform } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface StoreConnectionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ConnectionStep {
  id: string;
  title: string;
  description: string;
}

const steps: ConnectionStep[] = [
  {
    id: 'platform',
    title: 'Select Platform',
    description: 'Choose the marketplace you want to connect'
  },
  {
    id: 'credentials',
    title: 'Enter Credentials',
    description: 'Provide your API credentials for the platform'
  },
  {
    id: 'test',
    title: 'Test Connection',
    description: 'Verify the connection works correctly'
  },
  {
    id: 'settings',
    title: 'Configure Settings',
    description: 'Set up sync preferences and store settings'
  }
];

export function StoreConnectionWizard({ open, onOpenChange }: StoreConnectionWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [platforms, setPlatforms] = useState<SelectPlatform[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<SelectPlatform | null>(null);
  const [storeName, setStoreName] = useState('');
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState({
    autoSyncInventory: true,
    autoSyncOrders: true,
    syncIntervalMinutes: 15,
    priceMarkupPercentage: 0,
  });
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
    storeInfo?: any;
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchPlatforms();
      resetWizard();
    }
  }, [open]);

  const fetchPlatforms = async () => {
    try {
      const response = await fetch('/api/platforms');
      if (!response.ok) {
        if (response.status === 401) {
          // Auth error - user might not be logged in
          console.warn('Authentication required for platforms API');
          return;
        }
        throw new Error('Failed to fetch platforms');
      }
      
      const result = await response.json();
      if (result.success) {
        setPlatforms(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch platforms');
      }
    } catch (error) {
      console.error('Error fetching platforms:', error);
      toast({
        title: 'Error',
        description: 'Failed to load available platforms',
        variant: 'destructive',
      });
    }
  };

  const resetWizard = () => {
    setCurrentStep(0);
    setSelectedPlatform(null);
    setStoreName('');
    setCredentials({});
    setSettings({
      autoSyncInventory: true,
      autoSyncOrders: true,
      syncIntervalMinutes: 15,
      priceMarkupPercentage: 0,
    });
    setTestResult(null);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleTestConnection = async () => {
    if (!selectedPlatform) return;

    setLoading(true);
    try {
      const response = await fetch('/api/stores/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformName: selectedPlatform.name,
          credentials,
        }),
      });

      const result = await response.json();
      setTestResult(result);

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Connection test successful!',
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: result.error || 'Unknown error occurred',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setTestResult({
        success: false,
        error: 'Failed to test connection',
      });
      toast({
        title: 'Error',
        description: 'Failed to test connection',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedPlatform || !testResult?.success) return;

    setLoading(true);
    try {
      const response = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformId: selectedPlatform.id,
          name: storeName,
          platformStoreId: testResult.storeInfo?.id || 'unknown',
          credentials,
          settings,
        }),
      });

      if (!response.ok) throw new Error('Failed to connect store');

      toast({
        title: 'Success',
        description: 'Store connected successfully!',
      });

      onOpenChange(false);
      // Trigger a refresh of the store list
      window.location.reload();
    } catch (error) {
      console.error('Error connecting store:', error);
      toast({
        title: 'Error',
        description: 'Failed to connect store',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const renderPlatformSelection = () => (
    <div className="space-y-4">
      <div className="grid gap-4">
        {platforms.map((platform) => (
          <Card 
            key={platform.id}
            className={`cursor-pointer transition-colors ${
              selectedPlatform?.id === platform.id 
                ? 'ring-2 ring-primary' 
                : 'hover:bg-muted/50'
            }`}
            onClick={() => setSelectedPlatform(platform)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{platform.displayName}</CardTitle>
                  <CardDescription>{platform.name}</CardDescription>
                </div>
                {platform.isActive ? (
                  <Badge variant="default">Available</Badge>
                ) : (
                  <Badge variant="secondary">Coming Soon</Badge>
                )}
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderCredentialsForm = () => {
    if (!selectedPlatform) return null;

    const getCredentialFields = () => {
      switch (selectedPlatform.name) {
        case 'shopee':
          return [
            { key: 'partner_id', label: 'Partner ID', type: 'text', required: true },
            { key: 'partner_key', label: 'Partner Key', type: 'password', required: true },
            { key: 'shop_id', label: 'Shop ID', type: 'text', required: false },
          ];
        case 'tiktok_shop':
          return [
            { key: 'app_key', label: 'App Key', type: 'text', required: true },
            { key: 'app_secret', label: 'App Secret', type: 'password', required: true },
            { key: 'shop_id', label: 'Shop ID', type: 'text', required: false },
          ];
        case 'custom_website':
          return [
            { key: 'domain', label: 'Domain', type: 'url', required: true },
            { key: 'api_key', label: 'API Key', type: 'password', required: false },
          ];
        default:
          return [];
      }
    };

    const fields = getCredentialFields();

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="storeName">Store Name</Label>
          <Input
            id="storeName"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="Enter a name for this store"
          />
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="font-medium">API Credentials</h4>
          {fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              <Input
                id={field.key}
                type={field.type}
                value={credentials[field.key] || ''}
                onChange={(e) => setCredentials(prev => ({
                  ...prev,
                  [field.key]: e.target.value
                }))}
                placeholder={`Enter your ${field.label.toLowerCase()}`}
              />
            </div>
          ))}
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your credentials are encrypted and stored securely. We never share your API keys with third parties.
          </AlertDescription>
        </Alert>
      </div>
    );
  };

  const renderConnectionTest = () => (
    <div className="space-y-4">
      <div className="text-center space-y-4">
        {!testResult ? (
          <>
            <p className="text-muted-foreground">
              Click the button below to test your connection to {selectedPlatform?.displayName}
            </p>
            <Button 
              onClick={handleTestConnection} 
              disabled={loading}
              className="w-full"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Test Connection
            </Button>
          </>
        ) : testResult.success ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center text-green-600">
              <CheckCircle className="h-8 w-8" />
            </div>
            <div>
              <h4 className="font-medium text-green-600">Connection Successful!</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Successfully connected to {testResult.storeInfo?.name || 'your store'}
              </p>
            </div>
            {testResult.storeInfo && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Store Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Store ID:</span>
                    <span>{testResult.storeInfo.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <span>{testResult.storeInfo.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant="default">{testResult.storeInfo.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center text-destructive">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div>
              <h4 className="font-medium text-destructive">Connection Failed</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {testResult.error || 'Unknown error occurred'}
              </p>
            </div>
            <Button 
              onClick={handleTestConnection} 
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <h4 className="font-medium">Sync Settings</h4>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-sync Inventory</Label>
              <p className="text-sm text-muted-foreground">
                Automatically sync inventory changes to this store
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoSyncInventory}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                autoSyncInventory: e.target.checked
              }))}
              className="rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-sync Orders</Label>
              <p className="text-sm text-muted-foreground">
                Automatically fetch new orders from this store
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoSyncOrders}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                autoSyncOrders: e.target.checked
              }))}
              className="rounded"
            />
          </div>

          <div className="space-y-2">
            <Label>Sync Interval (minutes)</Label>
            <Input
              type="number"
              min="5"
              max="1440"
              value={settings.syncIntervalMinutes}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                syncIntervalMinutes: parseInt(e.target.value) || 15
              }))}
            />
            <p className="text-sm text-muted-foreground">
              How often to sync data (5-1440 minutes)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Price Markup (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={settings.priceMarkupPercentage}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                priceMarkupPercentage: parseFloat(e.target.value) || 0
              }))}
            />
            <p className="text-sm text-muted-foreground">
              Automatic price markup when syncing to this store
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const canProceed = () => {
    switch (currentStep) {
      case 0: return selectedPlatform !== null;
      case 1: return storeName.trim() !== '' && Object.keys(credentials).length > 0;
      case 2: return testResult?.success === true;
      case 3: return true;
      default: return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Connect New Store</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Steps */}
          <div className="flex items-center space-x-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`
                  flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                  ${index <= currentStep 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                  }
                `}>
                  {index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div className={`
                    w-12 h-0.5 mx-2
                    ${index < currentStep ? 'bg-primary' : 'bg-muted'}
                  `} />
                )}
              </div>
            ))}
          </div>

          {/* Current Step Content */}
          <div className="min-h-[400px]">
            <div className="mb-6">
              <h3 className="text-lg font-medium">{steps[currentStep].title}</h3>
              <p className="text-muted-foreground">{steps[currentStep].description}</p>
            </div>

            {currentStep === 0 && renderPlatformSelection()}
            {currentStep === 1 && renderCredentialsForm()}
            {currentStep === 2 && renderConnectionTest()}
            {currentStep === 3 && renderSettings()}
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <div className="space-x-2">
              {currentStep < steps.length - 1 ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleConnect}
                  disabled={!canProceed() || loading}
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Connect Store
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}