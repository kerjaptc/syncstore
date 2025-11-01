# SyncStore - Agent Development Guide
## Project Context & Implementation Strategy

**Project Version:** 1.0  
**Date:** November 1, 2025  
**Status:** Phase 1 - Data Import & Analysis  
**Target Audience:** AI Agent (Kiro) + Development Team  

---

## Table of Contents

1. [Project Context & Business Model](#1-project-context--business-model)
2. [Current Development Status](#2-current-development-status)
3. [Phase 1: Data Import & Master Schema Design](#3-phase-1-data-import--master-schema-design)
4. [API Credential Management](#4-api-credential-management)
5. [Development Workflow & Process](#5-development-workflow--process)
6. [Testing Checklist](#6-testing-checklist)
7. [Troubleshooting Guide](#7-troubleshooting-guide)
8. [Success Criteria & Validation](#8-success-criteria--validation)

---

## 1. Project Context & Business Model

### 1.1 Business Overview

**Project Name:** SyncStore (Personal Edition)  
**Business Type:** 3D Printing Services for FPV Drone Parts  
**Business Age:** 3 years (established local business)  
**Primary Pain Point:** Manual product synchronization across multiple marketplace platforms  

**Platforms to Manage:**
```
Shopee
├─ 1 Store (motekarfpv shop)
├─ ~500 products with variants
├─ Current revenue source (primary)
└─ Current status: Active, running 3 years

TikTok Shop
├─ 1 Store (motekarfpv shop)
├─ Tokopedia integration (automatic, checkbox enabled)
├─ Growing audience (younger demographic)
└─ Current status: Active, synced manually

Website (Future)
├─ motekarfpv.com (domain ready)
├─ Brand consolidation
├─ Higher margin (no marketplace fees)
└─ Current status: Planned Phase 3

Future Platforms (Post-MVP)
├─ Lazada
├─ Blibli
├─ TOCO
└─ Other potential marketplaces
```

### 1.2 Business Model - Pricing Strategy

**Product Type:** Pre-order 3D Printed Parts (5-day delivery promise, actual 1-3 days)

**Master Price Structure:**
```
Master Price = Cost + Margin

Platform-Specific Pricing:
├─ Shopee Price = Master Price × 1.15 (15% marketplace fee)
├─ TikTok Shop Price = Master Price × 1.20 (20% marketplace fee)
├─ Website Price = Master Price (0% fee = competitive advantage)
└─ Future platforms = Master Price × (1 + Platform Fee %)

Example:
├─ Master Price: Rp 150,000
├─ Shopee: Rp 172,500 (+15%)
├─ TikTok: Rp 180,000 (+20%)
└─ Website: Rp 150,000 (Direct sales, higher margin)
```

**Key Features:**
- Dynamic pricing based on platform fees
- Single source of truth (master catalog)
- Easy fee adjustment when marketplace policies change
- SEO-optimized titles per platform (slight variations to avoid duplicate detection)
- Inventory linked to pre-order workflow

### 1.3 Current Data Situation

**Data Status:**
- 90% of product data is identical across Shopee and TikTok Shop
- Manual updates: Sometimes updated in Shopee only, sometimes in TikTok only
- Sync Issues: Discrepancies when busy, forgotten manual syncs
- Need: Centralized product master with automatic synchronization

**Current Workflow Issues:**
```
Current Manual Process (Problem):
Input data in Shopee → (Maybe) update TikTok → (Maybe) update Tokopedia
                           ↓
                    Often forgotten/delayed
                           ↓
                    Data inconsistency
                           ↓
                    Customer confusion, overselling risk

Desired SyncStore Process (Solution):
Input data in SyncStore Master → Auto-sync to Shopee → Auto-sync to TikTok/Tokopedia
                                         ↓
                              All platforms synchronized
                                         ↓
                              Single source of truth
                                         ↓
                              Data consistency guaranteed
```

### 1.4 Reference Model

**Inspiration:** BigSeller (Enterprise Solution)
```
BigSeller = Complex, feature-rich, monthly subscription
SyncStore = Personal Mini Version, focused on FPV business needs

Key Differences:
├─ Scope: 500 products vs 100,000+
├─ Cost: No monthly fee vs subscription model
├─ Features: Focused essentials vs everything
├─ Customization: Built for FPV needs vs generic solution
├─ Performance: Lightweight vs heavy
└─ Control: 100% owned vs third-party dependent
```

---

## 2. Current Development Status

### 2.1 Repository Information

**GitHub:** https://github.com/crypcodes/syncstore  
**Status:** Shopee Integration 85% Complete  
**Technology Stack:**
- Framework: Next.js 15 (App Router)
- Language: TypeScript 5.x
- Database: PostgreSQL (Neon)
- ORM: Drizzle
- Auth: Clerk
- UI: Tailwind CSS v4 + shadcn/ui

### 2.2 Completed Features

✅ **Core Infrastructure (95%)**
- Authentication system (Clerk integration)
- Database setup (Drizzle ORM)
- API routes and middleware
- Security encryption for credentials
- Multi-tenant isolation with RBAC
- Sentry error monitoring

✅ **Shopee Integration (85%)**
- OAuth authentication flow implemented
- Store connection management
- UI components for store setup
- API adapter pattern (extensible)
- Credential encryption

✅ **Modern Dashboard Foundation**
- Responsive UI layout
- Store management interface
- Component library (shadcn/ui)

### 2.3 In Development / Pending

🔄 **Shopee Product Sync (15% remaining)**
- API integration for product fetching
- Data mapping implementation
- Sync status tracking
- Error handling refinement

❌ **TikTok Shop Integration (0%)**
- API adapter needs creation
- OAuth flow setup
- Tokopedia integration strategy

📋 **Master Catalog System (Design phase)**
- Schema for universal vs platform-specific fields
- Data import and validation
- Mapping strategy documentation

### 2.4 Project Architecture

```
SyncStore Architecture:

┌─────────────────────────────────────────────────────┐
│              PRESENTATION LAYER                      │
│  Dashboard | Product List | Sync Status | Settings  │
└────────────────────┬────────────────────────────────┘
                     │ tRPC
                     ▼
┌─────────────────────────────────────────────────────┐
│              API LAYER                               │
│  Authentication | Rate Limiting | Request Routing   │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│           BUSINESS LOGIC LAYER                       │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐  │
│  │Store Service │ │Product Sync  │ │Order Service│  │
│  └──────────────┘ └──────────────┘ └─────────────┘  │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│        PLATFORM ADAPTER LAYER                        │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐  │
│  │ShopeeAdapter │ │TikTokAdapter │ │WebAdapter   │  │
│  └──────────────┘ └──────────────┘ └─────────────┘  │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│       DATABASE & PERSISTENCE LAYER                   │
│  PostgreSQL | Redis (future) | File Storage         │
└─────────────────────────────────────────────────────┘

External Connections:
├─ Shopee API (open.shopee.com)
├─ TikTok Shop API (open-api.tiktokglobalshop.com)
└─ Website API (future: motekarfpv.com)
```

---

## 3. Phase 1: Data Import & Master Schema Design

### 3.1 Phase 1 Objectives

**Goal:** Create a unified master product catalog by importing and analyzing existing data

**Success Metric:**
- Successfully import all products from Shopee and TikTok Shop
- Identify field mapping (common vs platform-specific)
- Design master schema that covers both platforms
- Ready for Phase 2 testing with 1-2 sample products

### 3.2 Step-by-Step Process

#### Step 1: Data Analysis & Field Mapping

**Objective:** Understand data structure in both platforms

**Action Items:**
1. Extract product data from Shopee API
   - Use endpoint: `/v2/product/get_item_list`
   - Fetch: product_id, title, description, images, price, weight, dimensions, variants
   
2. Extract product data from TikTok Shop API
   - Use endpoint: `/api/products/search`
   - Fetch: product_id, title, description, images, price, weight, dimensions, variants

3. Compare field structures
   - Create mapping spreadsheet or JSON
   - Identify: common fields, platform-specific fields, data format differences

**Expected Output:**
```
Field Mapping Example:

Common Fields (Both Platforms):
├─ product_title / name ✓
├─ product_description ✓
├─ images / product_images ✓
├─ base_price / price ✓
├─ weight ✓
├─ dimensions ✓
├─ category ✓
└─ variants / variations ✓

Shopee-Specific Fields:
├─ shopee_item_id
├─ shopee_category_id
├─ shopee_shop_id
└─ logistics_template_id

TikTok-Specific Fields:
├─ tiktok_product_id
├─ tiktok_category_id
├─ fulfillment_type
└─ tokopedia_included (boolean)
```

#### Step 2: Master Schema Design

**Objective:** Create a universal data structure

**Master Product Schema (Proposed):**
```typescript
interface MasterProduct {
  // Universal Fields (required for all platforms)
  id: string;
  sku: string; // Internal master SKU
  title: string;
  description: string;
  images: {
    url: string;
    alt: string;
    primary: boolean;
  }[];
  
  // Pricing
  basePrice: number; // Master price (no platform fee)
  cost: number; // For margin calculation
  weight: number; // kg
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  
  // Categorization
  category: string;
  subcategory?: string;
  tags: string[];
  
  // Variants (if applicable)
  variants: {
    variantId: string;
    name: string; // e.g., "Color: Red, Size: Large"
    sku: string; // Variant-specific SKU
    attributes: Record<string, string>; // {color: "red", size: "large"}
    price?: number; // If variant has different price
    weight?: number;
  }[];
  
  // Platform Mappings
  platformMappings: {
    shopee?: {
      itemId: string;
      categoryId: string;
      shopId: string;
      variantMappings: {
        masterVariantId: string;
        shopeeModelId: string;
      }[];
      logisticsTemplate: string;
      seoTitle: string; // SEO optimized, slight variation
      finalPrice: number; // basePrice * 1.15
      lastSyncAt: Date;
      syncStatus: 'pending' | 'synced' | 'error';
    };
    
    tiktokshop?: {
      productId: string;
      categoryId: string;
      variantMappings: {
        masterVariantId: string;
        tiktokVariantId: string;
      }[];
      includeTokenpedia: boolean; // Auto-sync to Tokopedia
      seoTitle: string; // SEO optimized, slight variation
      finalPrice: number; // basePrice * 1.20
      lastSyncAt: Date;
      syncStatus: 'pending' | 'synced' | 'error';
    };
    
    website?: {
      slug: string; // For URL: motekarfpv.com/products/{slug}
      finalPrice: number; // basePrice (no fee)
      customFields: {
        printTime: string; // e.g., "2-3 days"
        material: string; // e.g., "PLA+"
      };
    };
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'inactive' | 'archived';
}
```

#### Step 3: Data Import & Validation

**Objective:** Populate master catalog with existing products

**Process:**
1. Run import script from Shopee API
2. Run import script from TikTok Shop API
3. Validate data integrity
4. Identify missing or corrupt data
5. Create import report (success/errors)

**Expected Output:**
- Master catalog table populated with ~500 products
- Import log with any errors or warnings
- Data validation report

#### Step 4: SEO Title Generation Strategy

**Objective:** Create platform-specific titles to avoid duplicate detection

**Strategy:**
```
Master Title: "Frame Racing Drone 5 Inch Carbon Fiber"

Shopee Title: "Frame 5 Inch Drone Racing Carbon Fiber Ringan [Stok Ready]"
(Added: "Ringan" (light), "[Stok Ready]" for urgency)

TikTok Title: "Racing Frame 5 Inch Carbon - Ringan & Kuat"
(Added: "Kuat" (strong), formatted for TikTok audience)

Website Title: "5-Inch Racing Drone Frame - Premium Carbon Fiber"
(Professional, SEO-friendly for long-tail keywords)
```

**Rule of Thumb:**
- 70-80% similar (for search consistency)
- 20-30% unique variations (for platform algorithms)
- Keywords maintained across all versions
- No exact duplication to avoid search penalties

### 3.3 Master Schema Implementation

**Database Table Changes Needed:**
```sql
-- Modify products table to include platform mappings
ALTER TABLE products ADD COLUMN platform_mappings JSONB DEFAULT '{}';
ALTER TABLE products ADD COLUMN seo_title_shopee VARCHAR(255);
ALTER TABLE products ADD COLUMN seo_title_tiktokshop VARCHAR(255);
ALTER TABLE products ADD COLUMN base_price DECIMAL(12,2);
ALTER TABLE products ADD COLUMN sync_status VARCHAR(50) DEFAULT 'pending';

-- Add sync tracking
CREATE TABLE product_sync_log (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  platform VARCHAR(50), -- 'shopee', 'tiktokshop'
  sync_type VARCHAR(50), -- 'import', 'update', 'push'
  status VARCHAR(50), -- 'pending', 'success', 'error'
  error_message TEXT,
  synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 4. API Credential Management

### 4.1 Required Credentials

#### Shopee API Credentials

**Location:** Shopee Open Platform (https://open.shopee.com)

```env
# Required for Shopee integration
SHOPEE_PARTNER_ID="your_partner_id"
SHOPEE_PARTNER_KEY="your_partner_key"
SHOPEE_SANDBOX_MODE=false # Set to true for testing

# These will be obtained via OAuth callback:
# SHOPEE_SHOP_ID (saved per store connection)
# SHOPEE_ACCESS_TOKEN (saved encrypted per store)
# SHOPEE_REFRESH_TOKEN (saved encrypted per store)
```

**Setup Steps:**
1. Log in to https://open.shopee.com/console
2. Create new app → Select "ERP System" category
3. Copy Partner ID and Partner Key
4. Set redirect URI: `https://yourdomain.com/api/shopee/callback`
5. Submit for review (typically 1-3 days approval)

**Shopee API Documentation:**
- Base URL: `https://partner.shopeemobile.com/api/v2`
- Auth Method: OAuth 2.0 + HMAC-SHA256 signing
- Rate Limit: ~100 requests/minute
- Reference: https://open.shopee.com/developer-guide/27

#### TikTok Shop API Credentials

**Location:** TikTok Shop Partner Center (https://partner.tiktokshop.com)

```env
# Required for TikTok Shop integration
TIKTOK_SHOP_APP_KEY="your_app_key"
TIKTOK_SHOP_APP_SECRET="your_app_secret"
TIKTOK_SHOP_SANDBOX_MODE=false

# These will be obtained via OAuth:
# TIKTOK_SHOP_ID (saved per store)
# TIKTOK_SHOP_ACCESS_TOKEN (saved encrypted)
# TIKTOK_SHOP_REFRESH_TOKEN (saved encrypted)
```

**Setup Steps:**
1. Log in to https://partner.tiktokshop.com
2. Register as ISV/Developer
3. Create new application
4. Set redirect URI: `https://yourdomain.com/api/tiktokshop/callback`
5. Enable Tokopedia integration (checkbox: "Include Tokopedia")
6. Request production access

**TikTok Shop API Documentation:**
- Base URL: `https://open-api.tiktokglobalshop.com`
- Auth Method: OAuth 2.0
- Rate Limit: TBD (check Partner Center)
- Reference: https://partner.tiktokshop.com/docv2/page/tts-developer-guide

### 4.2 Environment Configuration

**File:** `.env.local` (Never commit to Git)

```env
# ============================================
# AUTHENTICATION & SECURITY
# ============================================
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
ENCRYPTION_KEY=your-32-character-encryption-key-here

# ============================================
# DATABASE
# ============================================
DATABASE_URL=postgresql://user:password@host:5432/syncstore_db

# ============================================
# SHOPEE API
# ============================================
SHOPEE_PARTNER_ID=your_partner_id
SHOPEE_PARTNER_KEY=your_partner_key
SHOPEE_SANDBOX_MODE=true # true for testing, false for production

# ============================================
# TIKTOK SHOP API
# ============================================
TIKTOK_SHOP_APP_KEY=your_app_key
TIKTOK_SHOP_APP_SECRET=your_app_secret
TIKTOK_SHOP_SANDBOX_MODE=true

# ============================================
# MONITORING & LOGGING
# ============================================
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_ENVIRONMENT=development

# ============================================
# REDIS (Optional, for future queue system)
# ============================================
REDIS_URL=redis://localhost:6379

# ============================================
# APPLICATION
# ============================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### 4.3 Security Best Practices

**Critical Rules:**
1. ❌ Never commit `.env.local` to Git
2. ✅ Add `.env.local` to `.gitignore`
3. ✅ Always use `ENCRYPTION_KEY` for sensitive credentials
4. ✅ Rotate credentials monthly
5. ✅ Use different credentials for dev/staging/production
6. ✅ Keep partner keys in secure environment variables only
7. ✅ Never log full tokens (truncate in logs)

**Credential Encryption Pattern:**
```typescript
// In your credential storage code:
const encryptedToken = encryptCredential(accessToken, organizationId);
// Store encryptedToken in database

// When retrieving:
const decryptedToken = decryptCredential(encryptedToken, organizationId);
// Use decryptedToken for API calls
```

---

## 5. Development Workflow & Process

### 5.1 Recommended Development Process

**Phase 1 Workflow:**

```
Week 1: Analysis & Planning
├─ Day 1-2: Field mapping analysis (manual spreadsheet)
├─ Day 3-4: Master schema design review
└─ Day 5: Environment setup & credential configuration

Week 2: Data Import Implementation
├─ Day 1-2: Shopee import API integration
├─ Day 3: Data validation & error handling
└─ Day 4-5: TikTok Shop import API integration

Week 3: Schema Creation & Mapping
├─ Day 1-2: Database schema modifications
├─ Day 3: Master product record creation
├─ Day 4: Platform mapping logic
└─ Day 5: Data import validation report

Week 4: Testing & Refinement
├─ Day 1-2: Import accuracy testing
├─ Day 3-4: Error handling refinement
└─ Day 5: Documentation & handoff to Phase 2
```

### 5.2 Daily Development Checklist

**Before Starting:**
- [ ] Pull latest changes from `develop` branch
- [ ] Check for environment variable issues: `npm run diagnose:env`
- [ ] Verify database connectivity: `npm run diagnose:db`
- [ ] Review task requirements and acceptance criteria

**During Development:**
- [ ] Follow TypeScript strict mode
- [ ] Add tests for new functionality
- [ ] Run linter: `npm run lint:fix`
- [ ] Keep commits focused and atomic
- [ ] Write descriptive commit messages

**Before Committing:**
- [ ] Run full test suite: `npm run test`
- [ ] Type check: `npm run type-check`
- [ ] Run linter: `npm run lint`
- [ ] Verify no console errors
- [ ] Test with real API data when possible

**Commit Format:**
```bash
git commit -m "feat: import Shopee products via API

- Implement /v2/product/get_item_list integration
- Add data validation and error handling
- Create import progress tracking
- Handle pagination for large catalogs

Closes #123"
```

### 5.3 Git Workflow

**Branching Strategy:**
```
main (production-ready)
└─ develop (integration branch)
   ├─ feature/shopee-import
   ├─ feature/tiktok-adapter
   └─ feature/master-schema
```

**Pull Request Process:**
1. Create feature branch from `develop`
2. Make commits (small, focused)
3. Open PR with description
4. Request review
5. Address feedback
6. Merge when approved
7. Delete feature branch

### 5.4 Communication & Status Updates

**Daily Status Format:**
```
📊 Development Status

✅ Completed Today:
- Field mapping analysis for products
- Shopee API integration for get_item_list

🚀 In Progress:
- Data validation schema
- Error handling implementation

🎯 Tomorrow's Plan:
- TikTok Shop API integration
- Test with sample data

⚠️ Blockers:
- None currently

📈 Progress: 35% of Phase 1
```

---

## 6. Testing Checklist

### 6.1 Data Import Testing

**Shopee Import Test:**
- [ ] Successfully authenticate with Shopee API
- [ ] Fetch product list (paginate through all ~500 products)
- [ ] Validate field extraction (title, description, price, images)
- [ ] Handle variants correctly
- [ ] Log any data errors or missing fields
- [ ] Count: X products imported successfully
- [ ] Count: Y products with errors/warnings

**TikTok Shop Import Test:**
- [ ] Successfully authenticate with TikTok Shop API
- [ ] Fetch product list (all products)
- [ ] Validate field extraction
- [ ] Handle Tokopedia integration flag
- [ ] Verify variant mapping
- [ ] Log any data discrepancies
- [ ] Count: X products imported successfully

**Data Consistency Test:**
- [ ] Compare product count: Shopee vs TikTok vs Database
- [ ] Cross-check variant count
- [ ] Verify image URLs are accessible
- [ ] Check for duplicate SKUs in master catalog
- [ ] Validate price ranges (no negative or zero prices)

### 6.2 Schema Validation Testing

**Master Schema Test:**
- [ ] All required fields populated (title, description, images, price)
- [ ] Optional fields handled correctly
- [ ] Variants linked properly
- [ ] Platform mappings correct
- [ ] Pricing calculations accurate

**Example Test Data:**
```
Product: "Frame Racing 5 Inch"
├─ Master Price: Rp 150,000
├─ Shopee Price: Rp 172,500 (✓ correct: 150,000 * 1.15)
├─ TikTok Price: Rp 180,000 (✓ correct: 150,000 * 1.20)
├─ Variants: Red, Blue, Black (✓ all mapped)
└─ Images: 3 images present (✓ all accessible)
```

### 6.3 API Integration Testing

**Shopee API Test:**
- [ ] OAuth flow complete and token stored encrypted
- [ ] Pagination works for products > 100
- [ ] Rate limiting handled (backoff on 429)
- [ ] Error responses handled gracefully
- [ ] Timeout handling (30s limit)

**TikTok Shop API Test:**
- [ ] OAuth flow complete
- [ ] Tokopedia auto-inclusion verified
- [ ] Variant structure correctly parsed
- [ ] Category mapping functional
- [ ] Error handling for API failures

### 6.4 Error Handling Testing

**Simulate Failure Scenarios:**
- [ ] API timeout → should retry with backoff
- [ ] Invalid credentials → should show clear error
- [ ] Malformed response → should log and skip
- [ ] Missing required fields → should flag in import report
- [ ] Duplicate SKUs → should merge or flag conflict

---

## 7. Troubleshooting Guide

### 7.1 Common Issues & Solutions

**Issue 1: "Authentication Failed" Error**

```
Error: SHOPEE_PARTNER_ID or SHOPEE_PARTNER_KEY not set

Solution:
1. Check .env.local for correct credentials
2. Run: npm run diagnose:env
3. Verify Partner ID format: should be numeric
4. Verify Partner Key: should be 32+ characters
5. Confirm not copying extra spaces/newlines
```

**Issue 2: "Database Connection Failed"**

```
Error: Cannot connect to PostgreSQL

Solution:
1. Check DATABASE_URL format:
   postgresql://user:password@host:port/database
2. Run: npm run diagnose:db
3. Verify database is running
4. Check network connectivity to DB host
5. Confirm user has correct permissions
```

**Issue 3: "API Rate Limited (429)"**

```
Error: Shopee API returning 429 Too Many Requests

Solution:
1. Implement exponential backoff (2s, 4s, 8s, 16s)
2. Add jitter to prevent thundering herd
3. Reduce concurrent requests
4. Check if batch operations available
5. Contact Shopee support for rate limit increase
```

**Issue 4: "Variant Mapping Mismatch"**

```
Error: Product has 3 variants in Shopee but only 2 in TikTok

Solution:
1. Review platform differences (some variants may not supported on all platforms)
2. Manually check variant settings in each marketplace
3. Update mapping logic to handle platform-specific variants
4. Document platform limitations
5. Update master schema accordingly
```

### 7.2 Diagnostic Commands

**Full System Diagnosis:**
```bash
npm run diagnose
# Checks: Environment, Database, API credentials, Dependencies
```

**Environment Check:**
```bash
npm run diagnose:env
# Verifies all required environment variables are set
```

**Database Check:**
```bash
npm run diagnose:db
# Tests PostgreSQL connection and runs migrations if needed
```

**Log Analysis:**
```bash
# Check recent error logs
tail -f logs/error.log

# Filter for API errors
grep "API_ERROR" logs/error.log

# Search for sync failures
grep "SYNC_FAILED" logs/error.log
```

### 7.3 Support & Escalation

**For Quick Issues:**
- Check troubleshooting guide first
- Run diagnostic commands
- Review recent Git commits for related changes
- Check API documentation

**For Complex Issues:**
- Document error with full error message
- Provide: steps to reproduce, expected behavior, actual behavior
- Include diagnostic output: `npm run diagnose > diag-report.txt`
- Check Sentry error dashboard for stack traces

**External Support:**
- Shopee Support: support@shopee.com
- TikTok Shop Support: Partner Center support
- Database (Neon) Support: Dashboard → Support tab

---

## 8. Success Criteria & Validation

### 8.1 Phase 1 Success Metrics

**Primary Success Criteria (Must-Have):**

- ✅ **All ~500 Shopee products imported** into master catalog
  - Validation: SELECT COUNT(*) FROM products; → ~500 records
  
- ✅ **All TikTok Shop products imported** into master catalog
  - Validation: Import log shows "500 products synced successfully"
  
- ✅ **Master schema designed and documented**
  - Validation: Master schema document reviewed and approved
  - Includes: universal fields, platform-specific fields, pricing logic
  
- ✅ **Field mapping completed**
  - Validation: Mapping spreadsheet/document complete
  - Shows: common fields, differences, handling strategy
  
- ✅ **Pricing calculation working**
  - Validation: Sample product: 150k base → 172.5k Shopee, 180k TikTok
  
- ✅ **SEO title generation strategy documented**
  - Validation: 5+ example titles with platform variations
  
- ✅ **Data validation passed**
  - No missing required fields
  - No negative/zero prices
  - All images accessible
  - Variants correctly mapped

**Secondary Success Criteria (Should-Have):**

- ℹ️ Import performance documented (time to import 500 products)
- ℹ️ Error handling validated (handles API failures gracefully)
- ℹ️ Database schema optimized (indexes added where needed)
- ℹ️ Documentation complete (API docs, database schema, troubleshooting)

**Failure Criteria (Stop-and-Fix):**

- ❌ Product data loss or corruption
- ❌ API credentials exposed in logs/commits
- ❌ Database integrity violations
- ❌ More than 5% data import errors without root cause resolution
- ❌ Security vulnerabilities discovered

### 8.2 Testing & Validation Steps

**Step 1: Verify Import Completion**
```sql
-- Check total products imported
SELECT COUNT(*) as total_products FROM products;
-- Expected: ~500

-- Check products with complete data
SELECT COUNT(*) FROM products 
WHERE title IS NOT NULL 
  AND base_price > 0 
  AND images IS NOT NULL;
-- Expected: ~500 (or close, with documented exceptions)
```

**Step 2: Validate Platform Mappings**
```sql
-- Check Shopee mappings
SELECT COUNT(*) FROM products 
WHERE platform_mappings->>'shopee' IS NOT NULL;
-- Expected: ~500 (or ~450 if some products Shopee-only)

-- Check TikTok mappings
SELECT COUNT(*) FROM products 
WHERE platform_mappings->>'tiktokshop' IS NOT NULL;
-- Expected: ~500 (or similar)
```

**Step 3: Price Calculation Test**
```sql
-- Sample product price validation
SELECT 
  title,
  base_price,
  base_price * 1.15 as shopee_price,
  base_price * 1.20 as tiktok_price
FROM products
LIMIT 1;
```

**Step 4: Manual Validation**
- [ ] Log into Shopee seller center → Count products shown
- [ ] Log into TikTok Shop seller center → Count products shown
- [ ] Compare counts with database
- [ ] Spot-check 5-10 random products for field accuracy
- [ ] Verify variant counts match

### 8.3 Sign-Off Checklist

**Before Moving to Phase 2, confirm:**

- [ ] All import testing passed
- [ ] Data validation complete (>95% success rate)
- [ ] Master schema approved by owner
- [ ] Field mapping documented
- [ ] Pricing logic verified with examples
- [ ] SEO strategy documented
- [ ] Database migrations applied
- [ ] No sensitive data in logs/commits
- [ ] Documentation updated
- [ ] Ready for Phase 2 (sync testing with 1-2 products)

---

## Appendix A: API Reference Quick Links

### Shopee
- **Developer Portal:** https://open.shopee.com
- **API Documentation:** https://open.shopee.com/developer-guide/27
- **Sandbox Testing:** https://sandbox.shopeemobile.com
- **Rate Limits:** ~100 requests/minute

### TikTok Shop
- **Partner Center:** https://partner.tiktokshop.com
- **API Documentation:** https://partner.tiktokshop.com/docv2/page/tts-developer-guide
- **Tokopedia Integration:** Enabled via checkbox in TikTok Shop settings

### Database
- **Neon Console:** https://console.neon.tech
- **Drizzle Studio:** Run locally with `npm run db:studio`

---

## Appendix B: Important Notes for Agent

### Development Mindset

**Focus on Phase 1 Only:**
- Import and understand existing data
- Design flexible master schema
- Don't implement advanced features yet
- No order management, no analytics, no website integration
- Success = 500 products in master catalog with proper mappings

**Data-Driven Approach:**
- Let real data guide schema design
- Identify patterns from actual Shopee/TikTok data
- Don't over-engineer for "future platforms" yet
- Keep it simple for now

**Testing Discipline:**
- Verify every step before moving forward
- Use diagnostic commands regularly
- Document all issues found
- Test with real data, not test data

**Communication:**
- Share daily status updates
- Flag blockers early
- Ask questions if uncertain
- Iterate based on feedback

### Key Success Factors

1. **Understand the Business:** FPV 3D printing business, preorder model, multi-platform management
2. **Respect Data:** Be careful with real production data from Shopee/TikTok
3. **Security First:** Never expose credentials, use encryption
4. **Test Everything:** Small test before full rollout
5. **Document as You Go:** Future phases will thank you

---

**Document Version:** 1.0  
**Last Updated:** November 1, 2025  
**Status:** Ready for Phase 1 Implementation  
**Next Review:** After Phase 1 completion
