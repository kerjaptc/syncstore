# 🚀 SYNCSTORE PHASE 2 - PRODUCT SYNC & PRICING
## Clear Execution Plan for Kiro (AI Agent)

**Date:** November 2, 2025  
**Phase:** 2 - Product Synchronization & Pricing  
**Duration:** 2 weeks (10 working days)  
**Status:** 🟢 READY TO START  
**For:** Agent Kiro (AI Assistant)  

---

## ⚡ QUICK BRIEF - READ THIS FIRST

**What we just completed (Phase 1):**
- ✅ Imported ~4,147 products from Shopee (3,647) + TikTok Shop (500)
- ✅ Created master catalog with unified schema
- ✅ Implemented pricing system (auto-calculate platform fees)
- ✅ Implemented SEO title generation (70-80% similar, 20-30% variation)
- ✅ All testing & validation done (95%+ data quality)

**What you need to do now (Phase 2):**
- Build UI dashboard to manage products
- Create manual sync feature (test with 1-2 products)
- Implement automated sync engine (BullMQ job queue)
- Test batch sync (10-50 products)
- Comprehensive validation & rollback plan

**Success = Sync 50 products perfectly to Shopee & TikTok by end of week 2**

---

## 🎯 PHASE 2 MISSION - CRYSTAL CLEAR

**Your job this phase:**
```
[Master Product Table]
         ↓
[Manual Sync UI] → Test 2 products manually
         ↓
[Automated Sync Engine] → Batch sync 50 products
         ↓
[Comprehensive Validation] → Pricing, mapping, SEO correct
         ↓
[Rollback Plan Ready] → Just in case errors
         ↓
✅ PHASE 2 DONE
```

**Nothing else.** No orders, no analytics, no finance, no reporting, no advanced features.

**Focus:** Sync produk + Pricing. That's it.

---

## 📋 WEEK 1 - MANUAL SYNC PILOT

### Goal: Test sync workflow with 1-2 products manually

### Day 1-2: Dashboard UI Foundation

**What to build:**
1. **Product List Page**
   - List all master products (with pagination, search)
   - Columns: Product ID, Title, Master Price, Shopee Price, TikTok Price, Status
   - Example:
     ```
     ID     | Title              | Master   | Shopee   | TikTok   | Status
     -------|------------------|----------|----------|----------|-------
     PROD-1 | Frame Racing 5"   | 150,000  | 172,500  | 180,000  | synced
     PROD-2 | Propeller 9"      | 50,000   | 57,500   | 60,000   | pending
     ```

2. **Product Detail Page**
   - View complete product info
   - Show master field + platform-specific fields
   - Example:
     ```
     MASTER FIELDS:
     ├─ Title: "Frame Racing 5 Inch"
     ├─ Description: "Professional racing frame..."
     ├─ Images: [3 images]
     ├─ Weight: 0.05 kg
     └─ Base Price: 150,000 IDR
     
     SHOPEE MAPPING:
     ├─ Item ID: 123456789
     ├─ Final Price: 172,500 (150k × 1.15)
     ├─ SEO Title: "Frame 5 Inch Racing Carbon Fiber Ringan [BEST SELLER]"
     └─ Category: 100001
     
     TIKTOK MAPPING:
     ├─ Product ID: TTS-456789
     ├─ Final Price: 180,000 (150k × 1.20)
     ├─ SEO Title: "Racing Frame 5 Inch Carbon - Ringan & Kuat untuk FPV"
     └─ Include Tokopedia: ✓
     ```

3. **UI Tech Stack:**
   - Use Next.js 15 App Router (already available)
   - Use shadcn/ui components (already available in repo)
   - Use Tailwind CSS v4 (already available)
   - State management: Zustand (simple, lightweight)

**Code location:** `src/app/dashboard/products/`

**Acceptance Criteria:**
- [ ] Product list page renders all 4,147 products (paginated, max 50 per page)
- [ ] Product detail page shows all fields
- [ ] Responsive design (mobile + desktop)
- [ ] No console errors

---

### Day 3: Manual Sync Button (UI + Backend)

**What to build:**
1. **Add "Sync" button on Product Detail page**
   - Button triggers manual sync to Shopee ONLY
   - Button triggers manual sync to TikTok ONLY
   - Button to sync BOTH platforms
   - Show status: "Not Synced", "Syncing...", "Synced", "Error"

2. **Backend Endpoint: POST /api/sync/manual**
   ```typescript
   // Input
   {
     product_id: "uuid",
     target_platform: "shopee" | "tiktok" | "both"
   }
   
   // Output
   {
     success: true,
     sync_id: "sync_12345",
     platform: "shopee",
     message: "Product pushed successfully",
     data: {
       external_id: "123456789",
       timestamp: "2025-11-02T10:30:00Z",
       status: "synced"
     }
   }
   ```

