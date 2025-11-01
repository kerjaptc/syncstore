# Implementation Plan - SyncStore Phase 2

## Overview

Phase 2 implementation follows a 2-week (10 working days) plan focused on product synchronization.

**Week 1 (Days 1-5):** Manual Sync Pilot - Build dashboard UI and test manual sync with 2 products
**Week 2 (Days 6-10):** Automated Batch Sync - Implement job queue system and test with 10-50 products

**Success Criteria:** 50 products synced perfectly to Shopee & TikTok with 100% accuracy

---

## WEEK 1: MANUAL SYNC PILOT

### Task 1: Dashboard UI Foundation (Days 1-2)

Build the core dashboard interface for viewing and managing products.

- [ ] 1.1 Create product list page with pagination
  - Build product table component with columns: ID, Title, Master Price, Shopee Price, TikTok Price, Status
  - Implement pagination (max 50 products per page)
  - Add search functionality for product titles
  - Use Next.js 15 App Router at `src/app/dashboard/products/`
  - Use shadcn/ui components and Tailwind CSS v4
  - _Requirements: 1.1, 1.2, 1.4_

- [ ] 1.2 Create product detail page
  - Display master fields section (title, description, images, weight, base price)
  - Display Shopee mapping section (item_id, final price, SEO title, category)
  - Display TikTok mapping section (product_id, final price, SEO title, Tokopedia status)
  - Show sync status and last synced timestamp
  - _Requirements: 1.3_

- [ ] 1.3 Implement responsive design
  - Ensure mobile-responsive layout
  - Test on desktop and mobile viewports
  - Add loading states and error boundaries
  - Verify no console errors
  - _Requirements: 1.5_

---

### Task 2: Manual Sync Button (Day 3)

Implement manual sync functionality with UI and backend endpoint.

- [ ] 2.1 Add sync buttons to product detail page
  - Create "Sync to Shopee" button
  - Create "Sync to TikTok" button
  - Create "Sync to Both" button
  - Display sync status: "Not Synced", "Syncing...", "Synced", "Error"
  - _Requirements: 2.1, 2.2_

- [ ] 2.2 Create manual sync API endpoint
  - Implement POST /api/sync/manual endpoint
  - Accept input: product_id and target_platform
  - Return output: success, sync_id, platform, message, data
  - Apply pricing calculation (Shopee x1.15, TikTok x1.20)
  - Apply SEO title variations (70-80% similar, 20-30% different)
  - _Requirements: 2.3, 2.5_

- [ ] 2.3 Implement sync logging
  - Log every sync request to sync_logs table
  - Include: timestamp, product_id, platform, status, request_payload, response_payload
  - Log errors with error_message and error_code
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 2.4 Add error handling
  - Handle errors: INVALID_PRODUCT, RATE_LIMITED, NETWORK_ERROR, UNAUTHORIZED
  - Return clear error messages
  - Display errors in UI with helpful context
  - _Requirements: 2.4, 7.5_

---

### Task 3: Pilot Test with 2 Products (Days 4-5)

Test manual sync workflow with 2 products to validate the system.

- [ ] 3.1 Select and prepare test products
  - Select Product A: Simple product without variants
  - Select Product B: Product with variants
  - Verify both products exist in master catalog
  - _Requirements: 3.1_

- [ ] 3.2 Test manual sync to Shopee
  - Sync Product A to Shopee
  - Verify in Shopee seller center: title, price, description, images
  - Sync Product B to Shopee
  - Verify all variants synced correctly
  - _Requirements: 3.2, 3.4_

- [ ] 3.3 Test manual sync to TikTok
  - Sync Product A to TikTok
  - Verify in TikTok Shop seller center: title, price, Tokopedia auto-included
  - Sync Product B to TikTok
  - Verify all variants synced correctly
  - _Requirements: 3.3, 3.4_

- [ ] 3.4 Document test results
  - Create test report with success/failure for each product and platform
  - Document findings: pricing correct, SEO titles applied, no data loss
  - List any issues found
  - Get owner approval before proceeding to Week 2
  - _Requirements: 3.5_

---

## WEEK 2: AUTOMATED BATCH SYNC

### Task 4: Job Queue Setup (Day 6)

Set up BullMQ job queue system for automated batch synchronization.

- [ ] 4.1 Install and configure dependencies
  - Install BullMQ and Redis client
  - Configure Redis connection
  - Set environment variables: REDIS_HOST, REDIS_PORT
  - _Requirements: 4.1_

- [ ] 4.2 Create sync queue service
  - Create src/lib/queue/syncQueue.ts
  - Initialize BullMQ Queue with connection config
  - Define SyncJob interface
  - _Requirements: 4.1_

- [ ] 4.3 Create sync worker
  - Create src/lib/queue/syncWorker.ts
  - Implement Worker to process sync jobs
  - Fetch product from master catalog
  - Push to Shopee/TikTok API
  - Log result and return success/error
  - _Requirements: 4.1, 4.4_

- [ ] 4.4 Create batch sync API endpoint
  - Implement POST /api/sync/batch endpoint
  - Accept input: product_ids and platform
  - Queue jobs with retry config: 3 attempts, exponential backoff
  - Return batch_id and total_jobs count
  - _Requirements: 4.2, 4.4_

---

