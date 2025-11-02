#!/usr/bin/env tsx

/**
 * Product Seeder Script for SyncStore Phase 4
 * 
 * This script populates the database with real FPV drone product data
 * for testing and demonstration purposes.
 * 
 * Usage:
 *   npm run seed:products
 *   tsx scripts/seed-products.ts
 *   tsx scripts/seed-products.ts --dry-run
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
  logger: false, // Disable query logging for cleaner output
});

interface ProductData {
  id: string;
  organizationId: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  costPrice: string;
  weight: string;
  dimensions: any; // JSONB field
  images: any; // JSONB field  
  attributes: any; // JSONB field
  isActive: boolean;
}

interface ProductVariantData {
  id: string;
  productId: string;
  variantSku: string;
  name: string;
  attributes: any; // JSONB field
  costPrice: string;
  weight: string;
  images: any; // JSONB field
  isActive: boolean;
}

interface InventoryData {
  productVariantId: string;
  locationId: string;
  quantityOnHand: number;
  quantityReserved: number;
  reorderPoint: number;
  reorderQuantity: number;
}

interface SeederResult {
  success: boolean;
  productsCreated: number;
  variantsCreated: number;
  inventoryCreated: number;
  errors: string[];
  executionTimeMs: number;
  evidence: {
    screenshotPath?: string;
    logPath?: string;
    dataSnapshot: ProductData[];
  };
}

// Real FPV drone product data
const SAMPLE_PRODUCTS: Omit<ProductData, 'id' | 'organizationId'>[] = [
  {
    sku: 'FPV-BAT-4S-1500',
    name: 'FPV Racing Battery 4S 1500mAh 100C',
    description: 'High-performance lithium polymer battery designed for FPV racing drones. Delivers consistent power with 100C discharge rate for maximum performance.',
    category: 'Batteries',
    brand: 'TurboAce',
    costPrice: '45.00',
    weight: '185.5',
    dimensions: { length: 70, width: 35, height: 25 },
    images: [
      'https://example.com/images/fpv-battery-4s-1500-front.jpg',
      'https://example.com/images/fpv-battery-4s-1500-side.jpg'
    ],
    attributes: {
      voltage: '14.8V',
      capacity: '1500mAh',
      dischargeRate: '100C',
      connector: 'XT60',
      cells: 4
    },
    isActive: true
  },
  {
    sku: 'FPV-PROP-5040-3B',
    name: 'FPV Racing Propeller 5040 3-Blade Set',
    description: 'Precision-balanced 3-blade propellers optimized for 5-inch racing quads. Durable polycarbonate construction with excellent thrust-to-weight ratio.',
    category: 'Propellers',
    brand: 'SpeedWing',
    costPrice: '12.50',
    weight: '28.0',
    dimensions: { length: 127, width: 127, height: 8 },
    images: [
      'https://example.com/images/fpv-prop-5040-3b-set.jpg',
      'https://example.com/images/fpv-prop-5040-3b-detail.jpg'
    ],
    attributes: {
      diameter: '5 inch',
      pitch: '4.0 inch',
      blades: 3,
      material: 'Polycarbonate',
      weight_per_prop: '7g'
    },
    isActive: true
  },
  {
    sku: 'FPV-CAM-NANO-1200TVL',
    name: 'FPV Nano Camera 1200TVL CMOS',
    description: 'Ultra-lightweight FPV camera with 1200TVL resolution. Perfect for micro and nano racing drones with excellent low-light performance.',
    category: 'Cameras',
    brand: 'VisionTech',
    costPrice: '28.75',
    weight: '5.2',
    dimensions: { length: 19, width: 19, height: 18 },
    images: [
      'https://example.com/images/fpv-cam-nano-1200tvl-front.jpg',
      'https://example.com/images/fpv-cam-nano-1200tvl-back.jpg'
    ],
    attributes: {
      resolution: '1200TVL',
      sensor: 'CMOS',
      voltage: '5V',
      fov: '160°',
      weight_grams: 5.2
    },
    isActive: true
  },
  {
    sku: 'FPV-VTX-600MW-5G8',
    name: 'FPV Video Transmitter 600mW 5.8GHz',
    description: 'High-power video transmitter with 600mW output power. Features 48 channels across multiple bands for interference-free flying.',
    category: 'Video Transmitters',
    brand: 'AirLink',
    costPrice: '35.20',
    weight: '8.5',
    dimensions: { length: 36, width: 20, height: 7 },
    images: [
      'https://example.com/images/fpv-vtx-600mw-top.jpg',
      'https://example.com/images/fpv-vtx-600mw-bottom.jpg'
    ],
    attributes: {
      power: '600mW',
      frequency: '5.8GHz',
      channels: 48,
      bands: 'A/B/E/F/R',
      input_voltage: '7-26V'
    },
    isActive: true
  },
  {
    sku: 'FPV-FC-F7-DUAL',
    name: 'FPV Flight Controller F7 Dual Gyro',
    description: 'Advanced F7 flight controller with dual gyroscopes for enhanced stability. Built-in OSD, blackbox logging, and multiple UART ports.',
    category: 'Flight Controllers',
    brand: 'FlightMaster',
    costPrice: '52.80',
    weight: '6.8',
    dimensions: { length: 36, width: 36, height: 8 },
    images: [
      'https://example.com/images/fpv-fc-f7-dual-top.jpg',
      'https://example.com/images/fpv-fc-f7-dual-bottom.jpg'
    ],
    attributes: {
      processor: 'STM32F745',
      gyro: 'Dual ICM42688',
      osd: 'Built-in',
      blackbox: 'Yes',
      uarts: 6
    },
    isActive: true
  },
  {
    sku: 'FPV-ESC-35A-4IN1',
    name: 'FPV ESC 35A 4-in-1 BLHeli_S',
    description: '4-in-1 electronic speed controller with 35A per motor. Features BLHeli_S firmware, current sensor, and compact design for racing builds.',
    category: 'ESCs',
    brand: 'PowerDrive',
    costPrice: '48.90',
    weight: '12.3',
    dimensions: { length: 36, width: 36, height: 5 },
    images: [
      'https://example.com/images/fpv-esc-35a-4in1-top.jpg',
      'https://example.com/images/fpv-esc-35a-4in1-wiring.jpg'
    ],
    attributes: {
      current: '35A',
      firmware: 'BLHeli_S',
      voltage: '3-6S',
      current_sensor: 'Yes',
      mounting: '30.5x30.5mm'
    },
    isActive: true
  },
  {
    sku: 'FPV-MOTOR-2207-2750KV',
    name: 'FPV Brushless Motor 2207 2750KV',
    description: 'High-performance brushless motor optimized for 5-inch racing props. Precision-balanced rotor with high-quality bearings for smooth operation.',
    category: 'Motors',
    brand: 'ThrustMax',
    costPrice: '22.45',
    weight: '32.1',
    dimensions: { length: 28, width: 28, height: 35 },
    images: [
      'https://example.com/images/fpv-motor-2207-2750kv-side.jpg',
      'https://example.com/images/fpv-motor-2207-2750kv-bottom.jpg'
    ],
    attributes: {
      size: '2207',
      kv: '2750KV',
      voltage: '3-4S',
      shaft: '5mm',
      mounting: 'M3x16mm'
    },
    isActive: true
  },
  {
    sku: 'FPV-FRAME-5IN-CARBON',
    name: 'FPV Racing Frame 5-inch Carbon Fiber',
    description: 'Lightweight carbon fiber frame designed for 5-inch racing quads. Features 4mm thick arms and integrated camera protection.',
    category: 'Frames',
    brand: 'CarbonSpeed',
    costPrice: '38.60',
    weight: '85.0',
    dimensions: { length: 220, width: 220, height: 25 },
    images: [
      'https://example.com/images/fpv-frame-5in-carbon-assembled.jpg',
      'https://example.com/images/fpv-frame-5in-carbon-parts.jpg'
    ],
    attributes: {
      wheelbase: '220mm',
      arm_thickness: '4mm',
      material: '3K Carbon Fiber',
      motor_mount: '16x19mm',
      stack_mount: '30.5x30.5mm'
    },
    isActive: true
  },
  {
    sku: 'FPV-RX-ELRS-2G4',
    name: 'FPV Receiver ExpressLRS 2.4GHz',
    description: 'Ultra-low latency ExpressLRS receiver with 2.4GHz frequency. Features telemetry support and excellent range performance.',
    category: 'Receivers',
    brand: 'LinkMaster',
    costPrice: '18.30',
    weight: '1.2',
    dimensions: { length: 23, width: 13, height: 4 },
    images: [
      'https://example.com/images/fpv-rx-elrs-2g4-top.jpg',
      'https://example.com/images/fpv-rx-elrs-2g4-size.jpg'
    ],
    attributes: {
      protocol: 'ExpressLRS',
      frequency: '2.4GHz',
      telemetry: 'Yes',
      antenna: 'Ceramic',
      weight_grams: 1.2
    },
    isActive: true
  },
  {
    sku: 'FPV-ANT-5G8-OMNI',
    name: 'FPV Antenna 5.8GHz Omnidirectional',
    description: 'High-gain omnidirectional antenna for 5.8GHz video systems. Durable construction with excellent radiation pattern for FPV flying.',
    category: 'Antennas',
    brand: 'SignalPro',
    costPrice: '15.75',
    weight: '8.8',
    dimensions: { length: 85, width: 8, height: 8 },
    images: [
      'https://example.com/images/fpv-ant-5g8-omni-full.jpg',
      'https://example.com/images/fpv-ant-5g8-omni-connector.jpg'
    ],
    attributes: {
      frequency: '5.8GHz',
      gain: '2.5dBi',
      pattern: 'Omnidirectional',
      connector: 'SMA',
      polarization: 'RHCP'
    },
    isActive: true
  }
];

// Product variants for some products
const SAMPLE_VARIANTS: Omit<ProductVariantData, 'id' | 'productId'>[] = [
  // Battery variants (different capacities)
  {
    variantSku: 'FPV-BAT-4S-1500-STD',
    name: 'Standard Version',
    attributes: { version: 'Standard', warranty: '6 months' },
    costPrice: '45.00',
    weight: '185.5',
    images: ['https://example.com/images/fpv-battery-4s-1500-std.jpg'],
    isActive: true
  },
  {
    variantSku: 'FPV-BAT-4S-1500-PRO',
    name: 'Pro Version',
    attributes: { version: 'Pro', warranty: '12 months', extra_features: 'Temperature monitoring' },
    costPrice: '52.00',
    weight: '190.0',
    images: ['https://example.com/images/fpv-battery-4s-1500-pro.jpg'],
    isActive: true
  },
  // Propeller variants (different colors)
  {
    variantSku: 'FPV-PROP-5040-3B-BLK',
    name: 'Black',
    attributes: { color: 'Black' },
    costPrice: '12.50',
    weight: '28.0',
    images: ['https://example.com/images/fpv-prop-5040-3b-black.jpg'],
    isActive: true
  },
  {
    variantSku: 'FPV-PROP-5040-3B-RED',
    name: 'Red',
    attributes: { color: 'Red' },
    costPrice: '12.50',
    weight: '28.0',
    images: ['https://example.com/images/fpv-prop-5040-3b-red.jpg'],
    isActive: true
  }
];

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
 * Log with timestamp
 */
