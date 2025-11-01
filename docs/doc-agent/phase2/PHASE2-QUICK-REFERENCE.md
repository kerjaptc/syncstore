# 🎯 PHASE 2 QUICK REFERENCE - KIRO
## TL;DR Version (Read this in 5 minutes)

**Date:** November 2, 2025  
**Duration:** 2 weeks  
**For:** Kiro (when you're overwhelmed)  

---

## 🔴 YOU ONLY NEED TO DO 5 THINGS

### Week 1 (Days 1-5)

1. **Days 1-2: Build Dashboard**
   - Show product list (with pricing)
   - Show product detail (master vs platform fields)
   - Location: `src/app/dashboard/products/`
   - Tech: Next.js 15 + shadcn/ui + Tailwind

2. **Day 3: Add Sync Button**
   - Manual sync endpoint: `POST /api/sync/manual`
   - Takes: `{product_id, platform}`
   - Returns: `{success, data}`

3. **Days 4-5: Test with 2 Products**
   - Pick 1 simple, 1 with variants
   - Sync to Shopee, verify in marketplace
   - Sync to TikTok, verify in marketplace
   - Check: price, title, images, mapping all correct
   - Document: Test Report

### Week 2 (Days 6-10)

4. **Days 6-8: Automated Sync Engine**
   - Install: BullMQ + Redis
   - Create: Job queue for batch sync
   - Add: Retry logic + error handling
   - Location: `src/lib/queue/`

5. **Days 9-10: Batch Test & Validation**
   - Test with 10 products → Success
   - Scale to 50 products → Success
   - Run validation checks (pricing, SEO, mapping)
   - Create rollback plan
   - Get owner approval

---

## ⚡ Daily Checklist

**Copy-paste one of these into your daily update:**

```
✅ Day 1
- Created product list page
- Created product detail page
- Set up dashboard structure

✅ Day 2
- Product list: pagination working
- Product detail: all fields displaying
- Responsive design complete

✅ Day 3
- Manual sync endpoint created
- Sync button on UI working
- Logging implemented

✅ Day 4
- Select 2 test products
- Manual sync to Shopee (product 1)
- Verify results in Shopee marketplace

✅ Day 5
- Manual sync to TikTok (product 1)
- Test product 2 (with variants)
- Verify all results
- Document test report

✅ Day 6
- BullMQ + Redis installed
- Job queue created
- Can add jobs to queue

✅ Day 7
- Job status tracking working
- Logging to database functional
- Progress bar on UI

✅ Day 8
- Retry logic implemented
- Error handling working
- Dead-letter queue set up

✅ Day 9
- Batch sync 10 products: PASS
- Batch sync 50 products: PASS
- All spot checks: OK

✅ Day 10
- Validation checks complete
- Rollback plan created
- Owner approval obtained
```

---

## 🚫 THINGS YOU MUST NOT DO

| ❌ DON'T | ✅ DO INSTEAD |
|---------|-------------|
| Order management | Sync products only |
| Analytics/reporting | Focus on pricing sync |
| Finance calculations | Let pricing system do it |
| Advanced features | Keep it simple |
| Sync all 4k at once | Batch in 50s first |
| Skip manual testing | Test 2 products first |
| Ignore errors | Fix before scaling |
| Deploy without testing | Get approval first |

---

## 📊 Success = Day 10 Checklist

- [ ] Dashboard shows all products ✓
- [ ] Manual sync works (2 products tested) ✓
- [ ] Batch sync works (50 products tested) ✓
- [ ] Pricing 100% accurate ✓
- [ ] SEO titles correct ✓
- [ ] No data corruption ✓
- [ ] Rollback plan ready ✓
- [ ] Owner approved ✓

If ALL checked → Phase 2 DONE

---

## 🆘 If Confused

1. **"I don't know what to do today"**
   → Open full guide: PHASE2-KIRO-EXECUTION-PLAN.md

2. **"I'm stuck on X"**
   → Email owner with: what you're trying to do, what's happening, what error you see

3. **"Should I build X feature?"**
   → If it's not on this list: DON'T. Only sync + pricing this phase.

4. **"How do I...?"**
   → Check full guide's day-by-day breakdown

---

## 💬 What to Send Owner Every Evening

```
✅ [Day X] - [What you accomplished]
🚀 [Day X+1] - [What you'll do tomorrow]
⚠️ Blockers: [Any problems? Or "None"]
```

That's it.

---

**Status:** Ready to start  
**Send to Kiro:** PHASE2-KIRO-EXECUTION-PLAN.md (main) + This file (quick reference)