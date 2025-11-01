# Requirements Document - SyncStore Phase 2

## Introduction

SyncStore Phase 2 focuses on building the product synchronization system with a web-based dashboard. Building on Phase 1's foundation (data import, master catalog, pricing system, and SEO title generation), Phase 2 will create a UI for managing products and implement both manual and automated synchronization to Shopee and TikTok Shop platforms.

**Phase 2 Scope (2 weeks):**
- Week 1: Dashboard UI + Manual sync (test with 2 products)
- Week 2: Automated batch sync with BullMQ (test with 10-50 products)

**Out of Scope for Phase 2:**
- Order management
- Analytics and reporting
- Finance calculations
- Webhook integration (future phase)
- Conflict resolution (future phase)
- Advanced features

## Glossary

- **Dashboard**: Web-based user interface for viewing and managing products
- **Manual_Sync**: User-triggered synchronization of a single product to platforms
- **Batch_Sync**: Automated synchronization of multiple products using job queue
- **Sync_Engine**: Background service using BullMQ that handles product synchronization
- **Sync_Queue**: Job queue system (BullMQ + Redis) for managing sync tasks
- **Master_Catalog**: Central product database with unified schema (from Phase 1)
- **Platform_Mapping**: Links between master products and platform-specific product IDs
- **Sync_Status**: Current synchronization state (not_synced, syncing, synced, failed)

## Requirements

### Requirement 1

**User Story:** As a business owner, I want a dashboard that displays all my products with their pricing information, so that I can view my entire inventory and sync status in one place.

#### Acceptance Criteria

1. WHEN the dashboard loads, THE SyncStore SHALL display a paginated list of all 4,147 products with maximum 50 products per page
2. WHEN viewing the product list, THE SyncStore SHALL show Product ID, Title, Master Price, Shopee Price, TikTok Price, and Sync Status for each item
3. WHEN viewing product details, THE SyncStore SHALL display master fields and platform-specific fields separately
4. WHEN searching products, THE SyncStore SHALL provide search functionality across product titles
5. THE SyncStore SHALL render the dashboard with responsive design for mobile and desktop devices

### Requirement 2

**User Story:** As a business owner, I want to manually sync products to Shopee and TikTok Shop, so that I can test the synchronization workflow before automating it.

#### Acceptance Criteria

1. WHEN viewing a product detail page, THE SyncStore SHALL provide sync buttons for Shopee, TikTok, and Both platforms
2. WHEN clicking a sync button, THE SyncStore SHALL trigger the manual sync endpoint and display status as "Syncing..."
3. WHEN sync completes successfully, THE SyncStore SHALL update the status to "Synced" and log the operation with timestamp
4. WHEN sync fails, THE SyncStore SHALL display status as "Error" and show a clear error message
5. WHEN syncing to platforms, THE SyncStore SHALL apply the correct pricing calculation (Shopee ×1.15, TikTok ×1.20) and SEO title variations

### Requirement 3

**User Story:** As a business owner, I want to test manual sync with 2 products before scaling, so that I can verify the sync workflow works correctly.

#### Acceptance Criteria

1. WHEN selecting test products, THE SyncStore SHALL allow testing with 1 simple product and 1 product with variants
2. WHEN syncing test products to Shopee, THE SyncStore SHALL push the product with correct title, price (×1.15), description, and images
3. WHEN syncing test products to TikTok, THE SyncStore SHALL push the product with correct title, price (×1.20), and auto-include Tokopedia
4. WHEN verifying in marketplaces, THE SyncStore SHALL ensure all synced data matches the master catalog with platform-specific adjustments
5. WHEN test sync completes, THE SyncStore SHALL generate a test report documenting success/failure for each product and platform

### Requirement 4

**User Story:** As a business owner, I want an automated batch sync system using job queues, so that I can sync multiple products efficiently without manual intervention.

#### Acceptance Criteria

1. WHEN batch sync is initiated, THE SyncStore SHALL use BullMQ with Redis to queue sync jobs for multiple products
2. WHEN processing sync jobs, THE SyncStore SHALL handle each product with retry logic (maximum 3 attempts with exponential backoff of 2s, 4s, 8s)
3. WHEN sync jobs fail after 3 attempts, THE SyncStore SHALL move them to a dead-letter queue for manual review
4. WHEN batch sync is running, THE SyncStore SHALL track job status (queued, processing, completed, failed) in real-time
5. WHEN batch sync completes, THE SyncStore SHALL provide a summary report showing total jobs, completed count, failed count, and duration

### Requirement 5

**User Story:** As a business owner, I want to test batch sync with 10-50 products, so that I can validate the system works at scale before syncing all 4,147 products.

#### Acceptance Criteria

1. WHEN testing with 10 products, THE SyncStore SHALL complete the batch sync with 100% success rate and average sync time under 30 seconds per product
2. WHEN scaling to 50 products, THE SyncStore SHALL complete the batch sync with 100% success rate and maintain performance under 30 seconds per product
3. WHEN batch sync runs, THE SyncStore SHALL display real-time progress showing completed count, failed count, and estimated time remaining
4. WHEN spot-checking synced products, THE SyncStore SHALL verify that 3-5 random products have correct data in both Shopee and TikTok marketplaces
5. WHEN batch sync completes, THE SyncStore SHALL generate a detailed test report with metrics (total, completed, failed, duration, average time per product)

### Requirement 6

**User Story:** As a business owner, I want comprehensive validation checks before full-scale sync, so that I can ensure data integrity and have a rollback plan if issues occur.

#### Acceptance Criteria

1. WHEN validating pricing, THE SyncStore SHALL verify 100% of synced products have correct Shopee price (base × 1.15) and TikTok price (base × 1.20)
2. WHEN validating SEO titles, THE SyncStore SHALL verify Shopee and TikTok titles are 70-80% similar to master title with 20-30% variation
3. WHEN validating mappings, THE SyncStore SHALL verify all synced products have external IDs (item_id for Shopee, product_id for TikTok) saved correctly
4. WHEN validating images, THE SyncStore SHALL verify all product images are accessible (no 404 errors) and at least 3 images exist per product
5. WHEN validation fails, THE SyncStore SHALL provide a rollback plan to restore master catalog from backup and clear sync mappings

### Requirement 7

**User Story:** As a business owner, I want sync logging and error tracking, so that I can monitor sync operations and troubleshoot issues.

#### Acceptance Criteria

1. WHEN sync operations execute, THE SyncStore SHALL log every sync request with timestamp, product_id, platform, and status to the sync_logs table
2. WHEN sync succeeds, THE SyncStore SHALL log the external_id (platform product ID), response payload, and synced_at timestamp
3. WHEN sync fails, THE SyncStore SHALL log the error message, error code, request payload, and response payload for debugging
4. WHEN viewing sync logs, THE SyncStore SHALL display logs in chronological order with filtering by date, platform, product, and status
5. WHEN sync errors occur, THE SyncStore SHALL provide clear error messages to help identify the root cause (e.g., "INVALID_PRODUCT", "RATE_LIMITED", "NETWORK_ERROR")
