# StoreSync Database Schema Documentation

This document provides a comprehensive overview of the StoreSync database schema, including table structures, relationships, and design decisions.

## Overview

The StoreSync database is designed to support a multi-tenant e-commerce management system with the following key features:

- **Multi-tenancy**: Organization-based data isolation
- **Multi-platform support**: Shopee, TikTok Shop, and custom websites
- **Inventory management**: Multi-location stock tracking
- **Order management**: Unified order processing across platforms
- **Synchronization**: Background sync jobs and logging
- **Audit trails**: Comprehensive tracking of data changes

## Architecture Principles

### 1. Multi-Tenancy
- All business data is scoped to organizations
- Row Level Security (RLS) policies enforce data isolation
- Users belong to organizations with role-based access

### 2. Platform Abstraction
- Generic platform interface supports multiple marketplaces
- Platform-specific data stored in JSONB fields
- Extensible design for adding new platforms

### 3. Data Integrity
- Foreign key constraints ensure referential integrity
- Unique constraints prevent duplicate data
- Check constraints validate data ranges and formats

### 4. Performance Optimization
- Strategic indexing for common query patterns
- JSONB for flexible schema evolution
- Computed columns for frequently accessed calculations

## Core Tables

### Organizations
**Purpose**: Root entity for multi-tenancy

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}' NOT NULL,
  subscription_plan VARCHAR(50) DEFAULT 'free' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Key Features**:
- Unique slug for URL-friendly identification
- JSONB settings for flexible configuration
- Subscription plan tracking

### Users
**Purpose**: Organization members with role-based access

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY, -- Clerk user ID
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'member' NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Key Features**:
- Uses Clerk user IDs as primary keys
- Role-based access control (owner, admin, member, viewer)
- Activity tracking

### Platforms
**Purpose**: Supported marketplace platforms

```sql
CREATE TABLE platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL, -- 'shopee', 'tiktok_shop', 'custom_website'
  display_name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  api_config JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Key Features**:
- Extensible platform support
- API configuration stored as JSONB
- Enable/disable platforms globally

### Stores
**Purpose**: Connected marketplace stores

```sql
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  platform_id UUID REFERENCES platforms(id) NOT NULL,
  name VARCHAR(255) NOT NULL,
  platform_store_id VARCHAR(255) NOT NULL,
  credentials JSONB NOT NULL, -- Encrypted
  settings JSONB DEFAULT '{}' NOT NULL,
  sync_status VARCHAR(50) DEFAULT 'active' NOT NULL,
  last_sync_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Key Features**:
- Encrypted credential storage
- Sync status tracking
- Platform-specific settings

## Product Management

### Products
**Purpose**: Master product catalog

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  sku VARCHAR(255) NOT NULL,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(255),
  brand VARCHAR(255),
  cost_price DECIMAL(12,2),
  weight DECIMAL(8,2),
  dimensions JSONB,
  images JSONB DEFAULT '[]' NOT NULL,
  attributes JSONB DEFAULT '{}' NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(organization_id, sku)
);
```

**Key Features**:
- Organization-scoped unique SKUs
- Flexible attributes via JSONB
- Image array storage
- Physical properties (weight, dimensions)

### Product Variants
**Purpose**: Product variations (size, color, etc.)

```sql
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  variant_sku VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  attributes JSONB DEFAULT '{}' NOT NULL,
  cost_price DECIMAL(12,2),
  weight DECIMAL(8,2),
  images JSONB DEFAULT '[]' NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(product_id, variant_sku)
);
```

**Key Features**:
- Product-scoped unique variant SKUs
- Variant-specific attributes
- Independent pricing and images

### Store Product Mappings
**Purpose**: Platform-specific product mappings

```sql
CREATE TABLE store_product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE NOT NULL,
  platform_product_id VARCHAR(255) NOT NULL,
  platform_variant_id VARCHAR(255),
  platform_sku VARCHAR(255),
  price DECIMAL(12,2) NOT NULL,
  compare_at_price DECIMAL(12,2),
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  last_sync_at TIMESTAMPTZ,
  sync_status VARCHAR(50) DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Key Features**:
- Maps internal products to platform products
- Platform-specific pricing
- Sync status tracking

## Inventory Management

### Inventory Locations
**Purpose**: Warehouse/storage locations

```sql
CREATE TABLE inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  address JSONB,
  is_default BOOLEAN DEFAULT FALSE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Key Features**:
- Multi-location support
- Default location designation
- Address storage as JSONB

### Inventory Items
**Purpose**: Stock levels per variant per location

```sql
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES inventory_locations(id) ON DELETE CASCADE NOT NULL,
  quantity_on_hand INTEGER DEFAULT 0 NOT NULL,
  quantity_reserved INTEGER DEFAULT 0 NOT NULL,
  reorder_point INTEGER DEFAULT 0 NOT NULL,
  reorder_quantity INTEGER DEFAULT 0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(product_variant_id, location_id)
);
```

**Key Features**:
- Available quantity computed as: on_hand - reserved
- Reorder point management
- Unique constraint per variant per location

### Inventory Transactions
**Purpose**: Stock movement audit trail

```sql
CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE NOT NULL,
  transaction_type VARCHAR(50) NOT NULL,
  quantity_change INTEGER NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Key Features**:
