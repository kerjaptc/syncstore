import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { products, productVariants, inventoryItems, inventoryLocations } from '@/lib/db/schema';
import { eq, and, ilike, or, desc, count, sql } from 'drizzle-orm';

/**
 * GET /api/products-phase4 - Get products with real data for Phase 4
 * 
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 50)
 * - search: string (optional, searches name and SKU)
 * - category: string (optional)
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
    
    // Parse query parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search') || undefined;
    const category = searchParams.get('category') || undefined;
    const offset = (page - 1) * limit;

    // Build query conditions
    const conditions = [eq(products.organizationId, orgId)];
    
    if (search) {
      conditions.push(
        or(
          ilike(products.name, `%${search}%`),
          ilike(products.sku, `%${search}%`)
        )!
      );
    }
    
    if (category) {
      conditions.push(eq(products.category, category));
    }

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(products)
      .where(and(...conditions));

    const total = totalResult?.count || 0;
    const totalPages = Math.ceil(total / limit);

    // Get products with variants and inventory
    const productsData = await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        description: products.description,
        category: products.category,
        brand: products.brand,
        costPrice: products.costPrice,
        weight: products.weight,
        dimensions: products.dimensions,
        images: products.images,
        attributes: products.attributes,
        isActive: products.isActive,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        variantId: productVariants.id,
        variantSku: productVariants.variantSku,
        variantName: productVariants.name,
        stock: sql<number>`COALESCE(SUM(${inventoryItems.quantityOnHand}), 0)`,
      })
      .from(products)
      .leftJoin(productVariants, eq(productVariants.productId, products.id))
      .leftJoin(inventoryItems, eq(inventoryItems.productVariantId, productVariants.id))
      .where(and(...conditions))
      .groupBy(
        products.id,
        products.sku,
        products.name,
        products.description,
        products.category,
        products.brand,
        products.costPrice,
        products.weight,
        products.dimensions,
        products.images,
        products.attributes,
        products.isActive,
        products.createdAt,
        products.updatedAt,
        productVariants.id,
        productVariants.variantSku,
        productVariants.name
      )
      .orderBy(desc(products.createdAt))
      .limit(limit)
      .offset(offset);

    // Transform data
    const productsMap = new Map();
    
    for (const row of productsData) {
      if (!productsMap.has(row.id)) {
        productsMap.set(row.id, {
          id: row.id,
          sku: row.sku,
          name: row.name,
          description: row.description,
          category: row.category,
          brand: row.brand,
          price: parseFloat(row.costPrice || '0'),
          stock: 0,
          images: row.images || [],
          syncStatus: 'pending' as const,
          lastSyncAt: null,
          createdAt: row.createdAt?.toISOString(),
          updatedAt: row.updatedAt?.toISOString(),
        });
      }
      
      // Accumulate stock from all variants
      const product = productsMap.get(row.id);
      product.stock += Number(row.stock) || 0;
    }

    const productsArray = Array.from(productsMap.values());

    const duration = Date.now() - startTime;
    
    // Log performance
    if (duration > 5000) {
      console.error(`[ERROR] GET /api/products-phase4 - Slow response: ${duration}ms`);
    } else if (duration > 1000) {
      console.warn(`[WARN] GET /api/products-phase4 - Response time: ${duration}ms`);
    }

    console.log(`[INFO] GET /api/products-phase4 - ${productsArray.length} products returned in ${duration}ms`);

    return NextResponse.json({
      success: true,
      data: productsArray,
      meta: {
        timestamp: new Date().toISOString(),
        executionTimeMs: duration,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ERROR] GET /api/products-phase4 FAILED (${duration}ms):`, error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch products',
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
