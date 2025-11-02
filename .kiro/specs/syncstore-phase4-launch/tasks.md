# Implementation Plan - SyncStore Phase 4 Launch

## Overview

Phase 4 terdiri dari 8 major tasks. Setiap task memiliki clear acceptance criteria dengan Evidence. Eksekusi satu task per satu, jangan lompat ke task berikutnya tanpa approval.

---

## TASK EXECUTION

### Task 1: Database Seeding & Data Persistence

**Goal:** Dashboard menampilkan ≥10 real products yang persist setelah reload

- [ ] 1.1 Create seed script `scripts/seed-products.ts`
  - Populate 10+ real FPV drone products
  - Validate: name, price, stock, sku not null
  - Add CLI command: `npm run seed:products`
  - Log results: "✓ Seeded 10 products in Xms"
  - **Evidence:** Seeder output log, products.json sample
  - **Guardrail:** Script must be idempotent (safe to run multiple times)

- [ ] 1.2 Verify data persistence
  - Update `lib/db/products.ts` with Drizzle ORM
  - Add connection pooling and retry logic
  - Test: data persists after browser reload
  - Test: data persists after server restart
  - **Evidence:** Screenshot showing 10 products in table after reload
  - **Guardrail:** If data missing after reload, task FAILS

- [ ] 1.3 Test data layer
  - Test: seeder creates N products with all fields
  - Test: pagination works with 10+ products
  - All tests must pass
  - **Evidence:** Test report showing all pass
  - **Guardrail:** Any test failure blocks next task

---

### Task 2: API Endpoints Implementation

**Goal:** All API endpoints return real data with proper error handling

- [ ] 2.1 Products API endpoint
  - Implement GET /api/products with pagination (page, limit, search)
  - Return: {success: true, data: ProductData[], pagination: {...}}
  - Add search filter: case-insensitive name/SKU
  - Error handling: 500 if DB down, 400 if bad params
  - Log API calls with duration
  - **Evidence:** Postman screenshot with real data response
  - **Guardrail:** Response time >1s log WARNING, >5s log ERROR

- [ ] 2.2 Inventory API endpoint
  - Implement GET /api/inventory - return stock data
  - Implement PUT /api/inventory/[id] - update stock
  - Validate: stock must be non-negative
  - Return 404 if product not found
  - **Evidence:** Postman GET/PUT screenshots
  - **Guardrail:** Stock changes must be atomic

- [ ] 2.3 Sync operations API
  - POST /api/sync/start - initiate sync with unique sync_id
  - GET /api/sync/status - return progress (0-100%)
  - GET /api/sync/logs - return log entries
  - POST /api/sync/cancel - stop operation
  - **Evidence:** Postman showing status 0→100%, logs streaming
  - **Guardrail:** Sync timeout after 5min with error

- [ ] 2.4 API integration tests
  - Test /api/products returns real data
  - Test pagination works
  - Test search filter
  - Test sync endpoints
  - All tests pass, coverage >85%
  - **Evidence:** Test report all passing
  - **Guardrail:** Any failure blocks deployment

---

### Task 3: Sync Engine Implementation

**Goal:** Functional sync with progress tracking and logging

- [ ] 3.1 Core sync engine
  - Create `lib/services/syncService.ts`
  - Implement: start(), getStatus(), getLogs(), cancel()
  - State machine: QUEUED → RUNNING → COMPLETED/FAILED/CANCELLED
  - Track progress: {total, completed, failed, percentage}
  - Generate unique sync_id
  - **Evidence:** Console showing state transitions, progress updates
  - **Guardrail:** Sync for 10 products <2min

- [ ] 3.2 Sync logging system
  - Structured logging: [HH:MM:SS] [LEVEL] [COMPONENT] message
  - Levels: DEBUG, INFO, WARN, ERROR
  - Events: SyncStart, ProductSyncStart, ProductSyncSuccess, ProductSyncFailed, SyncCompleted
  - Store logs in memory (max 1000)
  - Provide getLogs() with filter/search
  - **Evidence:** Log file sample, filter screenshot
  - **Guardrail:** No log truncation, full context preserved

- [ ] 3.3 Batch operations
  - Implement checkbox selection in UI
  - Add "Select All" / "Deselect All"
  - Show count: "X products selected"
  - Batch sync: process all selected
  - Show progress: "X of Y completed"
  - **Evidence:** Screenshot batch selection + progress
  - **Guardrail:** Atomic batch (all succeed or rollback)

- [ ] 3.4 Sync operation tests
  - Test sync creates unique sync_id
  - Test progress updates correctly
  - Test error handling
  - Test batch processing
  - Test cancellation
  - Coverage >80%
  - **Evidence:** Test report all passing
  - **Guardrail:** Tests must pass 3x (no flaky tests)

