#!/usr/bin/env tsx

/**
 * Simple Product Seeder Script for SyncStore Phase 4
 * 
 * This script populates the database with real FPV drone product data
 * using the correct JSONB format for PostgreSQL.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { products, productVariants, organizations, inventoryLocations, inventoryItems } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Direct database connection for seeder
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

const db = drizzle(client, {
  logger: false,
});

/**
 * Log with timestamp
 */
function log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${timestamp}] [${level}] ${message}`);
}

/**
 * Get existing organization
 */
async function getOrganization(): Promise<string> {
  try {
    const existingOrgs = await db.select().from(organizations).limit(1);
    
    if (existingOrgs.length > 0) {
      log(`Using existing organization: ${existingOrgs[0].name} (${existingOrgs[0].id})`);
      return existingOrgs[0].id;
    }
    
    throw new Error('No organization found. Please create one first.');
  } catch (error) {
    throw new Error(`Failed to get organization: ${error}`);
  }
}

/**
 * Get or create inventory location
 */
async function getOrCreateInventoryLocation(organizationId: string): Promise<string> {
  try {
    const existingLocations = await db
      .select()
      .from(inventoryLocations)
      .where(eq(inventoryLocations.organizationId, organizationId))
      .limit(1);
    
    if (existingLocations.length > 0) {
      log(`Using existing inventory location: ${existingLocations[0].name} (${existingLocations[0].id})`);
      return existingLocations[0].id;
    }
    
    // Create default location
    const locationId = crypto.randomUUID();
    await db.insert(inventoryLocations).values({
      id: locationId,
      organizationId,
      name: 'Main Warehouse',
      address: {
        street: '123 Drone Street',
        city: 'Jakarta',
        country: 'Indonesia',
        postalCode: '12345'
      },
      isDefault: true,
      isActive: true
    });
    
    log(`Created default inventory location: Main Warehouse (${locationId})`);
    return locationId;
  } catch (error) {
    throw new Error(`Failed to get/create inventory location: ${error}`);
  }
}

/**
 * Main seeder function
 */
async function seedProducts(): Promise<void> {
  const startTime = Date.now();
  
  try {
    log('🌱 Starting simple product seeding...');
    
    // Get organization and location
    const organizationId = await getOrganization();
    const locationId = await getOrCreateInventoryLocation(organizationId);
    
    // Clear existing products for this demo
    log('🧹 Clearing existing products...');
    await db.delete(products).where(eq(products.organizationId, organizationId));
    
    // Create 10 sample products
    log('📦 Creating 10 sample products...');
    
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
    
    let productsCreated = 0;
    let variantsCreated = 0;
    let inventoryCreated = 0;
    
    for (const productData of sampleProducts) {
      // Create product
      const productId = crypto.randomUUID();
      
      await db.insert(products).values({
        id: productId,
        organizationId,
        sku: productData.sku,
        name: productData.name,
        description: productData.description,
        category: productData.category,
        brand: productData.brand,
        costPrice: productData.costPrice,
        weight: productData.weight,
        dimensions: JSON.stringify({ length: 100, width: 50, height: 25 }), // Default dimensions
        images: JSON.stringify(['https://example.com/image1.jpg', 'https://example.com/image2.jpg']), // Sample images
        attributes: JSON.stringify({ type: 'fpv_component' }), // Sample attributes
        isActive: true
      });
      
      productsCreated++;
      log(`  ✓ Created product: ${productData.name}`);
      
      // Create default variant
      const variantId = crypto.randomUUID();
      
      await db.insert(productVariants).values({
        id: variantId,
        productId,
        variantSku: `${productData.sku}-DEFAULT`,
        name: 'Default',
        attributes: JSON.stringify({ variant_type: 'default' }),
        costPrice: productData.costPrice,
        weight: productData.weight,
        images: JSON.stringify(['https://example.com/variant1.jpg']),
        isActive: true
      });
      
      variantsCreated++;
      log(`  ✓ Created variant: Default for ${productData.name}`);
      
      // Create inventory
      const stockQuantity = Math.floor(Math.random() * 100) + 10; // Random stock 10-109
      
      await db.insert(inventoryItems).values({
        id: crypto.randomUUID(),
        productVariantId: variantId,
        locationId,
        quantityOnHand: stockQuantity,
        quantityReserved: 0,
        reorderPoint: 10,
        reorderQuantity: 50
      });
      
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
    await client.end();
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