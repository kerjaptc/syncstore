import { NextResponse } from 'next/server';
import { StorefrontService } from '@/lib/services/storefront-service';

const storefrontService = new StorefrontService();

export async function GET() {
  try {
    const categories = await storefrontService.getCategories();
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}