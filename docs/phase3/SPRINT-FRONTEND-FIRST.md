# 🚀 SYNCSTORE SPRINT - FRONTEND FIRST (REAL BROWSER EXPERIENCE)
## Execution Plan for Kiro - Codebase-Centric, Browser-Driven

**Date:** November 2, 2025, 8:00 PM WIB  
**Phase:** Frontend Integration & Real Browser Testing  
**Duration:** 1 week (continuous task automation)  
**For:** Agent Kiro (AI Assistant)  
**Status:** 🟢 READY TO START (Automate Step-by-Step)

---

## ⚡ CRITICAL RULES - READ FIRST

### Rule 1: NO COMMIT WITHOUT INSTRUCTION
```
❌ DO NOT commit to GitHub automatically
✅ WAIT for owner's explicit "COMMIT NOW" instruction
   Owner will verify browser functionality FIRST, then approve commit.
```

### Rule 2: AUTO-CONTINUE TASKS (Credit Saving)
```
✅ After Task N is DONE (verified in browser):
   → Immediately proceed to Task N+1 
   → NO waiting, NO recap unless asked
   → Keep momentum, save time & credits

Example Flow:
Task 1 DONE ✓ → Auto-start Task 2 (no recap)
Task 2 DONE ✓ → Auto-start Task 3 (no recap)
...continue until stuck/error/need input from owner
```

### Rule 3: RECAP ONLY WHEN PROVEN & REQUESTED
```
❌ NO recap/report unless explicitly asked
✅ RECAP only AFTER feature tested in real browser by owner
✅ RECAP = Screenshot/video proof + code verification
```

---

## 🎯 MISSION (Crystal Clear)

**Goal:** Owner can open browser → see real Shopee product data → click "Sync Now" → see feedback in UI → understand what happened (success/error).

**NOT goal yet:**
- Batch sync all 4k products
- Automation (only manual triggers from UI)
- Advanced features
- Order/analytics/reporting

**Success = Owner opens localhost:3000 and says: "This works, I can test it myself without logs."**

---

## 📋 TASKS - AUTO-CONTINUE (1 Week Total)

### **TASK 1: Dashboard Product List - REAL DATA**
**Objective:** Product table shows actual Shopee products (no dummy, no mock)

**Requirements:**
- [ ] Page: `src/app/dashboard/products/page.tsx` displays:
  - Product list (paginated, 20 per page)
  - Columns: ID, Title, Master Price, Shopee Price, Status, Sync Button
  - Data from: `SELECT * FROM master_products LIMIT 20;`
  - Fetch real data from API `GET /api/products?page=1&limit=20`

**Technical Specs:**
```typescript
// API: src/app/api/products/route.ts
GET /api/products?page=1&limit=20
Response: {
  products: [{
    id, title, base_price, shopee_price, status, 
    last_synced_at, last_error
  }],
  total: 4147,
  page: 1
}
```

**UI Components to Create:**
- ProductTable (shadcn/ui Table)
- ProductRow (with status badge)
- Pagination component
- Loading skeleton
- Error boundary

**Success Criteria:**
- [ ] Page loads in <2 seconds
- [ ] Shows >10 real products from DB
- [ ] Pagination working
- [ ] No console errors
- [ ] Responsive design (mobile + desktop)

**Evidence for Owner:**
- Screenshot: Browser shows real products (title matches Shopee)
- DevTools: Network tab shows API response with real data
- Console: No red errors

---

### **TASK 2: Sync Button & Manual Trigger**
**Objective:** Owner can click "Sync Now" button, backend processes sync, feedback shows in UI

**Requirements:**
- [ ] Button on each product row: "Sync to Shopee"
- [ ] Button triggers: `POST /api/sync/product` with product_id
- [ ] Backend starts sync process asynchronously
- [ ] UI shows: Loading state, then success/error feedback

