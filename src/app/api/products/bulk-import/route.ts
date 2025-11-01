import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ProductService } from '@/lib/services/product-service';
import { z } from 'zod';

const productService = new ProductService();

// POST /api/products/bulk-import - Bulk import products
const bulkImportSchema = z.object({
  products: z.array(z.object({
    sku: z.string().optional(),
    name: z.string().min(1, 'Product name is required'),
    description: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    costPrice: z.number().positive().optional(),
    weight: z.number().positive().optional(),
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
  })),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const validatedData = bulkImportSchema.parse(body);

    const result = await productService.bulkImportProducts(
      user.organizationId,
      validatedData.products
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error bulk importing products:', error);
    
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
          code: 'IMPORT_FAILED',
          message: error instanceof Error ? error.message : 'Failed to import products',
        },
      },
      { status: 500 }
    );
  }
}