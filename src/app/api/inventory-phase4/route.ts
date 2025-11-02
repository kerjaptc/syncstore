import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { inventoryItems, productVariants, products, inventoryLocations } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

/**
 * GET /api/inventory-phase4 - Get inventory data with real-time stock levels
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { userId, orgId } = await auth();
    
    if (!userId || !orgId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('locationId') || undefined;
    const productId = searchParams.get('productId') || undefined;
    const lowStockOnly = searchParams.get('lowStockOnly') === 'true';

    // Build query conditions
    const conditions = [];
    
    if (locationId) {
      conditions.push(eq(inventoryItems.locationId, locationId));
    }
    
    if (productId) {
      conditions.push(
        eq(productVariants.productId, productId)
      );
    }

    // Get inventory with product details
    const inventoryData = await db
      .select({
        id: inventoryItems.id,
        productVariantId: inventoryItems.productVariantId,
        locationId: inventoryItems.locationId,
        quantityOnHand: inventoryItems.quantityOnHand,
        quantityReserved: inventoryItems.quantityReserved,
        reorderPoint: inventoryItems.reorderPoint,
        reorderQuantity: inventoryItems.reorderQuantity,
        updatedAt: inventoryItems.updatedAt,
        productId: products.id,
        productName: products.name,
        productSku: products.sku,
        variantSku: productVariants.variantSku,
        variantName: productVariants.name,
        locationName: inventoryLocations.name,
      })
      .from(inventoryItems)
      .innerJoin(productVariants, eq(productVariants.id, inventoryItems.productVariantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .innerJoin(inventoryLocations, eq(inventoryLocations.id, inventoryItems.locationId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(inventoryItems.updatedAt));

    // Filter low stock if requested
    let filteredData = inventoryData;
    if (lowStockOnly) {
      filteredData = inventoryData.filter(
        item => item.quantityOnHand <= (item.reorderPoint || 0)
      );
    }

    // Calculate summary
    const totalItems = filteredData.length;
    const lowStockItems = filteredData.filter(
      item => item.quantityOnHand <= (item.reorderPoint || 0)
    ).length;
    const outOfStockItems = filteredData.filter(
      item => item.quantityOnHand === 0
    ).length;

    // Transform data
    const inventory = filteredData.map(item => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      productSku: item.productSku,
      variantSku: item.variantSku,
      variantName: item.variantName,
      locationId: item.locationId,
      locationName: item.locationName,
      stock: item.quantityOnHand,
      reserved: item.quantityReserved,
      available: item.quantityOnHand - item.quantityReserved,
      reorderPoint: item.reorderPoint,
      reorderQuantity: item.reorderQuantity,
      isLowStock: item.quantityOnHand <= (item.reorderPoint || 0),
      lastUpdatedAt: item.updatedAt?.toISOString() || null,
    }));

    const duration = Date.now() - startTime;
    
    // Log performance
    if (duration > 5000) {
      console.error(`[ERROR] GET /api/inventory-phase4 - Slow response: ${duration}ms`);
    } else if (duration > 1000) {
      console.warn(`[WARN] GET /api/inventory-phase4 - Response time: ${duration}ms`);
    }

    console.log(`[INFO] GET /api/inventory-phase4 - ${inventory.length} items returned in ${duration}ms`);

    return NextResponse.json({
      success: true,
      data: inventory,
      summary: {
        totalItems,
        lowStockItems,
        outOfStockItems,
      },
      meta: {
        timestamp: new Date().toISOString(),
        executionTimeMs: duration,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ERROR] GET /api/inventory-phase4 FAILED (${duration}ms):`, error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch inventory',
        },
        meta: {
          timestamp: new Date().toISOString(),
          executionTimeMs: duration,
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/inventory-phase4 - Update inventory levels (batch update)
 */
const updateInventorySchema = z.object({
  productVariantId: z.string(),
  locationId: z.string(),
  quantityChange: z.number(),
  notes: z.string().optional(),
});

const batchUpdateSchema = z.object({
  updates: z.array(updateInventorySchema),
});

export async function PUT(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { userId, orgId } = await auth();
    
    if (!userId || !orgId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { updates } = batchUpdateSchema.parse(body);

    // Validate stock changes (must be non-negative result)
    for (const update of updates) {
      const [currentInventory] = await db
        .select({ quantityOnHand: inventoryItems.quantityOnHand })
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.productVariantId, update.productVariantId),
            eq(inventoryItems.locationId, update.locationId)
          )
        )
        .limit(1);

      if (!currentInventory) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Inventory item not found for variant ${update.productVariantId}`,
            },
          },
          { status: 404 }
        );
      }

      const newQuantity = currentInventory.quantityOnHand + update.quantityChange;
      if (newQuantity < 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_QUANTITY',
              message: `Stock cannot be negative. Current: ${currentInventory.quantityOnHand}, Change: ${update.quantityChange}`,
            },
          },
          { status: 400 }
        );
      }
    }

    // Perform atomic updates
    let successCount = 0;
    const results = [];

    for (const update of updates) {
      const [currentInventory] = await db
        .select()
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.productVariantId, update.productVariantId),
            eq(inventoryItems.locationId, update.locationId)
          )
        )
        .limit(1);

      const beforeQuantity = currentInventory.quantityOnHand;
      const newQuantity = beforeQuantity + update.quantityChange;

      await db
        .update(inventoryItems)
        .set({
          quantityOnHand: newQuantity,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(inventoryItems.productVariantId, update.productVariantId),
            eq(inventoryItems.locationId, update.locationId)
          )
        );

      successCount++;
      
      console.log(
        `[INFO] Inventory updated - Variant: ${update.productVariantId}, ` +
        `Before: ${beforeQuantity}, Change: ${update.quantityChange}, After: ${newQuantity}`
      );

      results.push({
        productVariantId: update.productVariantId,
        locationId: update.locationId,
        beforeQuantity,
        afterQuantity: newQuantity,
        change: update.quantityChange,
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[INFO] PUT /api/inventory-phase4 - ${successCount} updates completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      data: {
        totalUpdates: updates.length,
        successCount,
        results,
      },
      meta: {
        timestamp: new Date().toISOString(),
        executionTimeMs: duration,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ERROR] PUT /api/inventory-phase4 FAILED (${duration}ms):`, error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
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
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update inventory',
        },
        meta: {
          timestamp: new Date().toISOString(),
          executionTimeMs: duration,
        },
      },
      { status: 500 }
    );
  }
}
