#!/usr/bin/env node

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { sql } = require('drizzle-orm');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const setupDatabase = async () => {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
  }
  
  console.log('🔄 Setting up database schema...');
  
  const connection = postgres(connectionString, { max: 1 });
  
  try {
    // Create organizations table first (no dependencies)
    await connection`
      CREATE TABLE IF NOT EXISTS organizations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(255) NOT NULL,
        slug varchar(255) UNIQUE NOT NULL,
        settings jsonb DEFAULT '{}',
        subscription_plan varchar(50) DEFAULT 'free',
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log('✅ Organizations table created');

    // Create users table (depends on organizations)
    await connection`
      CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY, -- Clerk user ID
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        email varchar(255) NOT NULL,
        full_name varchar(255),
        role varchar(50) DEFAULT 'member' NOT NULL,
        is_active boolean DEFAULT true NOT NULL,
        last_active_at timestamp with time zone,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log('✅ Users table created');

    // Create platforms table (no dependencies)
    await connection`
      CREATE TABLE IF NOT EXISTS platforms (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(100) UNIQUE NOT NULL,
        display_name varchar(255) NOT NULL,
        is_active boolean DEFAULT true NOT NULL,
        api_config jsonb DEFAULT '{}',
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log('✅ Platforms table created');

    // Insert default platforms
    await connection`
      INSERT INTO platforms (name, display_name, api_config) 
      VALUES 
        ('shopee', 'Shopee', '{}'),
        ('tiktokshop', 'TikTok Shop', '{}'),
        ('custom', 'Custom Website', '{}')
      ON CONFLICT (name) DO NOTHING;
    `;
    console.log('✅ Default platforms inserted');

    // Create stores table
    await connection`
      CREATE TABLE IF NOT EXISTS stores (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        platform_id uuid NOT NULL REFERENCES platforms(id),
        name varchar(255) NOT NULL,
        platform_store_id varchar(255) NOT NULL,
        credentials jsonb DEFAULT '{}',
        settings jsonb DEFAULT '{}',
        sync_status varchar(50) DEFAULT 'active',
        last_sync_at timestamp with time zone,
        is_active boolean DEFAULT true NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log('✅ Stores table created');

    // Create products table
    await connection`
      CREATE TABLE IF NOT EXISTS products (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        sku varchar(255) NOT NULL,
        name varchar(500) NOT NULL,
        description text,
        category varchar(255),
        brand varchar(255),
        cost_price numeric(12, 2),
        weight numeric(8, 2),
        dimensions jsonb,
        images text[] DEFAULT '{}',
        attributes jsonb DEFAULT '{}',
        is_active boolean DEFAULT true NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        UNIQUE(organization_id, sku)
      );
    `;
    console.log('✅ Products table created');

    // Create product variants table
    await connection`
      CREATE TABLE IF NOT EXISTS product_variants (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        variant_sku varchar(255) NOT NULL,
        name varchar(255),
        attributes jsonb DEFAULT '{}',
        cost_price numeric(12, 2),
        weight numeric(8, 2),
        images text[] DEFAULT '{}',
        is_active boolean DEFAULT true NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        UNIQUE(product_id, variant_sku)
      );
    `;
    console.log('✅ Product variants table created');

    // Create inventory locations table
    await connection`
      CREATE TABLE IF NOT EXISTS inventory_locations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name varchar(255) NOT NULL,
        address jsonb,
        is_default boolean DEFAULT false NOT NULL,
        is_active boolean DEFAULT true NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log('✅ Inventory locations table created');

    // Create inventory items table
    await connection`
      CREATE TABLE IF NOT EXISTS inventory_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        product_variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
        location_id uuid NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
        quantity_on_hand integer DEFAULT 0 NOT NULL,
        quantity_reserved integer DEFAULT 0 NOT NULL,
        reorder_point integer DEFAULT 0 NOT NULL,
        reorder_quantity integer DEFAULT 0 NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        UNIQUE(product_variant_id, location_id)
      );
    `;
    console.log('✅ Inventory items table created');

    // Create inventory transactions table (no foreign key to users)
    await connection`
      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
        transaction_type varchar(50) NOT NULL,
        quantity_change integer NOT NULL,
        reference_type varchar(50),
        reference_id uuid,
        notes text,
        created_by text, -- Clerk user ID (no foreign key)
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log('✅ Inventory transactions table created');

    // Create orders table
    await connection`
      CREATE TABLE IF NOT EXISTS orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        platform_order_id varchar(255) NOT NULL,
        order_number varchar(255),
        customer_info jsonb NOT NULL,
        status varchar(50) NOT NULL,
        financial_status varchar(50),
        fulfillment_status varchar(50),
        subtotal numeric(12, 2) NOT NULL,
        tax_amount numeric(12, 2) DEFAULT 0,
        shipping_amount numeric(12, 2) DEFAULT 0,
        discount_amount numeric(12, 2) DEFAULT 0,
        total_amount numeric(12, 2) NOT NULL,
        currency varchar(3) DEFAULT 'IDR',
        platform_data jsonb DEFAULT '{}',
        notes text,
        tags text[] DEFAULT '{}',
        ordered_at timestamp with time zone NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        UNIQUE(store_id, platform_order_id)
      );
    `;
    console.log('✅ Orders table created');

    // Create order items table
    await connection`
      CREATE TABLE IF NOT EXISTS order_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_variant_id uuid REFERENCES product_variants(id),
        platform_product_id varchar(255),
        platform_variant_id varchar(255),
        name varchar(500) NOT NULL,
        sku varchar(255),
        quantity integer NOT NULL,
        price numeric(12, 2) NOT NULL,
        total_amount numeric(12, 2) NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log('✅ Order items table created');

    // Create refresh tokens table (no foreign key to users)
    await connection`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id varchar(64) UNIQUE NOT NULL,
        user_id text NOT NULL, -- Clerk user ID (no foreign key)
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        token_hash varchar(255) UNIQUE NOT NULL,
        is_revoked boolean DEFAULT false NOT NULL,
        expires_at timestamp with time zone NOT NULL,
        last_used_at timestamp with time zone,
        user_agent text,
        ip_address varchar(45),
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log('✅ Refresh tokens table created');

    // Create revoked tokens table (no foreign key to users)
    await connection`
      CREATE TABLE IF NOT EXISTS revoked_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        token_hash varchar(255) UNIQUE NOT NULL,
        user_id text NOT NULL, -- Clerk user ID (no foreign key)
        revoked_at timestamp with time zone DEFAULT now() NOT NULL,
        expires_at timestamp with time zone NOT NULL,
        reason varchar(100)
      );
    `;
    console.log('✅ Revoked tokens table created');

    console.log('🎉 Database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

setupDatabase();