---

### Task 4: Error Handling System

**Goal:** Comprehensive error handling with no uncaught errors

- [ ] 4.1 Error boundary components
  - Implement React ErrorBoundary
  - Fallback UI: "Something went wrong" + reload button
  - Apply to Dashboard, ProductsTable, SyncPanel
  - Test by simulating error
  - **Evidence:** Screenshot error boundary fallback
  - **Guardrail:** App must NOT crash

- [ ] 4.2 Session & auth management
  - Monitor Clerk token expiration
  - Auto-refresh 5min before expiry
  - Handle failure: show "Session expired" modal
  - Validate session on every API call
  - **Evidence:** Console showing token refresh logs
  - **Guardrail:** Expired session must not crash app

- [ ] 4.3 Error logging system
  - Create Logger service with levels: ERROR, WARN, INFO, DEBUG
  - Log: timestamp, component, message, stack trace, context
  - Store in console + persistent storage
  - Categorize: API_ERROR, AUTH_ERROR, DB_ERROR, UI_ERROR, SYNC_ERROR
  - Export logs as JSON
  - **Evidence:** Log samples all error types
  - **Guardrail:** Log before displaying to user

- [ ] 4.4 Error handling tests
  - Test error boundary catches render error
  - Test network error triggers retry
  - Test expired token triggers re-login
  - Test DB down shows friendly message
  - All tests passing
  - **Evidence:** Test report all passing
  - **Guardrail:** Each error type has test

---

### Task 5: Frontend Dashboard Integration

**Goal:** Functional dashboard displaying ≥10 real products

- [ ] 5.1 Products table with real data
  - Create table: Checkbox | ID | Name | Price | Stock | Status | Last Sync | Actions
  - Display real data from /api/products
  - Sortable columns: name, price, stock
  - Status badges: green (synced), yellow (pending), red (error)
  - **Evidence:** Screenshot table with 10+ products
  - **Guardrail:** Must NOT show "No products found"

- [ ] 5.2 Pagination system
  - Controls: Previous | Page X of Y | Next
  - Page size selector: 10, 20, 50
  - Show total: "Showing 1-20 of 125 products"
  - Update URL params: ?page=2&limit=20
  - **Evidence:** Screenshot pagination controls
  - **Guardrail:** Must work with >50 products

- [ ] 5.3 Real-time search
  - Search input with 300ms debounce
  - Show count: "Found X products"
  - Clear button resets search
  - Reset to page 1 on search
  - **Evidence:** Screenshot search filtering
  - **Guardrail:** Case-insensitive name/SKU search

- [ ] 5.4 Batch selection interface
  - Checkbox column + header "Select All"
  - Show count: "X selected"
  - Batch actions: Sync | Update | Delete
  - Confirmation dialog before batch sync
  - **Evidence:** Screenshot batch selection + sync
  - **Guardrail:** Actions disabled until items selected

- [ ] 5.5 Dashboard component tests
  - Test table renders real data
  - Test pagination works
  - Test search filters
  - Test batch selection
  - All tests passing
  - **Evidence:** Test report all passing
  - **Guardrail:** Responsive at 375px mobile

---

### Task 6: Monitoring & Logging System

**Goal:** Operational monitoring with log viewer

- [ ] 6.1 Centralized logging service
  - Implement Logger: debug(), info(), warn(), error()
  - Format: [HH:MM:SS] [LEVEL] [COMPONENT] message
  - Store in-memory: max 1000 entries
  - Export as JSON
  - **Evidence:** Logger console output, export sample
  - **Guardrail:** No sensitive data in logs

- [ ] 6.2 Performance monitoring
  - Track API response times
  - Log slow endpoints: >1s WARN, >5s ERROR
  - Track component render time
  - Log memory usage
  - **Evidence:** Performance metrics screenshot
  - **Guardrail:** Slow operations must be logged

- [ ] 6.3 Real-time monitoring interface
  - Log viewer drawer (right side)
  - Show last 100 logs
  - Filter by level/component
  - Search by keyword
  - Auto-scroll new logs
  - Export button
  - **Evidence:** Screenshot log viewer with events
  - **Guardrail:** Must not block main UI

- [ ] 6.4 Monitoring system tests
  - Test logger captures all levels
  - Test logs persist
  - Test performance monitoring
  - Test log export
  - All tests passing, >80% coverage
  - **Evidence:** Test report all passing
  - **Guardrail:** Logging must not slow app

---

### Task 7: Owner Testing Documentation

**Goal:** Complete testing guide for owner to test independently

