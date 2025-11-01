'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { StoreList } from '@/components/stores/store-list';
import { StoreConnectionWizard } from '@/components/stores/store-connection-wizard';

export function StoreManagement() {
  const [showConnectionWizard, setShowConnectionWizard] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stores</h1>
          <p className="text-muted-foreground">
            Manage your connected marketplace stores
          </p>
        </div>
        <Button onClick={() => setShowConnectionWizard(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Connect Store
        </Button>
      </div>

      <StoreList />

      <StoreConnectionWizard 
        open={showConnectionWizard}
        onOpenChange={setShowConnectionWizard}
      />
    </div>
  );
}