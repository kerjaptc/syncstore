import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ProductService } from '@/lib/services/product-service';

const productService = new ProductService();

// GET /api/products/categories - Get all categories for organization
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const categories = await productService.getCategories(user.organizationId);

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch categories',
        },
      },
      { status: 500 }
    );
  }
}