- [ ] 7.1 Step-by-step testing guide
  - Write OWNER-GUIDE.md with numbered steps
  - Workflow 1: View products → search → pagination
  - Workflow 2: Select products → sync → monitor progress
  - Workflow 3: View logs → filter → export
  - Add 2-3 screenshots per workflow
  - Expected outcomes for each step
  - **Evidence:** OWNER-GUIDE.md with all workflows
  - **Guardrail:** Each workflow <5min for non-technical owner

- [ ] 7.2 Document testing scenarios
  - Normal flow: login → view → select → sync → complete
  - Edge cases: no results, batch vs single, cancel sync
  - Error cases: DB down, API timeout
  - Performance: 100+ products no lag
  - **Evidence:** Screenshots each scenario
  - **Guardrail:** All scenarios work end-to-end

- [ ] 7.3 Troubleshooting guide
  - Write TROUBLESHOOTING.md FAQ format
  - "Products not showing" → solutions
  - "Sync button disabled" → reason
  - "Progress bar stuck" → solution
  - "Session expired" → solution
  - 5+ common issues documented
  - **Evidence:** TROUBLESHOOTING.md complete
  - **Guardrail:** All issues tested and verified

- [ ] 7.4 Collect evidence
  - Screenshot: Dashboard with products
  - Screenshot: Search, pagination, batch selection
  - Screenshot: Sync in progress + logs
  - Screenshot: Error message
  - Export log file sample
  - Record video: 3min full workflow
  - **Evidence:** All in TEST-EVIDENCE folder
  - **Guardrail:** Evidence same day as testing

---

### Task 8: Documentation & Final Status

**Goal:** Transparent documentation with full evidence

- [ ] 8.1 Update project documentation
  - Update README.md: "Phase 4 XX% Complete"
  - List features: ✓ Products | ✓ Sync | ✓ Error Handling
  - Update API docs with response samples
  - Create SETUP.md: run app + seed data instructions
  - **Evidence:** Updated README on GitHub
  - **Guardrail:** Match actual implementation

- [ ] 8.2 Evidence compilation
  - Create `docs/TEST-EVIDENCE/`
  - Add screenshots/ with 20+ images
  - Add logs/ with API + sync logs
  - Add data/ with products.json dump
  - Create INDEX.md listing all evidence
  - **Evidence:** Complete TEST-EVIDENCE folder
  - **Guardrail:** Show actual execution, not mock

- [ ] 8.3 Accurate changelog
  - Update CHANGELOG.md dated entries (YYYY-MM-DD)
  - List completed: "✓ [Feature] Description"
  - List known issues: "⚠ [Issue] Description"
  - List fixed bugs: "✓ [Bug] Fixed - Date"
  - **Evidence:** Detailed CHANGELOG.md
  - **Guardrail:** Update daily, no backfill

- [ ] 8.4 Document known issues
  - Create KNOWN-BUGS.md
  - Format: Title | Description | Reproduce | Status | Workaround
  - Sections: OPEN | IN-PROGRESS | FIXED
  - **Evidence:** KNOWN-BUGS.md with issues (if any)
  - **Guardrail:** Honest bug reporting

- [ ] 8.5 Final completion report
  - Create PHASE4-COMPLETION-REPORT.md
  - Summary: "8/8 tasks done, evidence provided"
  - Completion checklist (8 items)
  - List deliverables
  - Sign-off: "READY FOR PRODUCTION"
  - **Evidence:** Signed completion report
  - **Guardrail:** Sign only if ALL verified

---

## SUCCESS CRITERIA

Phase 4 COMPLETE only if ALL true:

- ✓ Dashboard displays ≥10 real products
- ✓ Data persists after reload
- ✓ Sync works: click → 0-100% → complete
- ✓ Logs capture all events
- ✓ Batch operations work
- ✓ Error boundaries prevent crashes
- ✓ All API endpoints return valid data
- ✓ Owner can test independently
- ✓ No uncaught console errors
- ✓ OWNER-GUIDE.md with 15+ screenshots
- ✓ TEST-EVIDENCE folder complete
- ✓ CHANGELOG.md updated
- ✓ No "READY" without Evidence

## FAIL CRITERIA

Phase 4 FAILS if ANY true:

- ✗ Dashboard empty or "No products found"
- ✗ Data doesn't persist after reload
- ✗ Sync doesn't work
- ✗ API returns errors/empty
- ✗ Console has uncaught errors
- ✗ Owner can't test independently
- ✗ "READY" claimed without Evidence
- ✗ Tests fail or coverage <75%

---

## Final Sign-Off

Before marking complete:

1. [ ] All 8 tasks completed
2. [ ] All subtasks checked
3. [ ] Evidence files in place
4. [ ] Documentation updated
5. [ ] No console errors
6. [ ] Owner can test independently
7. [ ] Code committed
8. [ ] Ready for production

**Status:** COMPLETE / INCOMPLETE
**Date:** [Date]
**Deployment Ready:** YES / NO

