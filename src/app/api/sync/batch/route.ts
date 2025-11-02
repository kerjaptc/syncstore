import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { masterProducts, platformMappings, syncEvents } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';

const batchSyncRequestSchema = z.object({
  product_ids: z.array(z.string().uuid()).min(1).max(50), // Max 50 products per batch
  target: z.enum(['shopee']),
});

// POST /api/sync/batch - Batch sync multiple products
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const { product_ids, target } = batchSyncRequestSchema.parse(body);

    // Verify all products belong to user's organization
    const products = await db
      .select()
      .from(masterProducts)
      .where(
        and(
          inArray(masterProducts.id, product_ids),
          eq(masterProducts.organizationId, user.organizationId)
        )
      );

    if (products.length !== product_ids.length) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PRODUCTS_NOT_FOUND',
            message: 'Some products not found or access denied',
          },
        },
        { status: 404 }
      );
    }

    // Generate batch sync ID
    const batch_sync_id = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sync_operations: Array<{
      product_id: string;
      sync_id: string;
      product_name: string;
    }> = [];

    // Create sync operations for each product
    for (const product of products) {
      const sync_id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create sync event record
      await db.insert(syncEvents).values({
        syncId: sync_id,
        productId: product.id,
        status: 'running',
        events: [
          {
            timestamp: new Date().toISOString(),
            type: 'info',
            message: `Starting batch sync for product: ${product.name}`,
            details: { batch_id: batch_sync_id, target }
          }
        ],
      });

      // Update or create platform mapping
      const [existingMapping] = await db
        .select()
        .from(platformMappings)
        .where(
          and(
            eq(platformMappings.masterProductId, product.id),
            eq(platformMappings.platform, target)
          )
        )
        .limit(1);

      if (existingMapping) {
        await db
          .update(platformMappings)
          .set({
            syncStatus: 'syncing',
            syncErrors: [],
            updatedAt: new Date(),
          })
          .where(eq(platformMappings.id, existingMapping.id));
      } else {
        await db.insert(platformMappings).values({
          masterProductId: product.id,
          platform: target,
          platformProductId: `temp_${sync_id}`,
          syncStatus: 'syncing',
          isActive: true,
          platformPrice: (parseFloat(product.basePrice.toString()) * 1.15).toString(),
          syncErrors: [],
        });
      }

      sync_operations.push({
        product_id: product.id,
        sync_id,
        product_name: product.name,
      });
    }

    // Start batch sync process (async)
    setTimeout(async () => {
      await processBatchSync(sync_operations, target, batch_sync_id);
    }, 1000);

    return NextResponse.json({
      success: true,
      data: {
        batch_sync_id,
        total_products: product_ids.length,
        sync_operations: sync_operations.map(op => ({
          product_id: op.product_id,
          sync_id: op.sync_id,
        })),
        status: 'processing',
        message: `Started batch sync for ${product_ids.length} products`,
      },
    });
  } catch (error) {
    console.error('Error starting batch sync:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid batch sync request',
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
          code: 'BATCH_SYNC_FAILED',
          message: error instanceof Error ? error.message : 'Failed to start batch sync',
        },
      },
      { status: 500 }
    );
  }
}

// Process batch sync operations
async function processBatchSync(
  operations: Array<{ product_id: string; sync_id: string; product_name: string }>,
  target: string,
  batchId: string
) {
  for (const operation of operations) {
    try {
      await updateSyncEvents(operation.sync_id, 'running', `Processing ${operation.product_name}...`);
      await new Promise(resolve => setTimeout(resolve, 500));

      await updateSyncEvents(operation.sync_id, 'running', 'Validating product data...');
      await new Promise(resolve => setTimeout(resolve, 300));

      await updateSyncEvents(operation.sync_id, 'running', 'Uploading to Shopee...');
      await new Promise(resolve => setTimeout(resolve, 700));

      // Simulate success/failure (80% success rate)
      const shouldSucceed = Math.random() > 0.2;

      if (shouldSucceed) {
        await updateSyncEvents(operation.sync_id, 'success', '✓ Product successfully synced');
        await updateSyncStatus(operation.product_id, target, 'synced', null);
      } else {
        const errors = ['SHOPEE_RATE_LIMIT', 'INVALID_PRODUCT_DATA', 'CONNECTION_TIMEOUT'];
        const randomError = errors[Math.floor(Math.random() * errors.length)];
        await updateSyncEvents(operation.sync_id, 'error', `✗ Sync failed: ${randomError}`);
        await updateSyncStatus(operation.product_id, target, 'error', randomError);
      }

      // Small delay between products
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Batch sync failed for product ${operation.product_id}:`, error);
      await updateSyncEvents(operation.sync_id, 'error', `✗ Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      await updateSyncStatus(operation.product_id, target, 'error', error instanceof Error ? error.message : 'Unknown error');
    }
  }
}

// Helper functions (reused from individual sync)
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
    updateData.platformProductId = `shopee_${Date.now()}`;
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

async function updateSyncEvents(
  syncId: string,
  status: 'running' | 'success' | 'error',
  message: string
) {
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