3. **Error Handling**
   ```typescript
   // If error:
   {
     success: false,
     error: "INVALID_PRODUCT",
     message: "Product not found in master catalog",
     error_code: "ERR_001"
   }
   ```

**Code location:** `src/app/api/sync/manual/route.ts`

**Acceptance Criteria:**
- [ ] Manual sync endpoint created and callable
- [ ] Endpoint logs every request (timestamp, product_id, platform, status)
- [ ] Error responses are clear and helpful
- [ ] UI button triggers endpoint and shows response

---

### Day 4-5: Pilot Test with 2 Products

**Phase 4a: Select 2 test products**
- Choose: 1 simple product (no variants), 1 with variants
- Example:
  - Product A: "Frame Racing 5 Inch" (no variants, highest sales volume)
  - Product B: "Propeller Set" (with color variants: Red, Blue, Green)

**Phase 4b: Manual sync test**

**Test Case 1: Simple product (no variants)**
```
Step 1: Open Product Detail page for "Frame Racing 5 Inch"
Step 2: Click "Sync to Shopee"
Step 3: Wait for response (should be success)
Step 4: Go to Shopee seller center
Step 5: Search for "Frame Racing 5 Inch"
Step 6: Verify:
   ✓ Product title matches SEO title: "Frame 5 Inch Racing Carbon Fiber Ringan [BEST SELLER]"
   ✓ Price is correct: 172,500 IDR (not 150,000)
   ✓ Description matches master
   ✓ Images are all there (3+)
Step 7: Back to SyncStore, click "Sync to TikTok"
Step 8: Go to TikTok Shop seller center
Step 9: Verify:
   ✓ Product title: "Racing Frame 5 Inch Carbon - Ringan & Kuat untuk FPV"
   ✓ Price is correct: 180,000 IDR (not 150,000)
   ✓ Tokopedia auto-included (Tokopedia also shows the product)
```

**Test Case 2: Product with variants**
```
Same steps as above but also verify:
   ✓ All variants (Red, Blue, Green) synced correctly
   ✓ Each variant has correct pricing
   ✓ Variant images correct
```

**What to document:**
```
TEST REPORT - Day 5

Product A: Frame Racing 5 Inch
├─ Shopee sync: ✓ SUCCESS
│  ├─ Title correct: Yes
│  ├─ Price correct: Yes (172,500)
│  ├─ Images OK: Yes
│  └─ Verified timestamp: 2025-11-02 14:30 UTC
├─ TikTok sync: ✓ SUCCESS
│  ├─ Title correct: Yes
│  ├─ Price correct: Yes (180,000)
│  └─ Tokopedia auto-included: Yes
└─ Status: READY FOR BATCH SYNC

Product B: Propeller Set
├─ Shopee sync: ✓ SUCCESS
│  └─ All 3 variants synced correctly
├─ TikTok sync: ✓ SUCCESS
│  └─ All 3 variants synced correctly
└─ Status: READY FOR BATCH SYNC

Findings:
- Manual sync works as expected
- No data loss
- Pricing calculation correct
- SEO titles applied correctly
- Ready to proceed to automated batch sync

Issues Found: [List if any]
```

**Acceptance Criteria:**
- [ ] 2 products synced successfully to Shopee
- [ ] 2 products synced successfully to TikTok
- [ ] All fields verified correct on marketplace
- [ ] Pricing calculation verified
- [ ] SEO titles verified
- [ ] Test report documented

---

## 📋 WEEK 2 - AUTOMATED BATCH SYNC

### Goal: Automate sync, test with 10-50 products, comprehensive validation

### Day 6: Job Queue Setup (BullMQ)

**What to implement:**
1. **Install dependencies**
   ```bash
   npm install bullmq redis
   ```

2. **Create Job Queue Service**
   ```typescript
   // src/lib/queue/syncQueue.ts
   import { Queue, Worker } from 'bullmq';
   
   const syncQueue = new Queue('product-sync', {
     connection: {
       host: process.env.REDIS_HOST,
       port: parseInt(process.env.REDIS_PORT)
     }
   });
   
   // Job structure
   interface SyncJob {
     product_id: string;
     platform: 'shopee' | 'tiktok' | 'both';
     batch_id: string;
     timestamp: Date;
   }
   ```

