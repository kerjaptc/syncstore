import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { masterProducts, platformMappings } from '@/lib/db/schema';
import { eq, and, ilike, desc, asc, count } from 'drizzle-orm';
import { z } from 'zod';

// GET /api/products - Get products for Phase 3 sync dashboard
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50); // Max 50 per page
    const offset = (page - 1) * limit;

    // Build base query conditions
    const conditions = [eq(masterProducts.organizationId, user.organizationId)];
    
    if (search) {
      conditions.push(ilike(masterProducts.name, `%${search}%`));
    }

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(masterProducts)
      .where(and(...conditions));

    const total = totalResult?.count || 0;

    console.log('Products API - User org:', user.organizationId);
    console.log('Products API - Search conditions:', conditions);
    console.log('Products API - Total products found:', total);

    // Get products with sync status from platform mappings
    const productsQuery = db
      .select({
        id: masterProducts.id,
        title: masterProducts.name,
        base_price: masterProducts.basePrice,
        shopee_price: masterProducts.platformPrices,
        status: platformMappings.syncStatus,
        last_synced_at: platformMappings.lastSyncAt,
        last_sync_error: platformMappings.syncErrors,
      })
      .from(masterProducts)
      .leftJoin(
        platformMappings,
        and(
          eq(platformMappings.masterProductId, masterProducts.id),
          eq(platformMappings.platform, 'shopee')
        )
      )
      .where(and(...conditions))
      .orderBy(desc(masterProducts.updatedAt))
      .limit(limit)
      .offset(offset);

    const rawProducts = await productsQuery;
    console.log('Products API - Raw products count:', rawProducts.length);
    console.log('Products API - First product:', rawProducts[0]);

    // Transform data to match Phase 3 requirements
    const products = rawProducts.map(product => {
      const basePrice = parseFloat(product.base_price?.toString() || '0');
      const shopeePrice = basePrice * 1.15; // Phase 3 pricing rule
      
      // Extract sync error message if exists
      let lastSyncError = null;
      if (product.last_sync_error && Array.isArray(product.last_sync_error) && product.last_sync_error.length > 0) {
        lastSyncError = product.last_sync_error[0]?.message || 'Sync failed';
      }

      return {
        id: product.id,
        title: product.title,
        base_price: basePrice,
        shopee_price: shopeePrice,
        status: (product.status as 'pending' | 'syncing' | 'synced' | 'error') || 'pending',
        last_synced_at: product.last_synced_at?.toISOString() || null,
        last_sync_error: lastSyncError,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        products,
        total,
        page,
        limit,
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch products',
        },
      },
      { status: 500 }
    );
  }
}