**Technical Specs:**
```typescript
// API: src/app/api/sync/product/route.ts
POST /api/sync/product
Body: { product_id: "uuid", target: "shopee" }
Response: {
  sync_id: "sync_123",
  status: "processing", // or "success" / "error"
  message: "Syncing product to Shopee...",
  errors?: []
}
```

**UI Behavior:**
```
User clicks "Sync Now"
  ↓
Button shows: "Syncing..." + spinner
  ↓
API called: POST /api/sync/product
  ↓
Response received
  ↓
IF success:
  Button shows: "✓ Synced" (green) for 3 seconds
  Toast: "Product synced successfully"
IF error:
  Button shows: "✗ Error" (red)
  Toast: "Error: [error message]"
  Error details shown below table
```

**Components to Create/Modify:**
- SyncButton component (handles loading/success/error states)
- useSync hook (API call + state management)
- Toast notification system (shadcn/ui Toast)
- Error display component

**Success Criteria:**
- [ ] Button exists and clickable
- [ ] API call made when clicked (verify in DevTools Network tab)
- [ ] Loading state shows immediately
- [ ] Success/error feedback appears (toast + button state)
- [ ] No hard refresh needed (UI updates realtime)
- [ ] Error message is clear (not just generic "error")

**Evidence for Owner:**
- Screenshot: Before/after sync button click
- DevTools: Network tab shows API request and response
- Console: No errors
- Toast notification visible
- Button state changes

---

### **TASK 3: Sync Status & Last Sync Timestamp**
**Objective:** Owner sees when product was last synced, current status (pending/syncing/synced/error)

**Requirements:**
- [ ] Status column displays:
  - "pending" = not synced yet (gray badge)
  - "syncing" = currently syncing (yellow badge + spinner)
  - "synced" = successfully synced (green badge + timestamp)
  - "error" = failed sync (red badge + error icon)
- [ ] Timestamp shows: "Last synced: 5 minutes ago" (relative time)
- [ ] On page load, fetch status from DB

**Technical Specs:**
```typescript
// Add to Product table:
{
  id: "uuid",
  title: "...",
  status: "synced" | "pending" | "syncing" | "error",
  last_synced_at: "2025-11-02T12:00:00Z",
  last_sync_error: "API rate limited" | null
}
```

**UI Components:**
- StatusBadge component (conditional styling per status)
- RelativeTime component (shows "5 min ago" format)
- ErrorTooltip (shows error details on hover)

**Success Criteria:**
- [ ] Status displays correctly for each product
- [ ] Timestamp updates after sync
- [ ] Badge colors match status (green/red/yellow/gray)
- [ ] Error message visible on hover (if error exists)
- [ ] Page refreshes show latest status

**Evidence for Owner:**
- Screenshot: Table with status column filled
- Screenshot: After sync, status changed to "synced" with timestamp
- Screenshot: Error status shows tooltip with error message

---

### **TASK 4: Progress Bar & Sync Log Viewer**
**Objective:** Owner sees what's happening during sync (transparency + debugging aid)

**Requirements:**
- [ ] Progress bar at top of page (global sync progress)
- [ ] Expandable sync log drawer/modal
- [ ] Log shows real-time events:
  - "Starting sync: Product ABC..."
  - "Fetching from Shopee API..."
  - "Validating data..."
  - "Pushing to Shopee..."
  - "✓ Success" or "✗ Failed: [reason]"

**Technical Specs:**
```typescript
// Sync log structure:
interface SyncLog {
  sync_id: string;
  product_id: string;
  status: "running" | "success" | "error";
  events: [{
    timestamp: ISO8601,
    type: "info" | "success" | "error" | "warning",
    message: string,
    details?: object
  }];
  started_at: ISO8601;
  completed_at?: ISO8601;
}

// API: GET /api/sync/logs/{sync_id}
// Response: SyncLog object (updates realtime via polling or websocket)
```

**UI Components:**
- ProgressBar (shadcn/ui Progress)
- SyncLogDrawer (shadcn/ui Drawer/Sidebar)
- LogEntry component (timestamp + message + color per type)
- Auto-scroll to bottom as new logs arrive