3. **Create Worker to process jobs**
   ```typescript
   // src/lib/queue/syncWorker.ts
   const worker = new Worker('product-sync', async (job) => {
     console.log(`[${job.data.product_id}] Syncing to ${job.data.platform}...`);
     
     // Fetch product from master catalog
     // Push to Shopee API
     // Push to TikTok API
     // Log result
     // Return success/error
     
     return {
       success: true,
       product_id: job.data.product_id,
       platform: job.data.platform,
       synced_at: new Date()
     };
   });
   ```

4. **API Endpoint to queue batch sync**
   ```typescript
   // src/app/api/sync/batch/route.ts
   export async function POST(req: Request) {
     const { product_ids, platform } = await req.json();
     
     const batch_id = generateId();
     
     for (const product_id of product_ids) {
       await syncQueue.add(
         'sync-product',
         {
           product_id,
           platform,
           batch_id,
           timestamp: new Date()
         },
         {
           attempts: 3,
           backoff: { type: 'exponential', delay: 2000 },
           removeOnComplete: false
         }
       );
     }
     
     return {
       success: true,
       batch_id,
       total_jobs: product_ids.length
     };
   }
   ```

**Acceptance Criteria:**
- [ ] BullMQ installed and configured
- [ ] Job queue can add jobs
- [ ] Worker can process jobs
- [ ] API endpoint returns batch_id

---

### Day 7: Logging & Progress Tracking

**What to implement:**
1. **Job Status Tracking**
   ```typescript
   // src/lib/queue/jobStatus.ts
   
   interface JobStatus {
     batch_id: string;
     total_jobs: number;
     completed: number;
     failed: number;
     in_progress: number;
     status: 'pending' | 'running' | 'completed' | 'error';
     jobs: Array<{
       product_id: string;
       platform: string;
       status: 'pending' | 'processing' | 'success' | 'failed';
       error?: string;
     }>;
   }
   
   // API to get batch status
   export async function GET(req: Request) {
     const batch_id = req.nextUrl.searchParams.get('batch_id');
     const status = await getBatchStatus(batch_id);
     return Response.json(status);
   }
   ```

2. **Logging to Database**
   ```typescript
   // Create sync_logs table
   CREATE TABLE sync_logs (
     id UUID PRIMARY KEY,
     batch_id UUID,
     product_id UUID,
     platform VARCHAR(50),
     status VARCHAR(50),
     request_payload JSONB,
     response_payload JSONB,
     error_message TEXT,
     created_at TIMESTAMP,
     INDEX(batch_id, status)
   );
   ```

3. **Progress Bar (Frontend)**
   - Show real-time progress: "25/100 products synced"
   - Show failed count: "2 errors"
   - Show status badge: syncing, completed, error
   - Example:
     ```
     Batch Sync Progress
     ├─ Completed: 25/100 (25%)
     ├─ Failed: 2
     ├─ Progress bar: [████░░░░░░░░░░░░░]
     └─ ETA: 5 minutes remaining
     ```

**Acceptance Criteria:**
- [ ] Sync logs table created
- [ ] Job status API returns accurate data
- [ ] Frontend progress bar updates in real-time
- [ ] Failed jobs tracked and visible

---

### Day 8: Error Handling & Retry Logic

**What to implement:**
1. **Retry Strategy**
   ```typescript
   // Configuration
   const retryConfig = {
     maxAttempts: 3,
     backoffDelay: 2000, // 2s, 4s, 8s
     retryableErrors: [
       'RATE_LIMITED',
       'TIMEOUT',
       'NETWORK_ERROR'
     ],
     nonRetryableErrors: [
       'INVALID_PRODUCT',
       'UNAUTHORIZED',
       'PRODUCT_NOT_FOUND'
     ]
   };
   ```

2. **Error Recovery**
   ```typescript
   // Catch specific errors and handle
   try {
     await pushToShopee(product);
   } catch (error) {
     if (error.code === 'RATE_LIMIT') {
       // Wait and retry
       await wait(5000);
       await retry(job);
     } else if (error.code === 'INVALID_PRODUCT') {
       // Don't retry, mark as failed
       await markJobFailed(job, error);
     }
   }
   ```

3. **Dead Letter Queue**
   - Jobs that failed 3x go to dead-letter queue
   - Manual review required before retry
   - Log: `Failed to sync product ABC after 3 attempts: [error details]`

**Acceptance Criteria:**
- [ ] Retry logic implemented
- [ ] Exponential backoff working
- [ ] Non-retryable errors don't retry
- [ ] Dead-letter queue functional

---

### Day 9: Batch Test (10-50 Products)

**What to test:**
1. **Select 10 products for first batch**
   - Mix of simple + variants
   - Different categories
   - Different price ranges

