import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { masterProducts } from '@/lib/db/master-catalog-schema';
import { eq, and } from 'drizzle-orm';

// GET /api/master-products/[productId] - Get single master product
export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const user = await requireAuth();
    const { productId } = params;

    const product = await db
      .select()
      .from(masterProducts)
      .where(and(
        eq(masterProducts.id, productId),
        eq(masterProducts.organizationId, user.organizationId)
      ))
      .limit(1);

    if (product.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Product not found',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: product[0],
    });
  } catch (error) {
    console.error('Error fetching master product:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch product',
        },
      },
      { status: 500 }
    );
  }
}