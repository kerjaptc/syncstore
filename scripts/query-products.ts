#!/usr/bin/env tsx

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { products, productVariants, inventoryItems } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL required');
}

const client = postgres(connectionString);
const db = drizzle(client);

async function queryProducts() {
  console.log('📊 Querying products from database...\n');
  
  const productsData = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      price: products.costPrice,
      category: products.category,
      brand: products.brand,
      variantId: productVariants.id,
      stock: sql<number>`COALESCE(SUM(${inventoryItems.quantityOnHand}), 0)`,
    })
    .from(products)
    .leftJoin(productVariants, eq(productVariants.productId, products.id))
    .leftJoin(inventoryItems, eq(inventoryItems.productVariantId, productVariants.id))
    .groupBy(products.id, products.sku, products.name, products.costPrice, products.category, products.brand, productVariants.id)
    .limit(20);

  console.log(`✅ Found ${productsData.length} products:\n`);
  
  const productsMap = new Map();
  for (const row of productsData) {
    if (!productsMap.has(row.id)) {
      productsMap.set(row.id, {
        sku: row.sku,
        name: row.name,
        price: row.price,
        category: row.category,
        brand: row.brand,
        stock: 0,
      });
    }
    const product = productsMap.get(row.id);
    product.stock += Number(row.stock) || 0;
  }

  let index = 1;
  for (const [id, product] of productsMap) {
    console.log(`${index}. ${product.name}`);
    console.log(`   SKU: ${product.sku}`);
    console.log(`   Price: Rp ${product.price}`);
    console.log(`   Stock: ${product.stock} units`);
    console.log(`   Category: ${product.category}`);
    console.log(`   Brand: ${product.brand}`);
    console.log('');
    index++;
  }

  await client.end();
}

queryProducts().catch(console.error);
