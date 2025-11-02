import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { masterProducts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/test/simple-products - Get simple product list for testing
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const products = await db
      .select({
        id: masterProducts.id,
        name: masterProducts.name,
        masterSku: masterProducts.masterSku,
        basePrice: masterProducts.basePrice,
        status: masterProducts.status,
      })
      .from(masterProducts)
      .where(eq(masterProducts.organizationId, user.organizationId))
      .limit(10);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          organizationId: user.organizationId,
        },
        products,
        count: products.length,
      },
    });
  } catch (error) {
    console.error('Simple products error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to fetch products',
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
      { status: 500 }
    );
  }
}

// POST /api/test/simple-products - Add multiple test products for dashboard testing
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Check if products already exist
    const existingProducts = await db
      .select()
      .from(masterProducts)
      .where(eq(masterProducts.organizationId, user.organizationId))
      .limit(1);

    if (existingProducts.length > 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: 'Test products already exist',
          count: existingProducts.length,
        },
      });
    }

    const testProducts = [
      {
        organizationId: user.organizationId,
        masterSku: 'TEST-001',
        name: 'Samsung Galaxy A54 5G',
        description: 'Smartphone Android dengan kamera 50MP dan layar Super AMOLED 6.4 inch',
        weight: '0.202',
        dimensions: { length: 158.2, width: 76.7, height: 8.2, unit: 'mm' },
        images: [],
        category: { id: 'electronics', name: 'Electronics' },
        brand: 'Samsung',
        basePrice: '4500000',
        currency: 'IDR',
        platformPrices: {},
        hasVariants: false,
        seoData: {},
        tags: ['smartphone', 'samsung'],
        totalStock: 25,
        reservedStock: 0,
        availableStock: 25,
        dataQualityScore: 95,
        validationErrors: [],
        validationWarnings: [],
        status: 'active',
        importSource: 'manual',
        createdBy: user.id,
        updatedBy: user.id,
      },
      {
        organizationId: user.organizationId,
        masterSku: 'TEST-002',
        name: 'ASUS VivoBook 14',
        description: 'Laptop ringan dengan processor Intel Core i5, RAM 8GB, SSD 512GB',
        weight: '1.4',
        dimensions: { length: 324, width: 213, height: 19.9, unit: 'mm' },
        images: [],
        category: { id: 'computers', name: 'Computers' },
        brand: 'ASUS',
        basePrice: '8500000',
        currency: 'IDR',
        platformPrices: {},
        hasVariants: false,
        seoData: {},
        tags: ['laptop', 'asus'],
        totalStock: 15,
        reservedStock: 0,
        availableStock: 15,
        dataQualityScore: 88,
        validationErrors: [],
        validationWarnings: [],
        status: 'active',
        importSource: 'manual',
        createdBy: user.id,
        updatedBy: user.id,
      },
      {
        organizationId: user.organizationId,
        masterSku: 'TEST-003',
        name: 'Sony WH-1000XM4',
        description: 'Headphone wireless dengan Active Noise Cancelling terbaik di kelasnya',
        weight: '0.254',
        dimensions: { length: 254, width: 203, height: 76, unit: 'mm' },
        images: [],
        category: { id: 'audio', name: 'Audio' },
        brand: 'Sony',
        basePrice: '4200000',
        currency: 'IDR',
        platformPrices: {},
        hasVariants: false,
        seoData: {},
        tags: ['headphone', 'sony'],
        totalStock: 30,
        reservedStock: 0,
        availableStock: 30,
        dataQualityScore: 92,
        validationErrors: [],
        validationWarnings: [],
        status: 'active',
        importSource: 'manual',
        createdBy: user.id,
        updatedBy: user.id,
      },
      {
        organizationId: user.organizationId,
        masterSku: 'TEST-004',
        name: 'Apple Watch Series 9',
        description: 'Smartwatch terbaru dari Apple dengan chip S9 dan Always-On Retina display',
        weight: '0.038',
        dimensions: { length: 45, width: 38, height: 10.7, unit: 'mm' },
        images: [],
        category: { id: 'wearables', name: 'Wearables' },
        brand: 'Apple',
        basePrice: '5500000',
        currency: 'IDR',
        platformPrices: {},
        hasVariants: false,
        seoData: {},
        tags: ['smartwatch', 'apple'],
        totalStock: 20,
        reservedStock: 0,
        availableStock: 20,
        dataQualityScore: 98,
        validationErrors: [],
        validationWarnings: [],
        status: 'active',
        importSource: 'manual',
        createdBy: user.id,
        updatedBy: user.id,
      },
      {
        organizationId: user.organizationId,
        masterSku: 'TEST-005',
        name: 'Logitech G Pro X Superlight',
        description: 'Gaming mouse ultra-ringan dengan sensor HERO 25K untuk pro gaming',
        weight: '0.063',
        dimensions: { length: 125, width: 63.5, height: 40, unit: 'mm' },
        images: [],
        category: { id: 'gaming', name: 'Gaming' },
        brand: 'Logitech',
        basePrice: '1800000',
        currency: 'IDR',
        platformPrices: {},
        hasVariants: false,
        seoData: {},
        tags: ['gaming', 'mouse'],
        totalStock: 40,
        reservedStock: 0,
        availableStock: 40,
        dataQualityScore: 90,
        validationErrors: [],
        validationWarnings: [],
        status: 'active',
        importSource: 'manual',
        createdBy: user.id,
        updatedBy: user.id,
      }
    ];

    const insertedProducts = [];
    for (const product of testProducts) {
      try {
        const [inserted] = await db.insert(masterProducts).values(product).returning();
        insertedProducts.push(inserted);
      } catch (error) {
        console.log(`Product ${product.masterSku} might already exist, skipping...`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `Added ${insertedProducts.length} test products successfully`,
        products: insertedProducts.map(p => ({
          id: p.id,
          name: p.name,
          masterSku: p.masterSku,
          basePrice: p.basePrice,
        })),
      },
    });
  } catch (error) {
    console.error('Add test products error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to add test products',
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
      { status: 500 }
    );
  }
}