function log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${timestamp}] [${level}] ${message}`);
}

/**
 * Validate product data completeness
 */
function validateProductData(product: Omit<ProductData, 'id' | 'organizationId'>): string[] {
  const errors: string[] = [];
  
  if (!product.sku || product.sku.trim() === '') {
    errors.push('SKU is required and cannot be empty');
  }
  
  if (!product.name || product.name.trim() === '') {
    errors.push('Product name is required and cannot be empty');
  }
  
  if (!product.costPrice || parseFloat(product.costPrice) <= 0) {
    errors.push('Cost price must be a positive number');
  }
  
  if (!product.weight || parseFloat(product.weight) <= 0) {
    errors.push('Weight must be a positive number');
  }
  
  if (!product.category || product.category.trim() === '') {
    errors.push('Category is required and cannot be empty');
  }
  
  if (!product.brand || product.brand.trim() === '') {
    errors.push('Brand is required and cannot be empty');
  }
  
  return errors;
}

/**
 * Get or create default organization
 */
async function getOrCreateOrganization(): Promise<string> {
  try {
    // Try to find existing organization
    const existingOrgs = await db.select().from(organizations).limit(1);
    
    if (existingOrgs.length > 0) {
      log(`Using existing organization: ${existingOrgs[0].name} (${existingOrgs[0].id})`);
      return existingOrgs[0].id;
    }
    
    // Create default organization
    const orgId = generateUUID();
    await db.insert(organizations).values({
      id: orgId,
      name: 'SyncStore Demo',
      slug: 'syncstore-demo',
      settings: {},
      subscriptionPlan: 'free'
    });
    
    log(`Created default organization: SyncStore Demo (${orgId})`);
    return orgId;
  } catch (error) {
    throw new Error(`Failed to get/create organization: ${error}`);
  }
}

/**
 * Get or create default inventory location
 */
async function getOrCreateInventoryLocation(organizationId: string): Promise<string> {
  try {
    // Try to find existing location
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
    const locationId = generateUUID();
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
 * Clear existing products (for clean seeding)
 */
async function clearExistingProducts(organizationId: string): Promise<void> {
  try {
    // Delete in correct order due to foreign key constraints
    await db.delete(inventoryItems).where(
      eq(inventoryItems.locationId, 
        db.select({ id: inventoryLocations.id })
          .from(inventoryLocations)
          .where(eq(inventoryLocations.organizationId, organizationId))
      )
    );
    
    await db.delete(productVariants).where(
      eq(productVariants.productId,
        db.select({ id: products.id })
          .from(products)
          .where(eq(products.organizationId, organizationId))
      )
    );
    
    const deletedProducts = await db.delete(products)
      .where(eq(products.organizationId, organizationId))
      .returning({ id: products.id });
    
    if (deletedProducts.length > 0) {
      log(`Cleared ${deletedProducts.length} existing products`);
    }
  } catch (error) {
    log(`Warning: Could not clear existing products: ${error}`, 'WARN');
  }
}

/**
 * Main seeder function
 */
async function seedProducts(dryRun: boolean = false): Promise<SeederResult> {
  const startTime = Date.now();
  const result: SeederResult = {
    success: false,
    productsCreated: 0,
    variantsCreated: 0,
    inventoryCreated: 0,
    errors: [],
    executionTimeMs: 0,
    evidence: {
      dataSnapshot: []
    }
  };
  
  try {
    log('🌱 Starting product seeding process...');
    
    if (dryRun) {
      log('🔍 DRY RUN MODE - No data will be committed to database');
    }
    
    // Validate all product data first
    log('📋 Validating product data...');
    for (let i = 0; i < SAMPLE_PRODUCTS.length; i++) {
      const product = SAMPLE_PRODUCTS[i];
      const errors = validateProductData(product);
      if (errors.length > 0) {
        result.errors.push(`Product ${i + 1} (${product.sku}): ${errors.join(', ')}`);
      }
    }
    
    if (result.errors.length > 0) {
      log(`❌ Validation failed with ${result.errors.length} errors`, 'ERROR');
      return result;
    }
    
    log('✅ All product data validated successfully');
    
    if (dryRun) {
      log(`✅ DRY RUN: Would create ${SAMPLE_PRODUCTS.length} products with ${SAMPLE_VARIANTS.length} variants`);
      result.success = true;
      result.executionTimeMs = Date.now() - startTime;
      return result;
    }
    
    // Get organization and location
    const organizationId = await getOrCreateOrganization();
    const locationId = await getOrCreateInventoryLocation(organizationId);
    
    // Clear existing products
    await clearExistingProducts(organizationId);
    
    // Insert products
    log('📦 Creating products...');
    const createdProducts: ProductData[] = [];
    
    for (const productData of SAMPLE_PRODUCTS) {
      const productId = generateUUID();
      const fullProduct: ProductData = {
        id: productId,
        organizationId,
        ...productData
      };
      
      // Convert arrays to proper JSON format for JSONB fields
      const productToInsert = {
        ...fullProduct,
        images: JSON.stringify(fullProduct.images),
        dimensions: JSON.stringify(fullProduct.dimensions),
        attributes: JSON.stringify(fullProduct.attributes)
      };
      
      await db.insert(products).values(productToInsert);
      createdProducts.push(fullProduct);
      result.productsCreated++;
      
      log(`  ✓ Created product: ${productData.name} (${productData.sku})`);
    }
    
    // Insert product variants
    log('🔧 Creating product variants...');
    const createdVariants: ProductVariantData[] = [];
    
    // Create variants for first two products as examples
    const batteryProduct = createdProducts.find(p => p.sku === 'FPV-BAT-4S-1500');
    const propellerProduct = createdProducts.find(p => p.sku === 'FPV-PROP-5040-3B');
    
    if (batteryProduct) {
      for (let i = 0; i < 2; i++) { // First 2 variants are for battery
        const variantData = SAMPLE_VARIANTS[i];
        const variantId = generateUUID();
        const fullVariant: ProductVariantData = {
          id: variantId,
          productId: batteryProduct.id,
          ...variantData
        };
        
        await db.insert(productVariants).values(fullVariant);
        createdVariants.push(fullVariant);
        result.variantsCreated++;
        
        log(`  ✓ Created variant: ${variantData.name} (${variantData.variantSku})`);
      }
    }
    
    if (propellerProduct) {
      for (let i = 2; i < 4; i++) { // Next 2 variants are for propeller
        const variantData = SAMPLE_VARIANTS[i];
        const variantId = generateUUID();
        const fullVariant: ProductVariantData = {
          id: variantId,
          productId: propellerProduct.id,
          ...variantData
        };
        
        await db.insert(productVariants).values(fullVariant);
        createdVariants.push(fullVariant);
        result.variantsCreated++;
        
        log(`  ✓ Created variant: ${variantData.name} (${variantData.variantSku})`);
      }
    }
    
    // Create default variants for products without explicit variants
    for (const product of createdProducts) {
      const hasVariants = createdVariants.some(v => v.productId === product.id);
      if (!hasVariants) {
        const variantId = generateUUID();
        const defaultVariant: ProductVariantData = {
          id: variantId,
          productId: product.id,
          variantSku: `${product.sku}-DEFAULT`,
          name: 'Default',
          attributes: { variant_type: 'default' },
          costPrice: product.costPrice,
          weight: product.weight,
          images: product.images,
          isActive: true
        };
        
        await db.insert(productVariants).values(defaultVariant);
        createdVariants.push(defaultVariant);
        result.variantsCreated++;
        
        log(`  ✓ Created default variant for: ${product.name}`);
      }
    }
    
    // Create inventory items
    log('📊 Creating inventory items...');
    for (const variant of createdVariants) {
      const stockQuantity = Math.floor(Math.random() * 100) + 10; // Random stock 10-109
      const reservedQuantity = Math.floor(Math.random() * 5); // Random reserved 0-4
      
      const inventoryData: InventoryData = {
        productVariantId: variant.id,
        locationId,
        quantityOnHand: stockQuantity,
        quantityReserved: reservedQuantity,
        reorderPoint: 10,
        reorderQuantity: 50
      };
      
      await db.insert(inventoryItems).values(inventoryData);
      result.inventoryCreated++;
      
      log(`  ✓ Created inventory: ${stockQuantity} units for ${variant.variantSku}`);
    }
    
    result.success = true;
    result.evidence.dataSnapshot = createdProducts;
    
    log('🎉 Product seeding completed successfully!');
    log(`📊 Summary:`);
    log(`   Products created: ${result.productsCreated}`);
    log(`   Variants created: ${result.variantsCreated}`);
    log(`   Inventory items created: ${result.inventoryCreated}`);
    
  } catch (error) {
    result.errors.push(`Seeding failed: ${error}`);
    log(`❌ Seeding failed: ${error}`, 'ERROR');
  } finally {
    result.executionTimeMs = Date.now() - startTime;
    log(`⏱️  Execution time: ${result.executionTimeMs}ms`);
  }
  
  return result;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  try {
    const result = await seedProducts(dryRun);
    
    if (result.success) {
      log('✅ Seeding completed successfully');
      process.exit(0);
    } else {
      log('❌ Seeding failed', 'ERROR');
      result.errors.forEach(error => log(`   ${error}`, 'ERROR'));
      process.exit(1);
    }
  } catch (error) {
    log(`❌ Fatal error: ${error}`, 'ERROR');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { seedProducts, type SeederResult };