import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { InventoryService } from '@/lib/services/inventory-service';

const inventoryService = new InventoryService();

// GET /api/inventory/alerts - Get inventory alerts (low stock and out of stock)
export async function GET() {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const alerts = await inventoryService.getInventoryAlerts(orgId);
    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Error fetching inventory alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory alerts' },
      { status: 500 }
    );
  }
}