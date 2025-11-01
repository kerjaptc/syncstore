import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ProductService } from '@/lib/services/product-service';

const productService = new ProductService();

// GET /api/products/brands - Get all brands for organization
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const brands = await productService.getBrands(user.organizationId);

    return NextResponse.json({
      success: true,
      data: brands,
    });
  } catch (error) {
    console.error('Error fetching brands:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch brands',
        },
      },
      { status: 500 }
    );
  }
}