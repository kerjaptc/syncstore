import { NextResponse } from 'next/server';
import { StorefrontService } from '@/lib/services/storefront-service';

const storefrontService = new StorefrontService();

export async function GET() {
  try {
    const brands = await storefrontService.getBrands();
    return NextResponse.json(brands);
  } catch (error) {
    console.error('Error fetching brands:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brands' },
      { status: 500 }
    );
  }
}