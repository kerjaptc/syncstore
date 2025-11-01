'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Store, 
  MoreHorizontal, 
  Settings, 
  RefreshCw, 
  Unplug, 
  Activity,
  Clock,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { StoreWithRelations } from '@/types';
import { StoreSettingsDialog } from '@/components/stores/store-settings-dialog';
import { SyncHistoryDialog } from '@/components/stores/sync-history-dialog';
import { useToast } from '@/hooks/use-toast';

export function StoreList() {
  const [stores, setStores] = useState<StoreWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<StoreWithRelations | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSyncHistory, setShowSyncHistory] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/stores');
      if (!response.ok) throw new Error('Failed to fetch stores');
      const data = await response.json();
      setStores(data.stores || []);
    } catch (error) {
      console.error('Error fetching stores:', error);
      toast({
        title: 'Error',
        description: 'Failed to load stores',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshCredentials = async (store: StoreWithRelations) => {
    try {
      const response = await fetch(`/api/stores/${store.id}/refresh`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to refresh credentials');
      
      toast({
        title: 'Success',
        description: 'Store credentials refreshed successfully',
      });
      
      fetchStores(); // Refresh the list
    } catch (error) {
      console.error('Error refreshing credentials:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh credentials',
        variant: 'destructive',
      });
    }
  };

  const handleDisconnectStore = async (store: StoreWithRelations) => {
    if (!confirm(`Are you sure you want to disconnect ${store.name}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/stores/${store.id}/disconnect`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to disconnect store');
      
      toast({
        title: 'Success',
        description: 'Store disconnected successfully',
      });
      
      fetchStores(); // Refresh the list
    } catch (error) {
      console.error('Error disconnecting store:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect store',
        variant: 'destructive',
      });
    }
  };

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'paused':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Paused</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatLastSync = (lastSyncAt: Date | null) => {
    if (!lastSyncAt) return 'Never';
    const now = new Date();
    const diff = now.getTime() - new Date(lastSyncAt).getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            No Stores Connected
          </CardTitle>
          <CardDescription>
            Connect your first marketplace store to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Connect stores from Shopee, TikTok Shop, and other marketplaces to manage your inventory, 
            products, and orders from one central dashboard.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stores.map((store) => (
          <Card key={store.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-lg">{store.name}</CardTitle>
                    <CardDescription>{store.platform.displayName}</CardDescription>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={() => {
                        setSelectedStore(store);
                        setShowSettings(true);
                      }}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setSelectedStore(store);
                        setShowSyncHistory(true);
                      }}
                    >
                      <Activity className="h-4 w-4 mr-2" />
                      Sync History
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleRefreshCredentials(store)}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh Credentials
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDisconnectStore(store)}
                      className="text-destructive"
                    >
                      <Unplug className="h-4 w-4 mr-2" />
                      Disconnect
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {getSyncStatusBadge(store.syncStatus)}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last Sync</span>
                <span className="text-sm">{formatLastSync(store.lastSyncAt)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Products</span>
                <span className="text-sm font-medium">{store._count.products}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Orders</span>
                <span className="text-sm font-medium">{store._count.orders}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedStore && (
        <>
          <StoreSettingsDialog
            store={selectedStore}
            open={showSettings}
            onOpenChange={setShowSettings}
            onUpdate={fetchStores}
          />
          <SyncHistoryDialog
            store={selectedStore}
            open={showSyncHistory}
            onOpenChange={setShowSyncHistory}
          />
        </>
      )}
    </>
  );
}