2. **Run sync batch**
   ```
   POST /api/sync/batch
   {
     "product_ids": ["prod-1", "prod-2", ..., "prod-10"],
     "platform": "both"
   }
   ```

3. **Monitor progress**
   - Watch job queue process
   - Check logs for any errors
   - Monitor API response times

4. **Verify results in Shopee & TikTok**
   - Sample 3 random products from batch
   - Verify: title, price, images, mapping
   - Check for any data corruption

5. **If success, scale to 50 products**
   - Run same test with 50 products
   - Monitor for any issues
   - Document results

**Test Report Template:**
```
BATCH SYNC TEST REPORT - Day 9

Test 1: 10 Products
├─ Total: 10 products
├─ Completed: 10 (100%)
├─ Failed: 0
├─ Duration: 3 minutes 45 seconds
├─ Avg per product: 22.5 seconds
├─ Spot check (3 random):
│  ├─ Product A: ✓ PASS (verified in Shopee & TikTok)
│  ├─ Product B: ✓ PASS
│  └─ Product C: ✓ PASS
└─ Status: ✅ READY TO SCALE

Test 2: 50 Products
├─ Total: 50 products
├─ Completed: 50 (100%)
├─ Failed: 0
├─ Duration: 18 minutes
├─ Avg per product: 21.6 seconds
├─ Spot check (5 random):
│  ├─ Product A: ✓ PASS
│  ├─ Product B: ✓ PASS
│  ├─ Product C: ✓ PASS
│  ├─ Product D: ✓ PASS
│  └─ Product E: ✓ PASS
└─ Status: ✅ READY FOR FULL SYNC

Issues Encountered: None
Performance: Excellent (21.6s per product is acceptable)
Recommendation: Proceed to full sync with monitoring
```

**Acceptance Criteria:**
- [ ] 10 products synced successfully
- [ ] 50 products synced successfully
- [ ] All spot checks pass
- [ ] No data corruption
- [ ] Performance acceptable (<30s per product)

---

### Day 10: Comprehensive Validation & Rollback Plan

**What to do:**
1. **Final Comprehensive Check**
   ```
   VALIDATION CHECKLIST:
   
   Pricing Verification:
   ├─ [ ] 100% of products have correct master price
   ├─ [ ] 100% of products have correct Shopee price (×1.15)
   ├─ [ ] 100% of products have correct TikTok price (×1.20)
   └─ Query:
      SELECT COUNT(*) FROM products 
      WHERE shopee_price != (base_price * 1.15)
      OR tiktok_price != (base_price * 1.20)
      -- Should return 0
   
   SEO Title Verification:
   ├─ [ ] Master title present for all
   ├─ [ ] Shopee SEO title 70-80% similar to master
   ├─ [ ] TikTok SEO title 70-80% similar to master
   └─ [ ] No exact duplicates between platforms
   
   Mapping Verification:
   ├─ [ ] All 50 products have Shopee mapping
   ├─ [ ] All 50 products have TikTok mapping
   ├─ [ ] External IDs (item_id, product_id) saved correctly
   └─ [ ] No missing or null references
   
   Image Verification:
   ├─ [ ] All images accessible (no 404s)
   ├─ [ ] At least 3 images per product
   └─ [ ] Images match across platforms
   
   Variant Verification (if applicable):
   ├─ [ ] All variants synced
   ├─ [ ] Each variant has correct external_id
   └─ [ ] No variant data loss
   
   Marketplace Verification:
   ├─ [ ] Spot check 5 random products in Shopee
   │  ├─ Title correct?
   │  ├─ Price correct?
   │  └─ Images present?
   ├─ [ ] Spot check 5 random products in TikTok
   │  ├─ Title correct?
   │  ├─ Price correct?
   │  └─ Tokopedia also updated?
   └─ [ ] No duplicates or missing products
   ```

2. **Rollback Plan (CRITICAL)**
   ```
   IF ERRORS FOUND:
   
   Option 1: Partial Rollback
   ├─ Identify failed products
   ├─ Restore from master catalog backup
   ├─ Fix issue in code
   └─ Re-sync failed products only
   
   Option 2: Full Rollback
   ├─ Restore master catalog from backup (Day 1)
   ├─ Delete all synced data from Shopee/TikTok
   ├─ Investigate root cause
   ├─ Fix code
   └─ Start fresh with 10 products
   
   Rollback Command:
   ```sql
   -- Restore master catalog
   RESTORE DATABASE syncstore FROM BACKUP 'day1-backup.bak';
   
   -- Clear all sync mappings
   DELETE FROM sync_mappings WHERE created_at > '2025-11-09';
   
   -- Clear job queue
   FLUSHDB; -- Redis
   ```
   
   Manual Cleanup in Marketplaces:
   ├─ Shopee: Delete products manually (if catastrophic)
   ├─ TikTok: Delete products manually (if catastrophic)
   └─ Tokopedia: Auto-revert when TikTok fixed
   ```

