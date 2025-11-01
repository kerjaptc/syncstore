'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Link2,
  Unlink,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { ProductWithVariants, StoreWithRelations } from '@/types';
import { toast } from 'sonner';

interface PlatformMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductWithVariants;
  stores: StoreWithRelations[];
}

interface PlatformMapping {
  id: string;
  storeId: string;
  productVariantId: string;
  platformProductId: string;
  platformVariantId?: string;
  platformSku?: string;
  price: number;
  compareAtPrice?: number;
  isActive: boolean;
  syncStatus: 'pending' | 'synced' | 'error';
  lastSyncAt?: Date;
}

export function PlatformMappingDialog({
  open,
  onOpenChange,
  product,
  stores,
}: PlatformMappingDialogProps) {
  const [mappings, setMappings] = useState<PlatformMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    if (open && product) {
      loadMappings();
    }
  }, [open, product]);

  const loadMappings = async () => {
    try {
      setLoading(true);
      // In a real implementation, you would fetch mappings from the API
      // For now, we'll simulate some data
      const mockMappings: PlatformMapping[] = [
        {
          id: '1',
          storeId: stores[0]?.id || '',
          productVariantId: product.variants[0]?.id || '',
          platformProductId: 'shopee_123456',
          platformVariantId: 'shopee_var_789',
          platformSku: 'SHOPEE-' + product.sku,
          price: 29.99,
          compareAtPrice: 39.99,
          isActive: true,
          syncStatus: 'synced',
          lastSyncAt: new Date(),
        },
      ];
      setMappings(mockMappings);
    } catch (error) {
      toast.error('Failed to load platform mappings');
    } finally {
      setLoading(false);
    }
  };

  const createMapping = async (storeId: string, variantId: string) => {
    try {
      setSyncing(storeId);
      
      // Simulate API call to create mapping
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newMapping: PlatformMapping = {
        id: Date.now().toString(),
        storeId,
        productVariantId: variantId,
        platformProductId: `platform_${Date.now()}`,
        platformSku: `${stores.find(s => s.id === storeId)?.platform.name.toUpperCase()}-${product.sku}`,
        price: parseFloat(product.costPrice || '0') * 1.5, // 50% markup
        isActive: true,
        syncStatus: 'synced',
        lastSyncAt: new Date(),
      };
      
      setMappings(prev => [...prev, newMapping]);
      toast.success('Product mapped to platform successfully');
    } catch (error) {
      toast.error('Failed to create platform mapping');
    } finally {
      setSyncing(null);
    }
  };

  const removeMapping = async (mappingId: string) => {
    try {
      // Simulate API call to remove mapping
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setMappings(prev => prev.filter(m => m.id !== mappingId));
      toast.success('Platform mapping removed');
    } catch (error) {
      toast.error('Failed to remove platform mapping');
    }
  };

  const syncMapping = async (mappingId: string) => {
    try {
      setSyncing(mappingId);
      
      // Simulate API call to sync mapping
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setMappings(prev => prev.map(m => 
        m.id === mappingId 
          ? { ...m, syncStatus: 'synced' as const, lastSyncAt: new Date() }
          : m
      ));
      toast.success('Platform mapping synced successfully');
    } catch (error) {
      toast.error('Failed to sync platform mapping');
      setMappings(prev => prev.map(m => 
        m.id === mappingId 
          ? { ...m, syncStatus: 'error' as const }
          : m
      ));
    } finally {
      setSyncing(null);
    }
  };

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSyncStatusText = (status: string) => {
    switch (status) {
      case 'synced':
        return 'Synced';
      case 'pending':
        return 'Pending';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Platform Mappings - {product.name}
          </DialogTitle>
          <DialogDescription>
            Manage how this product is mapped and synchronized across different platforms.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Product Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">SKU:</span> {product.sku}
                </div>
                <div>
                  <span className="font-medium">Variants:</span> {product._count.variants}
                </div>
                <div>
                  <span className="font-medium">Category:</span> {product.category || 'N/A'}
                </div>
                <div>
                  <span className="font-medium">Brand:</span> {product.brand || 'N/A'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Mappings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Platform Mappings</CardTitle>
              <CardDescription>
                Products currently mapped to your connected stores
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mappings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No platform mappings found</p>
                  <p className="text-sm">Map this product to your stores to start selling</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Platform ID</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Sync</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((mapping) => {
                      const store = stores.find(s => s.id === mapping.storeId);
                      return (
                        <TableRow key={mapping.id}>
                          <TableCell>
                            <Badge variant="outline">
                              {store?.platform.displayName || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>{store?.name || 'Unknown Store'}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {mapping.platformProductId}
                            </code>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">${mapping.price}</div>
                              {mapping.compareAtPrice && (
                                <div className="text-xs text-muted-foreground line-through">
                                  ${mapping.compareAtPrice}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getSyncStatusIcon(mapping.syncStatus)}
                              <span className="text-sm">
                                {getSyncStatusText(mapping.syncStatus)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {mapping.lastSyncAt ? (
                              <div className="text-xs text-muted-foreground">
                                {mapping.lastSyncAt.toLocaleDateString()}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Never</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => syncMapping(mapping.id)}
                                disabled={syncing === mapping.id}
                                title="Sync to platform"
                              >
                                <RefreshCw className={`h-4 w-4 ${syncing === mapping.id ? 'animate-spin' : ''}`} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeMapping(mapping.id)}
                                title="Remove mapping"
                              >
                                <Unlink className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Available Stores */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Available Stores</CardTitle>
              <CardDescription>
                Connect this product to your stores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stores.filter(store => 
                  !mappings.some(mapping => mapping.storeId === store.id)
                ).map((store) => (
                  <div key={store.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">
                        {store.platform.displayName}
                      </Badge>
                      <div>
                        <div className="font-medium">{store.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {store.platform.name}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => createMapping(store.id, product.variants[0]?.id)}
                      disabled={syncing === store.id}
                    >
                      {syncing === store.id ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Mapping...
                        </>
                      ) : (
                        <>
                          <Link2 className="h-4 w-4 mr-2" />
                          Map Product
                        </>
                      )}
                    </Button>
                  </div>
                ))}
                
                {stores.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <ExternalLink className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No stores connected</p>
                    <p className="text-sm">Connect stores first to map products</p>
                  </div>
                )}
                
                {stores.length > 0 && stores.every(store => 
                  mappings.some(mapping => mapping.storeId === store.id)
                ) && (
                  <div className="text-center py-4 text-muted-foreground">
                    <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-500" />
                    <p className="text-sm">Product is mapped to all connected stores</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}