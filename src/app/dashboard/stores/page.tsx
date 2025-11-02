"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, 
  Store, 
  ShoppingBag, 
  RefreshCw, 
  Settings, 
  MoreHorizontal,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap
} from "lucide-react";
import { ConnectStoreDialog } from "@/components/stores/connect-store-dialog";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Import SyncStore MVP Components
import { 
  StoreConnectionWizard,
  ConnectionStatusDisplay,
  ProductDashboard,
  NotificationProvider,
  NotificationBell,
  useNotificationHelpers,
  SyncProgressDisplay,
  LoadingButton,
  EmptyState
} from "@/lib/syncstore-mvp";

interface Store {
  id: string;
  name: string;
  platform: {
    name: string;
    displayName: string;
  };
  syncStatus: 'active' | 'syncing' | 'error' | 'inactive';
  lastSyncAt: Date | null;
  isActive: boolean;
  stats: {
    products: number;
    orders: number;
    revenue: number;
  };
}

const mockStores: Store[] = [
  {
    id: "1",
    name: "Toko Elektronik - Shopee",
    platform: {
      name: "shopee",
      displayName: "Shopee"
    },
    syncStatus: "active",
    lastSyncAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    isActive: true,
    stats: {
      products: 156,
      orders: 89,
      revenue: 15750000
    }
  },
  {
    id: "2", 
    name: "Fashion Store - Shopee",
    platform: {
      name: "shopee",
      displayName: "Shopee"
    },
    syncStatus: "syncing",
    lastSyncAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    isActive: true,
    stats: {
      products: 234,
      orders: 156,
      revenue: 28900000
    }
  }
];

