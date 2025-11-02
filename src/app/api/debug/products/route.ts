import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { masterProducts, platformMappings, organizations, users } from '@/lib/db/schema';
import { eq, and, count } from 'drizzle-orm';

// GET /api/debug/products - Debug products API
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Check organization
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1);

    // Count total products for this organization
    const [totalResult] = await db
      .select({ count: count() })
      .from(masterProducts)
      .where(eq(masterProducts.organizationId, user.organizationId));

    // Get first 5 products
    const products = await db
      .select()
      .from(masterProducts)
      .where(eq(masterProducts.organizationId, user.organizationId))
      .limit(5);

    // Count platform mappings
    const [mappingsCount] = await db
      .select({ count: count() })
      .from(platformMappings);

    return NextResponse.json({
      success: true,
      debug: {
        user: {
          id: user.id,
          email: user.email,
          organizationId: user.organizationId,
          role: user.role,
        },
        organization: org ? {
          id: org.id,
          name: org.name,
          slug: org.slug,
        } : null,
        products: {
          total: totalResult?.count || 0,
          sample: products.map(p => ({
            id: p.id,
            name: p.name,
            masterSku: p.masterSku,
            basePrice: p.basePrice,
            status: p.status,
          })),
        },
        platformMappings: {
          total: mappingsCount?.count || 0,
        },
      },
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DEBUG_FAILED',
          message: error instanceof Error ? error.message : 'Debug failed',
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
      { status: 500 }
    );
  }
}