- Complete audit trail of stock changes
- Reference to source transactions (orders, adjustments)
- User attribution

## Order Management

### Orders
**Purpose**: Unified order management

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  store_id UUID REFERENCES stores(id) NOT NULL,
  platform_order_id VARCHAR(255) NOT NULL,
  order_number VARCHAR(255),
  customer_info JSONB NOT NULL,
  status VARCHAR(50) NOT NULL,
  financial_status VARCHAR(50),
  fulfillment_status VARCHAR(50),
  subtotal DECIMAL(12,2) NOT NULL,
  tax_amount DECIMAL(12,2) DEFAULT 0 NOT NULL,
  shipping_amount DECIMAL(12,2) DEFAULT 0 NOT NULL,
  discount_amount DECIMAL(12,2) DEFAULT 0 NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'IDR' NOT NULL,
  platform_data JSONB DEFAULT '{}' NOT NULL,
  notes TEXT,
  tags TEXT[],
  ordered_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(store_id, platform_order_id)
);
```

**Key Features**:
- Unified order structure across platforms
- Flexible customer info storage
- Multiple status tracking
- Platform-specific data preservation

### Order Items
**Purpose**: Individual items within orders

```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  product_variant_id UUID REFERENCES product_variants(id),
  platform_product_id VARCHAR(255),
  platform_variant_id VARCHAR(255),
  name VARCHAR(500) NOT NULL,
  sku VARCHAR(255),
  quantity INTEGER NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Key Features**:
- Links to internal products when available
- Preserves platform product information
- Line item pricing

## Synchronization System

### Sync Jobs
**Purpose**: Background synchronization jobs

```sql
CREATE TABLE sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  store_id UUID REFERENCES stores(id),
  job_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  items_total INTEGER DEFAULT 0 NOT NULL,
  items_processed INTEGER DEFAULT 0 NOT NULL,
  items_failed INTEGER DEFAULT 0 NOT NULL,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  metadata JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Key Features**:
- Progress tracking
- Error handling and retry logic
- Flexible metadata storage

### Sync Logs
**Purpose**: Detailed sync operation logs

```sql
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_id UUID REFERENCES sync_jobs(id) ON DELETE CASCADE NOT NULL,
  level VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Key Features**:
- Structured logging levels
- Detailed error information
- JSON details for complex data

## Webhook System

### Webhook Endpoints
**Purpose**: Platform webhook configurations

```sql
CREATE TABLE webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  platform_webhook_id VARCHAR(255),
  event_types TEXT[] NOT NULL,
  url VARCHAR(500) NOT NULL,
  secret VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

### Webhook Events
**Purpose**: Incoming webhook events

```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_endpoint_id UUID REFERENCES webhook_endpoints(id),
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE NOT NULL,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

## Indexing Strategy

### Primary Indexes
- All tables have UUID primary keys with default generation
- Unique constraints on business keys (SKUs, slugs, etc.)

### Performance Indexes
- Organization-scoped queries: `(organization_id, ...)`
- Time-based queries: `(created_at)`, `(updated_at)`
- Status-based queries: `(status)`, `(is_active)`
- Search queries: Full-text search on product names/descriptions

### Composite Indexes
- Store + Platform queries: `(store_id, platform_id)`
- Product + Variant queries: `(product_id, variant_sku)`
- Inventory queries: `(product_variant_id, location_id)`

## Security Considerations

### Row Level Security (RLS)
- All business data tables have RLS policies
- Organization-based data isolation
- User role-based access control

### Data Encryption
- Sensitive credentials encrypted at application level
- Database connections use TLS
- Backup encryption recommended

### Audit Trails
- All data changes tracked with timestamps
- User attribution where applicable
- Immutable transaction logs

## Backup and Recovery

### Backup Strategy
- Regular automated backups
- Point-in-time recovery capability
- Cross-region replication for critical data

### Recovery Procedures
- Database restoration from backups
- Transaction log replay for point-in-time recovery
- Data validation after recovery

## Performance Considerations

### Query Optimization
- Proper indexing for common access patterns
- Query plan analysis and optimization
- Connection pooling for concurrent access

### Scaling Strategies
- Read replicas for reporting queries
- Partitioning for large tables (orders, transactions)
- Caching for frequently accessed data

### Monitoring
- Query performance monitoring
- Index usage analysis
- Connection pool monitoring
- Slow query identification

## Migration Strategy

### Schema Evolution
- Drizzle ORM for type-safe migrations
- Backward-compatible changes preferred
- Data migration scripts for complex changes

### Version Control
- All schema changes version controlled
- Migration rollback procedures
- Environment-specific configurations

## Data Retention

### Retention Policies
- Order data: 7 years (compliance)
- Sync logs: 90 days (operational)
- Webhook events: 30 days (debugging)
- Audit trails: 5 years (security)

### Archival Strategy
- Cold storage for historical data
- Compressed backups for long-term retention
- Data anonymization for analytics

## Compliance

### Data Protection
- GDPR compliance for EU customers
- Data anonymization capabilities
- Right to be forgotten implementation

### Financial Compliance
- Audit trail requirements
- Data integrity validation
- Regulatory reporting support