**Frontend Logic:**
```
1. User clicks "Sync Now"
2. Get sync_id from response
3. Start polling GET /api/sync/logs/{sync_id} every 500ms
4. Render new events as they arrive
5. Update progress bar based on events
6. Stop polling when status = "success" or "error"
```

**Success Criteria:**
- [ ] Progress bar visible and updates
- [ ] Log drawer accessible (button on top/side)
- [ ] Real-time events logged (no delay)
- [ ] Events show correct type/color
- [ ] Auto-scrolls to latest event
- [ ] Polling stops after sync completes
- [ ] Owner can understand what happened from logs (no cryptic messages)

**Evidence for Owner:**
- Screenshot: Progress bar during sync
- Screenshot: Sync log drawer open with events
- Video: Real-time log updates as sync progresses
- Console: No errors during polling

---

### **TASK 5: Error Display & User Feedback**
**Objective:** When anything goes wrong, owner knows exactly what failed and why

**Requirements:**
- [ ] Error toast notification appears immediately
- [ ] Error message is clear (not technical jargon)
- [ ] Error details expandable (full error + stack trace for debugging)
- [ ] Common errors have helpful suggestions:
  - "API rate limit" → "Wait 5 minutes and try again"
  - "Invalid product data" → "Check product details, missing required fields"
  - "Connection timeout" → "Check network connection"

**Technical Specs:**
```typescript
// Error response format:
{
  success: false,
  error_code: "SHOPEE_RATE_LIMIT",
  message: "API request failed: Rate limit exceeded",
  details: {
    original_error: "429 Too Many Requests",
    retry_after: 60,
    suggestion: "Wait 1 minute before retrying"
  }
}
```

**UI Components:**
- ErrorToast (shadcn/ui Toast + error icon)
- ErrorDetails (expandable details with stack trace)
- ErrorBoundary (catches React errors)
- Retry button (for retryable errors)

**Success Criteria:**
- [ ] Error toast shows immediately on API error
- [ ] Error message is human-readable
- [ ] Details section shows full error + suggestion
- [ ] Retry button present (if error is retryable)
- [ ] No technical jargon in user-facing message
- [ ] Error persists in sync log for owner reference

**Evidence for Owner:**
- Screenshot: Toast showing error message
- Screenshot: Error details expanded
- Screenshot: Retry button works
- Test: Intentional error (e.g., bad product_id) shows expected message

---

### **TASK 6: Manual Batch Test (10 Products)**
**Objective:** Owner manually syncs 10 real products from dashboard, all succeed, verify in Shopee

**Requirements:**
- [ ] Select 10 products from dashboard
- [ ] Batch sync them via UI (one button: "Sync Selected 10 Products")
- [ ] Monitor progress bar + log for all 10
- [ ] All 10 should complete with status "synced"
- [ ] Owner opens Shopee seller center, verifies 10 products updated correctly

**Testing Checklist:**
For each product:
- [ ] Title updated in Shopee (matches SEO title)
- [ ] Price updated in Shopee (matches base_price × 1.15)
- [ ] Images present
- [ ] Description matches
- [ ] Status in dashboard shows "synced"
- [ ] Timestamp shows recent sync

**Success Criteria:**
- [ ] All 10 products synced without error
- [ ] Owner can verify 5 random products in Shopee (all correct)
- [ ] Dashboard status matches Shopee reality
- [ ] No data corruption
- [ ] Performance acceptable (sync 10 products in <2 minutes)

**Evidence for Owner:**
- Screenshot: Dashboard before batch sync
- Screenshot: Progress bar during sync
- Screenshot: All 10 products status = "synced"
- Screenshot: Shopee seller center showing 5 updated products
- Video: Full workflow from dashboard sync to Shopee verification

---

### **TASK 7: Code Audit & Browser Verification**
**Objective:** Verify all code is REAL (not dummy), all features work in actual browser, no hallucinations

