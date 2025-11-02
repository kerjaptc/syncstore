#!/usr/bin/env tsx

import { db } from '../src/lib/db';
import { masterProducts, organizations, users } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function addSampleData() {
  try {
    console.log('🔍 Checking existing data...');
    
    // Get first organization
    const [org] = await db.select().from(organizations).limit(1);
    if (!org) {
      console.error('❌ No organization found. Please create an organization first.');
      return;
    }
    
    console.log('✅ Found organization:', org.name);
    
    // Get first user for this organization
    const [user] = await db.select().from(users).where(eq(users.organizationId, org.id)).limit(1);
    if (!user) {
      console.error('❌ No user found for organization. Please create a user first.');
      return;
    }
    
    console.log('✅ Found user:', user.email);
    
    // Check existing products
    const existingProducts = await db
      .select()
      .from(masterProducts)
      .where(eq(masterProducts.organizationId, org.id))
      .limit(5);
    
    console.log(`📦 Found ${existingProducts.length} existing products`);
    
    if (existingProducts.length > 0) {
      console.log('✅ Products already exist:');
      existingProducts.forEach(p => {
        console.log(`  - ${p.name} (${p.masterSku})`);
      });
      return;
    }
    
    console.log('➕ Adding sample products...');
    
    const sampleProducts = [
      {
        organizationId: org.id,
        masterSku: 'SAMPLE-001',
        name: 'Samsung Galaxy A54 5G',
        description: 'Smartphone Android dengan kamera 50MP dan layar Super AMOLED',
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
        organizationId: org.id,
        masterSku: 'SAMPLE-002',
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
        organizationId: org.id,
        masterSku: 'SAMPLE-003',
        name: 'Sony WH-1000XM4',
        description: 'Headphone wireless dengan Active Noise Cancelling',
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
      }
    ];
    
    const insertedProducts = [];
    for (const product of sampleProducts) {
      const [inserted] = await db.insert(masterProducts).values(product).returning();
      insertedProducts.push(inserted);
      console.log(`✅ Added: ${inserted.name}`);
    }
    
    console.log(`🎉 Successfully added ${insertedProducts.length} sample products!`);
    
    // Verify the data
    const verifyProducts = await db
      .select({
        id: masterProducts.id,
        name: masterProducts.name,
        masterSku: masterProducts.masterSku,
        basePrice: masterProducts.basePrice,
      })
      .from(masterProducts)
      .where(eq(masterProducts.organizationId, org.id));
    
    console.log('\n📋 Current products in database:');
    verifyProducts.forEach(p => {
      console.log(`  - ${p.name} (${p.masterSku}) - ${p.basePrice} IDR`);
    });
    
  } catch (error) {
    console.error('❌ Error adding sample data:', error);
  }
}

addSampleData().then(() => {
  console.log('✅ Script completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});