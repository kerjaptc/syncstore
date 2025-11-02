#!/usr/bin/env tsx

/**
 * Raw SQL Product Seeder for SyncStore Phase 4
 * Uses raw SQL to avoid JSONB formatting issues
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

/**
 * Log with timestamp
 */
function log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${timestamp}] [${level}] ${message}`);
}

/**
 * Generate UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Main seeder function
 */
async function seedProducts(): Promise<void> {
  const startTime = Date.now();
  
  try {
    log('🌱 Starting raw SQL product seeding...');
    
    // Get organization
    const orgs = await sql`SELECT id FROM organizations LIMIT 1`;
    if (orgs.length === 0) {
      throw new Error('No organization found');
    }
    const organizationId = orgs[0].id;
    log(`Using organization: ${organizationId}`);
    
    // Get or create inventory location
    let locations = await sql`SELECT id FROM inventory_locations WHERE organization_id = ${organizationId} LIMIT 1`;
    let locationId;
    
    if (locations.length === 0) {
      locationId = generateUUID();
      await sql`
        INSERT INTO inventory_locations (id, organization_id, name, address, is_default, is_active)
        VALUES (${locationId}, ${organizationId}, 'Main Warehouse', '{"street": "123 Drone Street", "city": "Jakarta"}', true, true)
      `;
      log(`Created inventory location: ${locationId}`);
    } else {
      locationId = locations[0].id;
      log(`Using existing location: ${locationId}`);
    }
    
    // Clear existing products
    await sql`DELETE FROM products WHERE organization_id = ${organizationId}`;
    log('🧹 Cleared existing products');
    
    // Sample products data
    const sampleProducts = [
      {
        sku: 'FPV-BAT-4S-1500',
        name: 'FPV Racing Battery 4S 1500mAh 100C',
        description: 'High-performance lithium polymer battery designed for FPV racing drones.',
        category: 'Batteries',
        brand: 'TurboAce',
        costPrice: '45.00',
        weight: '185.5'
      },
      {
        sku: 'FPV-PROP-5040-3B',
        name: 'FPV Racing Propeller 5040 3-Blade Set',
        description: 'Precision-balanced 3-blade propellers optimized for 5-inch racing quads.',
        category: 'Propellers',
        brand: 'SpeedWing',
        costPrice: '12.50',
        weight: '28.0'
      },
      {
        sku: 'FPV-CAM-NANO-1200TVL',
        name: 'FPV Nano Camera 1200TVL CMOS',
        description: 'Ultra-lightweight FPV camera with 1200TVL resolution.',
        category: 'Cameras',
        brand: 'VisionTech',
        costPrice: '28.75',
        weight: '5.2'
      },
      {
        sku: 'FPV-VTX-600MW-5G8',
        name: 'FPV Video Transmitter 600mW 5.8GHz',
        description: 'High-power video transmitter with 600mW output power.',
        category: 'Video Transmitters',
        brand: 'AirLink',
        costPrice: '35.20',
        weight: '8.5'
      },
      {
        sku: 'FPV-FC-F7-DUAL',
        name: 'FPV Flight Controller F7 Dual Gyro',
        description: 'Advanced F7 flight controller with dual gyroscopes.',
        category: 'Flight Controllers',
        brand: 'FlightMaster',
        costPrice: '52.80',
        weight: '6.8'
      },
      {
        sku: 'FPV-ESC-35A-4IN1',
        name: 'FPV ESC 35A 4-in-1 BLHeli_S',
        description: '4-in-1 electronic speed controller with 35A per motor.',
        category: 'ESCs',
        brand: 'PowerDrive',
        costPrice: '48.90',
        weight: '12.3'
      },
      {
        sku: 'FPV-MOTOR-2207-2750KV',
        name: 'FPV Brushless Motor 2207 2750KV',
        description: 'High-performance brushless motor optimized for 5-inch racing props.',
        category: 'Motors',
        brand: 'ThrustMax',
        costPrice: '22.45',
        weight: '32.1'
      },
      {
        sku: 'FPV-FRAME-5IN-CARBON',
        name: 'FPV Racing Frame 5-inch Carbon Fiber',
        description: 'Lightweight carbon fiber frame designed for 5-inch racing quads.',
        category: 'Frames',
        brand: 'CarbonSpeed',
        costPrice: '38.60',
        weight: '85.0'
      },
      {
        sku: 'FPV-RX-ELRS-2G4',
        name: 'FPV Receiver ExpressLRS 2.4GHz',
        description: 'Ultra-low latency ExpressLRS receiver with 2.4GHz frequency.',
        category: 'Receivers',
        brand: 'LinkMaster',
        costPrice: '18.30',
        weight: '1.2'
      },
      {
        sku: 'FPV-ANT-5G8-OMNI',
        name: 'FPV Antenna 5.8GHz Omnidirectional',
        description: 'High-gain omnidirectional antenna for 5.8GHz video systems.',
        category: 'Antennas',
        brand: 'SignalPro',
        costPrice: '15.75',
        weight: '8.8'
      }
    ];
    
    log('📦 Creating 10 sample products...');
    
    let productsCreated = 0;
    let variantsCreated = 0;
    let inventoryCreated = 0;
    
    for (const productData of sampleProducts) {
      // Create product using raw SQL
      const productId = generateUUID();
      
      await sql`
        INSERT INTO products (
          id, organization_id, sku, name, description, category, brand, 
          cost_price, weight, dimensions, images, attributes, is_active,
          created_at, updated_at
        ) VALUES (
          ${productId}, ${organizationId}, ${productData.sku}, ${productData.name}, 
          ${productData.description}, ${productData.category}, ${productData.brand},
          ${productData.costPrice}, ${productData.weight}, 
          '{"length": 100, "width": 50, "height": 25}',
          ARRAY['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
          '{"type": "fpv_component"}',
          true, NOW(), NOW()
        )
      `;
      
      productsCreated++;
      log(`  ✓ Created product: ${productData.name}`);
      
      // Create default variant
      const variantId = generateUUID();
      
      await sql`
        INSERT INTO product_variants (
          id, product_id, variant_sku, name, attributes, cost_price, weight, 
          images, is_active, created_at, updated_at
        ) VALUES (
          ${variantId}, ${productId}, ${productData.sku + '-DEFAULT'}, 'Default',
          '{"variant_type": "default"}', ${productData.costPrice}, ${productData.weight},
          ARRAY['https://example.com/variant1.jpg'], true, NOW(), NOW()
        )
      `;
      
      variantsCreated++;
      log(`  ✓ Created variant: Default for ${productData.name}`);
      
      // Create inventory
      const stockQuantity = Math.floor(Math.random() * 100) + 10; // Random stock 10-109
      const inventoryId = generateUUID();
      
      await sql`
        INSERT INTO inventory_items (
          id, product_variant_id, location_id, quantity_on_hand, quantity_reserved,
          reorder_point, reorder_quantity, updated_at
        ) VALUES (
          ${inventoryId}, ${variantId}, ${locationId}, ${stockQuantity}, 0,
          10, 50, NOW()
        )
      `;
      
      inventoryCreated++;
      log(`  ✓ Created inventory: ${stockQuantity} units`);
    }
    
    const executionTime = Date.now() - startTime;
    
    log('🎉 Product seeding completed successfully!');
    log(`📊 Summary:`);
    log(`   Products created: ${productsCreated}`);
    log(`   Variants created: ${variantsCreated}`);
    log(`   Inventory items created: ${inventoryCreated}`);
    log(`⏱️  Execution time: ${executionTime}ms`);
    
  } catch (error) {
    log(`❌ Seeding failed: ${error}`, 'ERROR');
    throw error;
  } finally {
    await sql.end();
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    await seedProducts();
    log('✅ Seeding completed successfully');
    process.exit(0);
  } catch (error) {
    log(`❌ Fatal error: ${error}`, 'ERROR');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { seedProducts };