import { NextRequest, NextResponse } from 'next/server';
import { StorefrontService } from '@/lib/services/storefront-service';

const storefrontService = new StorefrontService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const productId = searchParams.get('productId');
    const category = searchParams.get('category') || undefined;
    const limit = parseInt(searchParams.get('limit') || '4');

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const products = await storefrontService.getRelatedProducts(productId, category, limit);
    
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching related products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch related products' },
      { status: 500 }
    );
  }
}