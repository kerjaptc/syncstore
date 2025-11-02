import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { masterProducts } from '@/lib/db/schema';

// POST /api/test/add-products - Add test products for development
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const testProducts = [
      {
        organizationId: user.organizationId,
        masterSku: 'TST-001',
        name: 'Smartphone Samsung Galaxy A54',
        description: 'Smartphone Android terbaru dengan kamera 50MP dan layar Super AMOLED 6.4 inch',
        weight: '0.202',
        dimensions: { length: 158.2, width: 76.7, height: 8.2, unit: 'mm' },
        images: [
          { url: 'https://example.com/samsung-a54-1.jpg', alt: 'Samsung Galaxy A54 Front' },
          { url: 'https://example.com/samsung-a54-2.jpg', alt: 'Samsung Galaxy A54 Back' }
        ],
        category: { id: 'electronics', name: 'Electronics', path: 'electronics' },
        brand: 'Samsung',
        basePrice: '4500000',
        currency: 'IDR',
        costPrice: '4000000',
        platformPrices: { shopee: 5175000, tiktok: 5400000 },
        hasVariants: false,
        seoData: { title: 'Samsung Galaxy A54 - Smartphone Terbaru', description: 'Beli Samsung Galaxy A54 dengan harga terbaik' },
        tags: ['smartphone', 'samsung', 'android', 'camera'],
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
        masterSku: 'TST-002',
        name: 'Laptop ASUS VivoBook 14',
        description: 'Laptop ringan dengan processor Intel Core i5, RAM 8GB, SSD 512GB untuk produktivitas sehari-hari',
        weight: '1.4',
        dimensions: { length: 324, width: 213, height: 19.9, unit: 'mm' },
        images: [
          { url: 'https://example.com/asus-vivobook-1.jpg', alt: 'ASUS VivoBook 14 Open' },
          { url: 'https://example.com/asus-vivobook-2.jpg', alt: 'ASUS VivoBook 14 Closed' }
        ],
        category: { id: 'computers', name: 'Computers & Laptops', path: 'computers' },
        brand: 'ASUS',
        basePrice: '8500000',
        currency: 'IDR',
        costPrice: '7500000',
        platformPrices: { shopee: 9775000, tiktok: 10200000 },
        hasVariants: true,
        seoData: { title: 'ASUS VivoBook 14 - Laptop Produktivitas', description: 'Laptop ASUS VivoBook 14 untuk kerja dan belajar' },
        tags: ['laptop', 'asus', 'productivity', 'intel'],
        totalStock: 15,
        reservedStock: 2,
        availableStock: 13,
        dataQualityScore: 88,
        validationErrors: [],
        validationWarnings: ['Missing detailed specifications'],
        status: 'active',
        importSource: 'manual',
        createdBy: user.id,
        updatedBy: user.id,
      },
      {
        organizationId: user.organizationId,
        masterSku: 'TST-003',
        name: 'Headphone Sony WH-1000XM4',
        description: 'Headphone wireless dengan Active Noise Cancelling terbaik di kelasnya, battery life 30 jam',
        weight: '0.254',
        dimensions: { length: 254, width: 203, height: 76, unit: 'mm' },
        images: [
          { url: 'https://example.com/sony-wh1000xm4-1.jpg', alt: 'Sony WH-1000XM4 Black' },
          { url: 'https://example.com/sony-wh1000xm4-2.jpg', alt: 'Sony WH-1000XM4 Folded' }
        ],
        category: { id: 'audio', name: 'Audio & Headphones', path: 'audio' },
        brand: 'Sony',
        basePrice: '4200000',
        currency: 'IDR',
        costPrice: '3800000',
        platformPrices: { shopee: 4830000, tiktok: 5040000 },
        hasVariants: false,
        seoData: { title: 'Sony WH-1000XM4 - Headphone Noise Cancelling', description: 'Headphone premium Sony dengan teknologi ANC terdepan' },
        tags: ['headphone', 'sony', 'wireless', 'noise-cancelling'],
        totalStock: 30,
        reservedStock: 5,
        availableStock: 25,
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
        masterSku: 'TST-004',
        name: 'Smartwatch Apple Watch Series 9',
        description: 'Smartwatch terbaru dari Apple dengan chip S9, Always-On Retina display, dan fitur kesehatan lengkap',
        weight: '0.038',
        dimensions: { length: 45, width: 38, height: 10.7, unit: 'mm' },
        images: [
          { url: 'https://example.com/apple-watch-s9-1.jpg', alt: 'Apple Watch Series 9 Pink' },
          { url: 'https://example.com/apple-watch-s9-2.jpg', alt: 'Apple Watch Series 9 Interface' }
        ],
        category: { id: 'wearables', name: 'Wearables & Smartwatch', path: 'wearables' },
        brand: 'Apple',
        basePrice: '5500000',
        currency: 'IDR',
        costPrice: '5000000',
        platformPrices: { shopee: 6325000, tiktok: 6600000 },
        hasVariants: true,
        seoData: { title: 'Apple Watch Series 9 - Smartwatch Terdepan', description: 'Apple Watch Series 9 dengan fitur terbaru dan performa optimal' },
        tags: ['smartwatch', 'apple', 'fitness', 'health'],
        totalStock: 20,
        reservedStock: 3,
        availableStock: 17,
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
        masterSku: 'TST-005',
        name: 'Gaming Mouse Logitech G Pro X Superlight',
        description: 'Gaming mouse ultra-ringan dengan sensor HERO 25K, wireless, dan desain ambidextrous untuk pro gaming',
        weight: '0.063',
        dimensions: { length: 125, width: 63.5, height: 40, unit: 'mm' },
        images: [
          { url: 'https://example.com/logitech-gpro-1.jpg', alt: 'Logitech G Pro X Superlight White' },
          { url: 'https://example.com/logitech-gpro-2.jpg', alt: 'Logitech G Pro X Superlight Side' }
        ],
        category: { id: 'gaming', name: 'Gaming Accessories', path: 'gaming' },
        brand: 'Logitech',
        basePrice: '1800000',
        currency: 'IDR',
        costPrice: '1600000',
        platformPrices: { shopee: 2070000, tiktok: 2160000 },
        hasVariants: false,
        seoData: { title: 'Logitech G Pro X Superlight - Gaming Mouse Pro', description: 'Mouse gaming profesional untuk esports dan competitive gaming' },
        tags: ['gaming', 'mouse', 'logitech', 'wireless', 'esports'],
        totalStock: 40,
        reservedStock: 8,
        availableStock: 32,
        dataQualityScore: 90,
        validationErrors: [],
        validationWarnings: ['Consider adding more product images'],
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
        // Product might already exist, skip
        console.log(`Product ${product.masterSku} might already exist, skipping...`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `Added ${insertedProducts.length} test products`,
        products: insertedProducts.map(p => ({
          id: p.id,
          name: p.name,
          masterSku: p.masterSku,
        })),
      },
    });
  } catch (error) {
    console.error('Error adding test products:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ADD_PRODUCTS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to add test products',
        },
      },
      { status: 500 }
    );
  }
}