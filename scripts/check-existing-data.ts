#!/usr/bin/env tsx

/**
 * Check existing data in database to understand the correct format
 */

import postgres from 'postgres';

async function checkData() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }
  
  const sql = postgres(DATABASE_URL, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10
  });
  
  try {
    console.log('🔍 Checking existing data...');
    
    // Check organizations
    const orgs = await sql`SELECT * FROM organizations LIMIT 1`;
    console.log('📋 Organizations:', orgs);
    
    // Check products
    const products = await sql`SELECT * FROM products LIMIT 1`;
    console.log('📦 Products:', products);
    
    // Check if there are any products with images
    const productsWithImages = await sql`SELECT id, name, images FROM products WHERE images IS NOT NULL LIMIT 3`;
    console.log('🖼️  Products with images:', productsWithImages);
    
    // Check product variants
    const variants = await sql`SELECT * FROM product_variants LIMIT 1`;
    console.log('🔧 Product variants:', variants);
    
    await sql.end();
    
  } catch (error) {
    console.error('❌ Error:', error);
    await sql.end();
    process.exit(1);
  }
}

checkData();