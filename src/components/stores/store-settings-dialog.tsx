'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Save, 
  Loader2, 
  AlertCircle, 
  Settings, 
  Key,
  Info
} from 'lucide-react';
import { StoreWithRelations } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface StoreSettingsDialogProps {
  store: StoreWithRelations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function StoreSettingsDialog({ 
  store, 
  open, 
  onOpenChange, 
  onUpdate 
}: StoreSettingsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [storeName, setStoreName] = useState(store.name);
  const [settings, setSettings] = useState({
    autoSyncInventory: true,
    autoSyncOrders: true,
    syncIntervalMinutes: 15,
    priceMarkupPercentage: 0,
    ...store.settings as any,
  });
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [showCredentials, setShowCredentials] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setStoreName(store.name);
      setSettings({
        autoSyncInventory: true,
        autoSyncOrders: true,
        syncIntervalMinutes: 15,
        priceMarkupPercentage: 0,
        ...store.settings as any,
      });
      setCredentials({});
      setShowCredentials(false);
    }
  }, [open, store]);

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/stores/${store.id}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: storeName,
          settings,
        }),
      });

      if (!response.ok) throw new Error('Failed to update settings');

      toast({
        title: 'Success',
        description: 'Store settings updated successfully',
      });

      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to update store settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCredentials = async () => {
    if (Object.keys(credentials).length === 0) {
      toast({
        title: 'Error',
        description: 'Please enter at least one credential field',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/stores/${store.id}/credentials`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentials }),
      });

      if (!response.ok) throw new Error('Failed to update credentials');

      toast({
        title: 'Success',
        description: 'Store credentials updated successfully',
      });

      setCredentials({});
      onUpdate();
    } catch (error) {
      console.error('Error updating credentials:', error);
      toast({
        title: 'Error',
        description: 'Failed to update store credentials',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getCredentialFields = () => {
    switch (store.platform.name) {
      case 'shopee':
        return [
          { key: 'partner_id', label: 'Partner ID', type: 'text' },
          { key: 'partner_key', label: 'Partner Key', type: 'password' },
          { key: 'shop_id', label: 'Shop ID', type: 'text' },
          { key: 'access_token', label: 'Access Token', type: 'password' },
          { key: 'refresh_token', label: 'Refresh Token', type: 'password' },
        ];
      case 'tiktok_shop':
        return [
          { key: 'app_key', label: 'App Key', type: 'text' },
          { key: 'app_secret', label: 'App Secret', type: 'password' },
          { key: 'shop_id', label: 'Shop ID', type: 'text' },
          { key: 'access_token', label: 'Access Token', type: 'password' },
          { key: 'refresh_token', label: 'Refresh Token', type: 'password' },
        ];
      case 'custom_website':
        return [
          { key: 'domain', label: 'Domain', type: 'url' },
          { key: 'api_key', label: 'API Key', type: 'password' },
        ];
      default:
        return [];
    }
  };

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="storeName">Store Name</Label>
          <Input
            id="storeName"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="Enter store name"
          />
        </div>

        <div className="space-y-2">
          <Label>Platform</Label>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{store.platform.displayName}</Badge>
            <span className="text-sm text-muted-foreground">
              Platform ID: {store.platformStoreId}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Connection Status</Label>
          <div className="flex items-center gap-2">
            <Badge 
              variant={store.syncStatus === 'active' ? 'default' : 'secondary'}
            >
              {store.syncStatus}
            </Badge>
            {store.lastSyncAt && (
              <span className="text-sm text-muted-foreground">
                Last sync: {new Date(store.lastSyncAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSyncSettings = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Auto-sync Inventory</Label>
            <p className="text-sm text-muted-foreground">
              Automatically sync inventory changes to this store
            </p>
          </div>
          <Switch
            checked={settings.autoSyncInventory}
            onCheckedChange={(checked) => setSettings((prev: any) => ({
              ...prev,
              autoSyncInventory: checked
            }))}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Auto-sync Orders</Label>
            <p className="text-sm text-muted-foreground">
              Automatically fetch new orders from this store
            </p>
          </div>
          <Switch
            checked={settings.autoSyncOrders}
            onCheckedChange={(checked) => setSettings((prev: any) => ({
              ...prev,
              autoSyncOrders: checked
            }))}
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="syncInterval">Sync Interval (minutes)</Label>
          <Input
            id="syncInterval"
            type="number"
            min="5"
            max="1440"
            value={settings.syncIntervalMinutes}
            onChange={(e) => setSettings((prev: any) => ({
              ...prev,
              syncIntervalMinutes: parseInt(e.target.value) || 15
            }))}
          />
          <p className="text-sm text-muted-foreground">
            How often to sync data (5-1440 minutes)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priceMarkup">Price Markup (%)</Label>
          <Input
            id="priceMarkup"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={settings.priceMarkupPercentage}
            onChange={(e) => setSettings((prev: any) => ({
              ...prev,
              priceMarkupPercentage: parseFloat(e.target.value) || 0
            }))}
          />
          <p className="text-sm text-muted-foreground">
            Automatic price markup when syncing to this store
          </p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Changes to sync settings will take effect on the next sync cycle.
        </AlertDescription>
      </Alert>
    </div>
  );

  const renderCredentialsSettings = () => (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Only enter credentials that need to be updated. Leave fields empty to keep existing values.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {getCredentialFields().map((field) => (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={field.key}>{field.label}</Label>
            <Input
              id={field.key}
              type={field.type}
              value={credentials[field.key] || ''}
              onChange={(e) => setCredentials(prev => ({
                ...prev,
                [field.key]: e.target.value
              }))}
              placeholder={`Enter new ${field.label.toLowerCase()}`}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button 
          onClick={handleUpdateCredentials}
          disabled={loading || Object.keys(credentials).length === 0}
        >
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Update Credentials
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Store Settings - {store.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="sync">Sync Settings</TabsTrigger>
            <TabsTrigger value="credentials">Credentials</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            {renderGeneralSettings()}
          </TabsContent>

          <TabsContent value="sync" className="space-y-4">
            {renderSyncSettings()}
          </TabsContent>

          <TabsContent value="credentials" className="space-y-4">
            {renderCredentialsSettings()}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveSettings} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}