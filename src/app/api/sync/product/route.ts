import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { masterProducts, platformMappings, syncEvents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const syncRequestSchema = z.object({
  product_id: z.string().uuid(),
  target: z.enum(['shopee']),
});

// POST /api/sync/product - Sync individual product to platform
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const { product_id, target } = syncRequestSchema.parse(body);

    // Verify product belongs to user's organization
    const [product] = await db
      .select()
      .from(masterProducts)
      .where(
        and(
          eq(masterProducts.id, product_id),
          eq(masterProducts.organizationId, user.organizationId)
        )
      )
      .limit(1);

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Product not found or access denied',
          },
        },
        { status: 404 }
      );
    }

    // Generate sync ID
    const sync_id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create sync event record for tracking
    await db.insert(syncEvents).values({
      syncId: sync_id,
      productId: product_id,
      status: 'running',
      events: [
        {
          timestamp: new Date().toISOString(),
          type: 'info',
          message: 'Starting sync process...',
          details: { target, product_name: product.name }
        }
      ],
    });

    // Check if platform mapping exists
    const [existingMapping] = await db
      .select()
      .from(platformMappings)
      .where(
        and(
          eq(platformMappings.masterProductId, product_id),
          eq(platformMappings.platform, target)
        )
      )
      .limit(1);

    if (existingMapping) {
      // Update existing mapping to syncing status
      await db
        .update(platformMappings)
        .set({
          syncStatus: 'syncing',
          syncErrors: [],
          updatedAt: new Date(),
        })
        .where(eq(platformMappings.id, existingMapping.id));
    } else {
      // Create new platform mapping
      await db.insert(platformMappings).values({
        masterProductId: product_id,
        platform: target,
        platformProductId: `temp_${sync_id}`, // Will be updated after actual sync
        syncStatus: 'syncing',
        isActive: true,
        platformPrice: (parseFloat(product.basePrice.toString()) * 1.15).toString(), // Shopee pricing
        syncErrors: [],
      });
    }

    // Simulate sync process (in real implementation, this would be async)
    setTimeout(async () => {
      try {
        // Simulate API call to Shopee
        await simulateShopeeSync(product_id, target, sync_id);
      } catch (error) {
        console.error('Sync failed:', error);
        // Update status to error
        await updateSyncStatus(product_id, target, 'error', error instanceof Error ? error.message : 'Sync failed');
        await updateSyncEvents(sync_id, 'error', 'Sync failed with error: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }, 2000); // 2 second delay to simulate processing

    return NextResponse.json({
      success: true,
      data: {
        sync_id,
        status: 'processing',
        message: 'Syncing product to Shopee...',
      },
    });
  } catch (error) {
    console.error('Error starting sync:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid sync request',
            details: error.errors,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SYNC_FAILED',
          message: error instanceof Error ? error.message : 'Failed to start sync',
        },
      },
      { status: 500 }
    );
  }
}

// Simulate Shopee sync process
async function simulateShopeeSync(productId: string, target: string, syncId: string) {
  // Add progress events
  await updateSyncEvents(syncId, 'running', 'Fetching product data from master catalog...');
  await new Promise(resolve => setTimeout(resolve, 500));

  await updateSyncEvents(syncId, 'running', 'Validating product information...');
  await new Promise(resolve => setTimeout(resolve, 500));

  await updateSyncEvents(syncId, 'running', 'Connecting to Shopee API...');
  await new Promise(resolve => setTimeout(resolve, 500));

  // Simulate random success/failure for testing
  const shouldSucceed = Math.random() > 0.2; // 80% success rate

  if (shouldSucceed) {
    await updateSyncEvents(syncId, 'running', 'Uploading product to Shopee...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await updateSyncEvents(syncId, 'success', '✓ Product successfully synced to Shopee');
    await updateSyncStatus(productId, target, 'synced', null);
    await updateSyncEvents(syncId, 'success', 'Sync completed successfully');
  } else {
    // Simulate failure with realistic error codes
    const errors = [
      'SHOPEE_RATE_LIMIT',
      'INVALID_PRODUCT_DATA', 
      'CONNECTION_TIMEOUT',
      'PRODUCT_ALREADY_EXISTS',
      'INSUFFICIENT_PERMISSIONS',
    ];
    const randomError = errors[Math.floor(Math.random() * errors.length)];
    await updateSyncEvents(syncId, 'error', `✗ Sync failed: ${randomError}`);
    await updateSyncStatus(productId, target, 'error', randomError);
  }
}

// Update sync status in database
async function updateSyncStatus(
  productId: string, 
  platform: string, 
  status: 'synced' | 'error', 
  errorMessage: string | null
) {
  const updateData: any = {
    syncStatus: status,
    updatedAt: new Date(),
  };

  if (status === 'synced') {
    updateData.lastSyncAt = new Date();
    updateData.syncErrors = [];
    updateData.platformProductId = `shopee_${Date.now()}`; // Simulate real platform ID
  } else if (status === 'error' && errorMessage) {
    updateData.syncErrors = [{ message: errorMessage, timestamp: new Date().toISOString() }];
  }

  await db
    .update(platformMappings)
    .set(updateData)
    .where(
      and(
        eq(platformMappings.masterProductId, productId),
        eq(platformMappings.platform, platform)
      )
    );
}

// Update sync events for real-time tracking
async function updateSyncEvents(
  syncId: string,
  status: 'running' | 'success' | 'error',
  message: string
) {
  // Get current sync event
  const [currentEvent] = await db
    .select()
    .from(syncEvents)
    .where(eq(syncEvents.syncId, syncId))
    .limit(1);

  if (currentEvent) {
    const currentEvents = Array.isArray(currentEvent.events) ? currentEvent.events : [];
    const newEvent = {
      timestamp: new Date().toISOString(),
      type: status === 'error' ? 'error' : status === 'success' ? 'success' : 'info',
      message,
    };

    const updateData: any = {
      events: [...currentEvents, newEvent],
      updatedAt: new Date(),
    };

    if (status !== 'running') {
      updateData.status = status;
      updateData.completedAt = new Date();
    }

    await db
      .update(syncEvents)
      .set(updateData)
      .where(eq(syncEvents.syncId, syncId));
  }
}