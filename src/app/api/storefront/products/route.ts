import { NextRequest, NextResponse } from 'next/server';
import { StorefrontService } from '@/lib/services/storefront-service';

const storefrontService = new StorefrontService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const params = {
      search: searchParams.get('search') || undefined,
      category: searchParams.get('category') || undefined,
      brand: searchParams.get('brand') || undefined,
      minPrice: searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined,
      maxPrice: searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      sortBy: searchParams.get('sort')?.split('-')[0] as any,
      sortOrder: searchParams.get('sort')?.split('-')[1] as any,
    };

    const result = await storefrontService.getProducts(params);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching storefront products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}