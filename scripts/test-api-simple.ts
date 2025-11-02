#!/usr/bin/env tsx

/**
 * Simple API Test Script for Phase 4
 * Tests API endpoints without authentication (direct database queries)
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { products, productVariants, inventoryItems } from '@/lib/db/schema';
import { eq, desc, count } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const client = postgres(connectionString);
const db = drizzle(client);

function log(message: string, level: 'INFO' | 'SUCCESS' | 'ERROR' = 'INFO'): void {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const prefix = level === 'SUCCESS' ? '✅' : level === 'ERROR' ? '❌' : '📋';
  console.log(`[${timestamp}] [${level}] ${prefix} ${message}`);
}

async function testProductsAPI() {
  log('Testing Products API logic...');
  const startTime = Date.now();
  
  try {
    // Simulate API query
    const [totalResult] = await db
      .select({ count: count() })
      .from(products);
    
    const total = totalResult?.count || 0;
    
    const productsData = await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        category: products.category,
        brand: products.brand,
        costPrice: products.costPrice,
      })
      .from(products)
      .orderBy(desc(products.createdAt))
      .limit(10);
    
    const duration = Date.now() - startTime;
    
    log(`Products API: ${productsData.length} products fetched in ${duration}ms`, 'SUCCESS');
    log(`Total products in database: ${total}`);
    
    if (duration > 1000) {
      log(`WARNING: Response time >1s (${duration}ms)`, 'ERROR');
    }
    
    return { success: true, count: productsData.length, duration };
  } catch (error) {
    log(`Products API test failed: ${error}`, 'ERROR');
    return { success: false, error };
  }
}

async function testInventoryAPI() {
  log('Testing Inventory API logic...');
  const startTime = Date.now();
  
  try {
    const inventoryData = await db
      .select({
        id: inventoryItems.id,
        quantityOnHand: inventoryItems.quantityOnHand,
        quantityReserved: inventoryItems.quantityReserved,
        productName: products.name,
        productSku: products.sku,
      })
      .from(inventoryItems)
      .innerJoin(productVariants, eq(productVariants.id, inventoryItems.productVariantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .limit(10);
    
    const duration = Date.now() - startTime;
    
    log(`Inventory API: ${inventoryData.length} items fetched in ${duration}ms`, 'SUCCESS');
    
    // Calculate summary
    const lowStock = inventoryData.filter(item => item.quantityOnHand <= 10).length;
    const outOfStock = inventoryData.filter(item => item.quantityOnHand === 0).length;
    
    log(`Low stock items: ${lowStock}, Out of stock: ${outOfStock}`);
    
    if (duration > 1000) {
      log(`WARNING: Response time >1s (${duration}ms)`, 'ERROR');
    }
    
    return { success: true, count: inventoryData.length, duration };
  } catch (error) {
    log(`Inventory API test failed: ${error}`, 'ERROR');
    return { success: false, error };
  }
}

async function testPagination() {
  log('Testing Pagination logic...');
  const startTime = Date.now();
  
  try {
    const page = 1;
    const limit = 5;
    const offset = (page - 1) * limit;
    
    const [totalResult] = await db
      .select({ count: count() })
      .from(products);
    
    const total = totalResult?.count || 0;
    const totalPages = Math.ceil(total / limit);
    
    const productsData = await db
      .select()
      .from(products)
      .limit(limit)
      .offset(offset);
    
    const duration = Date.now() - startTime;
    
    log(`Pagination: Page ${page}/${totalPages}, ${productsData.length} items in ${duration}ms`, 'SUCCESS');
    
    return { success: true, page, totalPages, duration };
  } catch (error) {
    log(`Pagination test failed: ${error}`, 'ERROR');
    return { success: false, error };
  }
}

async function testSearch() {
  log('Testing Search logic...');
  const startTime = Date.now();
  
  try {
    const searchTerm = 'FPV';
    
    const productsData = await db
      .select()
      .from(products)
      .where(
        // Simple search simulation
        eq(products.isActive, true)
      )
      .limit(10);
    
    const filtered = productsData.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const duration = Date.now() - startTime;
    
    log(`Search: Found ${filtered.length} products matching "${searchTerm}" in ${duration}ms`, 'SUCCESS');
    
    return { success: true, count: filtered.length, duration };
  } catch (error) {
    log(`Search test failed: ${error}`, 'ERROR');
    return { success: false, error };
  }
}

async function main() {
  log('🧪 Starting API Logic Tests...\n');
  
  const results = {
    products: await testProductsAPI(),
    inventory: await testInventoryAPI(),
    pagination: await testPagination(),
    search: await testSearch(),
  };
  
  log('\n📊 Test Summary:');
  log(`Products API: ${results.products.success ? '✅ PASSED' : '❌ FAILED'}`);
  log(`Inventory API: ${results.inventory.success ? '✅ PASSED' : '❌ FAILED'}`);
  log(`Pagination: ${results.pagination.success ? '✅ PASSED' : '❌ FAILED'}`);
  log(`Search: ${results.search.success ? '✅ PASSED' : '❌ FAILED'}`);
  
  const allPassed = Object.values(results).every(r => r.success);
  
  if (allPassed) {
    log('\n🎉 All API logic tests passed!', 'SUCCESS');
    process.exit(0);
  } else {
    log('\n❌ Some tests failed', 'ERROR');
    process.exit(1);
  }
}

main().catch(error => {
  log(`Fatal error: ${error}`, 'ERROR');
  process.exit(1);
});