### Task 5: Logging & Progress Tracking (Day 7)

Implement job status tracking and real-time progress monitoring.

- [ ] 5.1 Create sync_logs database table
  - Create migration for sync_logs table
  - Add columns and indexes
  - _Requirements: 7.1_

- [ ] 5.2 Implement job status tracking
  - Create src/lib/queue/jobStatus.ts
  - Define JobStatus interface
  - Implement GET /api/sync/batch/status endpoint
  - Return real-time job status
  - _Requirements: 4.4_

- [ ] 5.3 Build progress bar UI
  - Create progress bar component
  - Display failed count
  - Show status badge
  - Update in real-time
  - _Requirements: 4.5_

- [ ] 5.4 Log all sync operations to database
  - Log every job to sync_logs table
  - Include request and response payloads
  - Track job attempts and errors
  - _Requirements: 7.2, 7.3_

---

### Task 6: Error Handling & Retry Logic (Day 8)

Implement robust error handling with retry strategies.

- [ ] 6.1 Implement retry strategy
  - Configure retry settings
  - Define retryable errors
  - Define non-retryable errors
  - _Requirements: 4.2_

- [ ] 6.2 Implement error recovery logic
  - Catch specific errors and handle appropriately
  - Retry retryable errors with exponential backoff
  - Mark non-retryable errors as failed immediately
  - _Requirements: 4.2_

- [ ] 6.3 Create dead-letter queue
  - Move failed jobs to dead-letter queue
  - Log failures
  - Provide manual review interface
  - _Requirements: 4.3_

- [ ] 6.4 Test error scenarios
  - Test rate limit handling
  - Test network errors with retry
  - Test invalid product errors
  - Verify dead-letter queue functionality
  - _Requirements: 4.2, 4.3_

---

### Task 7: Batch Test (10-50 Products) (Day 9)

Test batch sync system with increasing product counts.

- [ ] 7.1 Test batch sync with 10 products
  - Select 10 products
  - Run batch sync
  - Monitor job queue processing
  - Verify 100% success rate
  - Check average sync time per product
  - _Requirements: 5.1_

- [ ] 7.2 Verify results in marketplaces
  - Spot-check 3 random products from batch
  - Verify in Shopee and TikTok
  - Check for any data corruption
  - _Requirements: 5.4_

- [ ] 7.3 Scale to 50 products
  - Select 50 products for batch sync
  - Run batch sync
  - Monitor performance and errors
  - Verify 100% success rate
  - _Requirements: 5.1, 5.5_

- [ ] 7.4 Spot-check 5 random products
  - Verify 5 random products in both marketplaces
  - Confirm all data is correct
  - Document any issues found
  - _Requirements: 5.4_

- [ ] 7.5 Generate batch test report
  - Document metrics
  - Include spot-check results
  - List any issues encountered
  - Provide performance assessment
  - _Requirements: 5.5_

---

### Task 8: Comprehensive Validation & Rollback Plan (Day 10)

Perform final validation checks and create rollback plan.

- [ ] 8.1 Validate pricing accuracy
  - Query database for pricing mismatches
  - Result should be 0
  - _Requirements: 6.1_

- [ ] 8.2 Validate SEO titles
  - Verify Shopee SEO titles similarity
  - Verify TikTok SEO titles similarity
  - Confirm no exact duplicates between platforms
  - _Requirements: 6.2_

- [ ] 8.3 Validate platform mappings
  - Verify all synced products have Shopee mapping
  - Verify all synced products have TikTok mapping
  - Confirm no missing or null external IDs
  - _Requirements: 6.3_

- [ ] 8.4 Validate images
  - Check all product images are accessible
  - Verify at least 3 images per product
  - Confirm images match across platforms
  - _Requirements: 6.4_

- [ ] 8.5 Create rollback plan
  - Document partial rollback procedure
  - Document full rollback procedure
  - Create rollback SQL scripts
  - Test rollback procedure
  - _Requirements: 6.5_

- [ ] 8.6 Generate Phase 2 completion report
  - Document all validation results
  - List success metrics
  - Provide recommendations for Phase 3
  - Get owner approval
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

---

## Critical Guardrails

**DO NOT work on these (out of scope for Phase 2):**
- Order management
- Analytics/reporting
- Finance calculations
- Webhook integration
- Conflict resolution
- Advanced features

**MUST follow these rules:**
- Test with 2 products manually before automating
- Test with 10 products before scaling to 50
- Never sync all 4,147 products at once
- Fix errors before scaling
- Create backup before batch sync
- Get owner approval before proceeding to next phase

---

## Success Metrics

**End of Week 1 (Day 5):**
- Dashboard UI complete and responsive
- Manual sync working (2 products tested successfully)
- Pricing verified correct
- SEO titles verified correct
- Owner approves test results

**End of Week 2 (Day 10):**
- BullMQ job queue implemented and working
- Batch sync tested (10 products: 100% success)
- Batch sync scaled (50 products: 100% success)
- Error handling and retry logic working
- Comprehensive validation passed
- Rollback plan documented and tested
- Owner approval received
- Ready for Phase 3

---

## Notes

- All tasks must be completed in order as they build upon each other
- Testing is more important than speed
- Document all findings and issues for future reference
- Do not commit till phase2 finished anda tested wothout error