**Requirements:**
- [ ] Code review checklist:
  - ProductTable fetches from real DB (not mock data)
  - SyncButton truly calls API (verify Network tab)
  - Progress bar updates from real sync events
  - Error handling actually catches API errors
  - No console errors/warnings
  - No dead code or test stubs
- [ ] Browser testing checklist:
  - Product list loads real data
  - Sync button works end-to-end
  - Status updates in realtime
  - Error feedback clear
  - No hard refreshes needed
  - Responsive on mobile
- [ ] Owner can reproduce workflow without dev assistance

**Success Criteria:**
- [ ] All code files exist and are production-ready (not stubs)
- [ ] All features testable in browser without backend access
- [ ] No false claims in code (all functions do what they claim)
- [ ] Owner successfully tests without help (1st time)
- [ ] Owner can show dashboard to business partner, it works

---

## 🔄 AUTO-CONTINUE WORKFLOW

```
Task 1 Complete? ✓
  → Auto-start Task 2 (no waiting)
  
Task 2 Complete? ✓
  → Auto-start Task 3 (no waiting)
  
Task 3 Complete? ✓
  → Auto-start Task 4 (no waiting)
  
... continue until Task 7
  
Task 7 Complete? ✓
  → STOP and wait for owner instruction
     (do NOT commit, do NOT continue to more tasks)
     (await owner: "RECAP?" or "COMMIT?" or "FIX X?")
```

---

## 📝 DAILY STATUS - BRIEF FORMAT

**Send ONLY when:**
- [ ] Task completed AND verified in browser
- [ ] Owner explicitly asks for status
- [ ] Blocked/error requires owner decision

**Format (copy-paste template):**
```
✅ TASK [X] COMPLETE

What Works:
- [Feature 1] ✓ Tested in browser
- [Feature 2] ✓ Verified real data
- [Feature 3] ✓ Error handling works

Evidence:
- Screenshot: [brief description]
- Browser: localhost:3000/dashboard/products works
- No console errors

Next: Starting TASK [X+1]
```

**DO NOT send:**
- [ ] Progress updates during task
- [ ] Recap unless asked
- [ ] Status reports unless feature proven in browser

---

## 🛑 BLOCKERS & ESCALATION

**If stuck >30 minutes:**
```
Message owner with:
1. What you're trying to do
2. What error/blocker you hit
3. Screenshot of error
4. Request: "Can you clarify X?" or "Should I approach this differently?"

DO NOT:
- Guess/workaround without confirmation
- Try alternate implementation without asking
- Continue to next task without unblocking
```

---

## ✅ SUCCESS CHECKPOINT

**After Task 7, owner can:**
- [ ] Open browser, see real products
- [ ] Click sync button, see feedback
- [ ] Understand what happened from UI (no logs needed)
- [ ] Test 10 products successfully
- [ ] Verify in Shopee (prices, titles, images correct)
- [ ] Share dashboard with business partner (it works)

**If ALL above true → READY FOR COMMIT**

---

## 🎯 FOCUS RULES

**DO:**
- ✅ Build real, production-ready code
- ✅ Test every feature in actual browser
- ✅ Make error messages clear for non-technical user
- ✅ Keep code simple (no over-engineering)
- ✅ Auto-continue tasks (save time/credits)

**DON'T:**
- ❌ Commit without owner approval
- ❌ Add dummy/mock data (use real DB)
- ❌ Skip browser testing (code-only testing doesn't count)
- ❌ Create feature you can't test in browser
- ❌ Recap/report unless explicitly asked

---

## 🟢 READY TO START

**Kiro, start TASK 1 immediately.**

When TASK 1 is proven working in browser (owner can see real products):
→ Auto-proceed to TASK 2 (don't wait, don't recap)

Continue this flow until Task 7 complete or blocked.

**Goal:** 1 week, real working browser experience, owner can test themselves.

---

**Status:** 🚀 PLAN READY  
**Date:** November 2, 2025  
**Mode:** Continuous Auto-Task Execution  
**Await:** Start signal from owner, then go!