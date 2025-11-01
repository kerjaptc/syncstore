import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ProductService } from '@/lib/services/product-service';
import { z } from 'zod';

const productService = new ProductService();

// GET /api/products - Search products with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search') || undefined;
    const category = searchParams.get('category') || undefined;
    const brand = searchParams.get('brand') || undefined;
    const isActive = searchParams.get('isActive') ? searchParams.get('isActive') === 'true' : undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = (searchParams.get('sortBy') as 'name' | 'sku' | 'createdAt' | 'updatedAt') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

    const result = await productService.searchProducts(user.organizationId, {
      search,
      category,
      brand,
      isActive,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error searching products:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to search products',
        },
      },
      { status: 500 }
    );
  }
}

// POST /api/products - Create new product
const createProductSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  costPrice: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  dimensions: z.object({
    length: z.number().positive().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
  }).optional(),
  images: z.array(z.string().url()).optional(),
  attributes: z.record(z.any()).optional(),
  variants: z.array(z.object({
    variantSku: z.string().optional(),
    name: z.string().min(1, 'Variant name is required'),
    attributes: z.record(z.any()).optional(),
    costPrice: z.number().positive().optional(),
    weight: z.number().positive().optional(),
    images: z.array(z.string().url()).optional(),
  })).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const validatedData = createProductSchema.parse(body);

    const product = await productService.createProduct({
      organizationId: user.organizationId,
      ...validatedData,
    });

    return NextResponse.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Error creating product:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid product data',
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
          code: 'CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to create product',
        },
      },
      { status: 500 }
    );
  }
}