function StoresPageContent() {
  const [stores, setStores] = useState<Store[]>(mockStores);
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSyncStoreMvp, setShowSyncStoreMvp] = useState(true);
  const { showSyncNotification, showConnectionNotification } = useNotificationHelpers();

  // Handle OAuth callback notifications
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');
    const shopName = urlParams.get('shop_name');
    const shopId = urlParams.get('shop_id');

    if (success === 'shopee_connected') {
      toast.success(`Toko Shopee "${shopName}" berhasil terhubung!`);
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      // Refresh store list
      // In real implementation, you would fetch from API
    } else if (error) {
      const errorMessages: Record<string, string> = {
        'oauth_error_access_denied': 'Akses ditolak. Anda membatalkan proses authorization.',
        'missing_oauth_parameters': 'Parameter OAuth tidak lengkap. Silakan coba lagi.',
        'oauth_callback_failed': 'Gagal memproses callback OAuth. Silakan coba lagi.',
      };
      
      const message = errorMessages[error] || 'Terjadi kesalahan saat menghubungkan toko.';
      toast.error(message);
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const getStatusIcon = (status: Store['syncStatus']) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'syncing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'inactive':
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: Store['syncStatus']) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Aktif</Badge>;
      case 'syncing':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Sinkronisasi</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Tidak Aktif</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'shopee':
        return <ShoppingBag className="h-5 w-5 text-orange-500" />;
      default:
        return <Store className="h-5 w-5" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatLastSync = (date: Date | null) => {
    if (!date) return 'Belum pernah';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) {
      return `${minutes} menit yang lalu`;
    } else if (hours < 24) {
      return `${hours} jam yang lalu`;
    } else {
      return `${days} hari yang lalu`;
    }
  };

  const handleSyncStore = async (storeId: string) => {
    setIsLoading(true);
    try {
      // Show sync started notification
      const syncId = showSyncNotification('started', storeId);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update store status
      setStores(stores.map(store => 
        store.id === storeId 
          ? { ...store, syncStatus: 'syncing' as const, lastSyncAt: new Date() }
          : store
      ));
      
      // Show progress notifications
      showSyncNotification('progress', storeId, { progress: 50, itemsProcessed: 25, totalItems: 50 });
      
      // Simulate sync completion
      setTimeout(() => {
        setStores(stores.map(store => 
          store.id === storeId 
            ? { ...store, syncStatus: 'active' as const }
            : store
        ));
        showSyncNotification('completed', storeId, { itemsProcessed: 50 });
      }, 5000);
      
    } catch (error) {
      showSyncNotification('failed', storeId, { error: 'Gagal memulai sinkronisasi' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleHealthCheck = async (storeId: string) => {
    setIsLoading(true);
    try {
      // In real implementation, this would call the health check API
      const response = await fetch(`/api/platforms/shopee/health?shopId=${storeId}`);
      const data = await response.json();
      
      if (response.ok) {
        showConnectionNotification('connected', storeId);
        toast.success(`Koneksi OK - ${data.shopName}`);
      } else {
        showConnectionNotification('error', storeId, data.error);
        toast.error(`Koneksi gagal: ${data.error}`);
      }
      
    } catch (error) {
      showConnectionNotification('error', storeId, 'Gagal melakukan tes koneksi');
      toast.error("Gagal melakukan tes koneksi");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Toko Terhubung</h1>
          <p className="text-muted-foreground">
            Kelola dan sinkronisasi toko dari berbagai platform
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Button 
            variant="outline" 
            onClick={() => setShowSyncStoreMvp(!showSyncStoreMvp)}
          >
            {showSyncStoreMvp ? 'Legacy View' : 'SyncStore MVP'}
          </Button>
          <Button onClick={() => setIsConnectDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Hubungkan Toko
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Toko</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stores.length}</div>
            <p className="text-xs text-muted-foreground">
              {stores.filter(s => s.isActive).length} aktif
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Produk</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stores.reduce((sum, store) => sum + store.stats.products, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Dari semua toko
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pesanan</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stores.reduce((sum, store) => sum + store.stats.orders, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Bulan ini
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stores.reduce((sum, store) => sum + store.stats.revenue, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Bulan ini
            </p>
          </CardContent>
        </Card>
      </div>

      {/* SyncStore MVP Components */}
      {showSyncStoreMvp && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-500" />
                SyncStore MVP - Enhanced Store Management
              </CardTitle>
              <CardDescription>
                Advanced store connection and synchronization features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Connection Status Display */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {stores.map((store) => (
                  <ConnectionStatusDisplay
                    key={store.id}
                    storeId={store.id}
                    organizationId="demo-org"
                    onConnectionDeleted={() => console.log('Connection deleted:', store.id)}
                    onConnectionUpdated={(connection) => console.log('Connection updated:', connection)}
                  />
                ))}
              </div>

              {/* Product Dashboard */}
              <div className="mt-8">
                <ProductDashboard
                  storeId={stores[0]?.id || ''}
                  organizationId="demo-org"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Legacy Stores List */}
      {!showSyncStoreMvp && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Daftar Toko</h2>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

        {stores.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Store className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Belum Ada Toko Terhubung</h3>
              <p className="text-muted-foreground text-center mb-4">
                Hubungkan toko pertama Anda untuk mulai sinkronisasi produk dan pesanan
              </p>
              <Button onClick={() => setIsConnectDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Hubungkan Toko Pertama
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {stores.map((store) => (
              <Card key={store.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getPlatformIcon(store.platform.name)}
                      <div>
                        <CardTitle className="text-lg">{store.name}</CardTitle>
                        <CardDescription>{store.platform.displayName}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(store.syncStatus)}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleSyncStore(store.id)}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Sinkronisasi Sekarang
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleHealthCheck(store.id)}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Tes Koneksi
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Settings className="h-4 w-4 mr-2" />
                            Pengaturan
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{store.stats.products}</div>
                        <div className="text-xs text-muted-foreground">Produk</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{store.stats.orders}</div>
                        <div className="text-xs text-muted-foreground">Pesanan</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-purple-600">
                          {formatCurrency(store.stats.revenue)}
                        </div>
                        <div className="text-xs text-muted-foreground">Revenue</div>
                      </div>
                    </div>

                    <Separator />

                    {/* Status Info */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(store.syncStatus)}
                        <span className="text-muted-foreground">
                          Sinkronisasi terakhir: {formatLastSync(store.lastSyncAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </div>
      )}

      {/* Store Connection Wizard */}
      {isConnectDialogOpen && (
        <StoreConnectionWizard
          organizationId="demo-org"
          onConnectionComplete={(connection) => {
            console.log('Store connected:', connection);
            setIsConnectDialogOpen(false);
            showConnectionNotification('connected', connection.storeId || 'new-store');
          }}
          onCancel={() => setIsConnectDialogOpen(false)}
        />
      )}

      {/* Legacy Connect Store Dialog */}
      <ConnectStoreDialog 
        open={false} // Disabled in favor of SyncStore MVP wizard
        onOpenChange={setIsConnectDialogOpen} 
      />
    </div>
  );
}

// Wrap with NotificationProvider
export default function StoresPage() {
  return (
    <NotificationProvider>
      <StoresPageContent />
    </NotificationProvider>
  );
}