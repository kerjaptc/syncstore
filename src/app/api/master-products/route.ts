import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { masterProducts } from '@/lib/db/master-catalog-schema';
import { eq, and, desc, count, ilike, or } from 'drizzle-orm';

// GET /api/master-products - Get master products with pagination and search
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 50); // Max 50 per page as per Phase 2 requirements

    // Build where conditions
    const conditions = [eq(masterProducts.organizationId, user.organizationId)];

    if (search) {
      conditions.push(
        or(
          ilike(masterProducts.name, `%${search}%`),
          ilike(masterProducts.masterSku, `%${search}%`),
          ilike(masterProducts.description, `%${search}%`),
          ilike(masterProducts.brand, `%${search}%`)
        )!
      );
    }

    // Get products with pagination
    const offset = (page - 1) * limit;
    const products = await db
      .select()
      .from(masterProducts)
      .where(and(...conditions))
      .orderBy(desc(masterProducts.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(masterProducts)
      .where(and(...conditions));

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        data: products,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching master products:', error);
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