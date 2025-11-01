import { NextResponse } from 'next/server';
import { StorefrontService } from '@/lib/services/storefront-service';

const storefrontService = new StorefrontService();

export async function GET() {
  try {
    const products = await storefrontService.getFeaturedProducts(8);
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching featured products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch featured products' },
      { status: 500 }
    );
  }
}