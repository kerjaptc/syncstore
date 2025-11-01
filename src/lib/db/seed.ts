#!/usr/bin/env tsx

/**
 * Database seeding script
 * Populates the database with initial data for development and testing
 * 
 * Usage: npm run db:seed
 */

import { db } from './index';
import { platforms, organizations, users, inventoryLocations } from './schema';
import { eq } from 'drizzle-orm';

/**
 * Seed platforms data
 * Creates the supported marketplace platforms
 */
async function seedPlatforms() {
  console.log('🌱 Seeding platforms...');
  
  const platformsData = [
    {
      name: 'shopee',
      displayName: 'Shopee',
      isActive: true,
      apiConfig: {
        baseUrl: 'https://partner.shopeemobile.com/api/v2',
        version: 'v2.0',
        rateLimit: {
          requests: 100,
          window: '1m'
        },
        requiredCredentials: ['partner_id', 'partner_key'],
        supportedCountries: ['ID', 'MY', 'TH', 'VN', 'PH', 'SG']
      }
    },
    {
      name: 'tiktok_shop',
      displayName: 'TikTok Shop',
      isActive: true,
      apiConfig: {
        baseUrl: 'https://open-api.tiktokglobalshop.com',
        version: 'v202309',
        rateLimit: {
          requests: 100,
          window: '1m'
        },
        requiredCredentials: ['app_key', 'app_secret'],
        supportedCountries: ['ID', 'MY', 'TH', 'VN', 'PH', 'SG']
      }
    },
    {
      name: 'custom_website',
      displayName: 'Custom Website',
      isActive: true,
      apiConfig: {
        type: 'internal',
        features: ['storefront', 'checkout', 'inventory', 'orders'],
        paymentMethods: ['stripe', 'paypal', 'bank_transfer']
      }
    }
  ];

  for (const platformData of platformsData) {
    // Check if platform already exists
    const existing = await db.select().from(platforms).where(eq(platforms.name, platformData.name)).limit(1);
    
    if (existing.length === 0) {
      await db.insert(platforms).values(platformData);
      console.log(`✅ Created platform: ${platformData.displayName}`);
    } else {
      console.log(`⏭️  Platform already exists: ${platformData.displayName}`);
    }
  }
}

/**
 * Seed demo organization and user
 * Creates a demo organization for development testing
 */
async function seedDemoData() {
  console.log('🌱 Seeding demo organization...');
  
  // Create demo organization
  const demoOrgData = {
    name: 'Demo Store',
    slug: 'demo-store',
    settings: {
      timezone: 'Asia/Jakarta',
      currency: 'IDR',
      language: 'en',
      features: {
        multiLocation: true,
        analytics: true,
        automation: true
      }
    },
    subscriptionPlan: 'free'
  };

  // Check if demo org already exists
  const existingOrg = await db.select().from(organizations).where(eq(organizations.slug, demoOrgData.slug)).limit(1);
  
  let orgId: string;
  
  if (existingOrg.length === 0) {
    const [newOrg] = await db.insert(organizations).values(demoOrgData).returning();
    orgId = newOrg.id;
    console.log(`✅ Created demo organization: ${demoOrgData.name}`);
  } else {
    orgId = existingOrg[0].id;
    console.log(`⏭️  Demo organization already exists: ${demoOrgData.name}`);
  }

  // Create default inventory location for demo org
  const defaultLocationData = {
    organizationId: orgId,
    name: 'Main Warehouse',
    address: {
      street: 'Jl. Sudirman No. 123',
      city: 'Jakarta',
      state: 'DKI Jakarta',
      country: 'Indonesia',
      postalCode: '12345'
    },
    isDefault: true,
    isActive: true
  };

  // Check if default location already exists
  const existingLocation = await db.select()
    .from(inventoryLocations)
    .where(eq(inventoryLocations.organizationId, orgId))
    .limit(1);

  if (existingLocation.length === 0) {
    await db.insert(inventoryLocations).values(defaultLocationData);
    console.log(`✅ Created default inventory location for demo organization`);
  } else {
    console.log(`⏭️  Default inventory location already exists for demo organization`);
  }
}

/**
 * Main seeding function
 * Orchestrates all seeding operations
 */
async function main() {
  console.log('🚀 Starting database seeding...');
  
  try {
    // Seed platforms first (required for stores)
    await seedPlatforms();
    
    // Seed demo data
    await seedDemoData();
    
    console.log('✅ Database seeding completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log('- Platforms: Shopee, TikTok Shop, Custom Website');
    console.log('- Demo organization: Demo Store');
    console.log('- Default inventory location created');
    console.log('');
    console.log('🎯 Next steps:');
    console.log('1. Set up Clerk authentication');
    console.log('2. Create your first user account');
    console.log('3. Connect your first store');
    
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
}

/**
 * Cleanup function for graceful shutdown
 */
async function cleanup() {
  console.log('🧹 Cleaning up...');
  process.exit(0);
}

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Run the seeding script
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}