'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Settings } from 'lucide-react';
import { InventoryOverview } from '@/components/inventory/inventory-overview';
import { InventoryDataTable } from '@/components/inventory/inventory-data-table';
import { InventoryAdjustmentDialog } from '@/components/inventory/inventory-adjustment-dialog';
import { StockAlertsDialog } from '@/components/inventory/stock-alerts-dialog';
import { StockHistoryDialog } from '@/components/inventory/stock-history-dialog';
import { LocationSelector } from '@/components/inventory/location-selector';
import { InventoryReports } from '@/components/inventory/inventory-reports';

interface InventoryItem {
  inventoryItem: {
    id: string;
    quantityOnHand: number;
    quantityReserved: number;
    reorderPoint: number;
    reorderQuantity: number;
    updatedAt: string;
  };
  productVariant: {
    id: string;
    variantSku: string;
    name: string;
    costPrice: string | null;
  };
  product: {
    id: string;
    sku: string;
    name: string;
  };
  availableQuantity: number;
}

export default function InventoryPage() {
  const [selectedLocation, setSelectedLocation] = useState<string | undefined>();
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [alertsDialogOpen, setAlertsDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [historyProductVariantId, setHistoryProductVariantId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleEditItem = (item: InventoryItem) => {
    setSelectedItem(item);
    setAdjustmentDialogOpen(true);
  };

  const handleViewHistory = (productVariantId: string, locationId: string) => {
    setHistoryProductVariantId(productVariantId);
    setHistoryDialogOpen(true);
  };

  const handleAdjustmentSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleShowAlerts = () => {
    setAlertsDialogOpen(true);
  };

  const handleAlertsEditItem = (item: any) => {
    setSelectedItem(item);
    setAlertsDialogOpen(false);
    setAdjustmentDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">
            Manage stock levels and monitor inventory across all locations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setAlertsDialogOpen(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            View Alerts
          </Button>
          <Button
            onClick={() => {
              setSelectedItem(null);
              setAdjustmentDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adjust Stock
          </Button>
        </div>
      </div>

      {/* Inventory Overview */}
      <InventoryOverview
        key={refreshTrigger}
        onLocationSelect={(locationId) => setSelectedLocation(locationId || undefined)}
        onShowAlerts={handleShowAlerts}
      />

      {/* Location Filter */}
      <div className="flex items-center justify-between">
        <LocationSelector
          value={selectedLocation}
          onValueChange={setSelectedLocation}
          placeholder="Filter by location"
        />
      </div>

      {/* Inventory Data Table */}
      <InventoryDataTable
        key={`${selectedLocation}-${refreshTrigger}`}
        locationId={selectedLocation}
        onEditItem={handleEditItem}
        onViewHistory={handleViewHistory}
      />

      {/* Inventory Reports */}
      <InventoryReports />

      {/* Dialogs */}
      <InventoryAdjustmentDialog
        open={adjustmentDialogOpen}
        onOpenChange={setAdjustmentDialogOpen}
        item={selectedItem}
        locationId={selectedLocation || ''}
        onSuccess={handleAdjustmentSuccess}
      />

      <StockAlertsDialog
        open={alertsDialogOpen}
        onOpenChange={setAlertsDialogOpen}
        onEditItem={handleAlertsEditItem}
      />

      <StockHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        productVariantId={historyProductVariantId}
        locationId={selectedLocation || null}
        productName={selectedItem?.product.name}
        variantName={selectedItem?.productVariant.name}
      />
    </div>
  );
}