3. **Sign-off Criteria**
   ```
   Phase 2 is COMPLETE when:
   
   ✅ Manual sync tested with 2 products (100% success)
   ✅ Batch sync tested with 50 products (100% success)
   ✅ All validation checks pass
   ✅ Pricing: 100% accuracy
   ✅ SEO titles: 100% correct per platform
   ✅ Mappings: 100% saved and linked
   ✅ No data corruption
   ✅ Rollback plan tested
   ✅ Documentation complete
   ✅ Owner approval received
   
   Ready for: Mass sync of all 4,147 products
   ```

**Acceptance Criteria:**
- [ ] All 10 validation checks pass
- [ ] Rollback plan documented and tested
- [ ] Owner has reviewed and approved results
- [ ] Ready for Phase 3 (mass sync)

---

## 🚨 CRITICAL GUARDRAILS - DO NOT BREAK THESE

| Guardrail | Why | Action if Broken |
|-----------|-----|-----------------|
| **Don't work on orders yet** | Order management is Phase 4+ | Stop, escalate to owner |
| **Don't work on analytics** | Analytics is Phase 5+ | Stop, escalate to owner |
| **Don't work on finance/reporting** | Future phase | Stop, escalate to owner |
| **Don't skip manual testing** | Avoid mass data corruption | Must test 1-2 products first |
| **Don't sync all 4k products at once** | Risk of catastrophic failure | Batch in 10, 50, then 1k chunks |
| **Don't ignore errors** | They compound | Fix before scaling |
| **Don't skip backup before batch** | No rollback if needed | Create backup, verify it works |
| **Don't deploy without owner approval** | Business risk | Get sign-off before full sync |

---

## 📊 Success Metrics - End of Week 2

```
✅ PHASE 2 SUCCESS CHECKLIST

Day 5 Milestone (Week 1):
├─ [ ] Dashboard UI complete
├─ [ ] Manual sync working (2 products tested)
├─ [ ] Pricing verified correct
├─ [ ] SEO titles verified correct
└─ [ ] Owner approves test results

Day 10 Milestone (Week 2):
├─ [ ] BullMQ job queue implemented
├─ [ ] Batch sync working (50 products tested)
├─ [ ] Error handling & retry working
├─ [ ] Comprehensive validation passed
├─ [ ] Rollback plan tested
└─ [ ] Ready for Phase 3

METRICS:
├─ Sync success rate: 100% (0 errors)
├─ Price accuracy: 100%
├─ SEO title accuracy: 100%
├─ Average sync time per product: <30 seconds
├─ Data integrity: 100%
└─ Owner satisfaction: Approved ✓
```

---

## 💬 Daily Communication Template

**Send this every evening:**
```
📊 PHASE 2 - DAILY UPDATE

Date: [Date]
Current Day: [1-10]

✅ Completed Today:
- [Task 1]
- [Task 2]

🚀 In Progress:
- [Task 3] - [% complete]

🎯 Tomorrow's Plan:
- [Task 4]
- [Task 5]

⚠️ Blockers:
- [Issue 1] - Severity: [Low/Medium/High]
- [Issue 2]
(Or: "None")

📈 Progress:
- Week 1: [X]% complete
- Week 2: [X]% complete
- Phase 2 Overall: [X]% complete

🔗 Key Metrics:
- Products tested: X
- Success rate: X%
- Errors: X
```

---

## 🆘 If You're Still Confused

**These are the only things you care about this phase:**

1. **Dashboard:** Show products + pricing on screen
2. **Manual Sync:** Click button → product updates in Shopee/TikTok
3. **Batch Sync:** Queue system to push 50 products automatically
4. **Validation:** Confirm everything is correct before scaling
5. **Rollback:** Have a backup plan if things go wrong

**That's it. Nothing else matters this phase.**

---

## ✨ Remember

- You've already done the hard part (data import & schema design).
- This phase is about making the sync workflow work end-to-end.
- Testing is more important than speed.
- Better to sync 50 products perfectly than 4,000 products with errors.

**Focus. Execute. Validate. Ship.**

---

**Status:** 🟢 READY FOR PHASE 2  
**Date Prepared:** November 2, 2025, 4:44 AM WIB  
**For:** Agent Kiro  
**Next Review:** Day 5 (End of Week 1) and Day 10 (End of Week 2)