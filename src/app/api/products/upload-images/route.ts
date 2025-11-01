import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ProductService } from '@/lib/services/product-service';

const productService = new ProductService();

// POST /api/products/upload-images - Upload product images
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const formData = await request.formData();
    
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key === 'images' && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_FILES',
            message: 'No files provided for upload',
          },
        },
        { status: 400 }
      );
    }

    const imageUrls = await productService.uploadProductImages(files);

    return NextResponse.json({
      success: true,
      data: {
        imageUrls,
      },
    });
  } catch (error) {
    console.error('Error uploading product images:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: error instanceof Error ? error.message : 'Failed to upload images',
        },
      },
      { status: 500 }
    );
  }
}