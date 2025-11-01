# SyncStore - Agent Ready Kit - Quick Reference
## Everything Kiro Needs to Start Phase 1

**Date:** November 1, 2025  
**Status:** ✅ READY FOR IMPLEMENTATION  

---

## 📚 Documentation Files Prepared

You have been provided with 4 comprehensive documentation files:

### 1. **agent-dev-guide.md** (MAIN REFERENCE)
   **When to use:** Start here first
   - Complete project context and business model
   - Current development status
   - Phase 1 detailed breakdown
   - API credential management
   - Development workflow
   - Testing & troubleshooting

### 2. **master-product-schema.md** (TECHNICAL REFERENCE)
   **When to use:** While implementing data import
   - Field mapping between platforms
   - Master schema structure
   - Platform-specific mappings
   - Pricing calculations with examples
   - SEO title variations strategy
   - CSV import template

### 3. **phase1-execution-checklist.md** (DAY-TO-DAY GUIDE)
   **When to use:** Daily development reference
   - 4-week execution plan with daily checklists
   - Week 1: Analysis & Setup
   - Week 2: Data Import Implementation
   - Week 3: Master Schema Design
   - Week 4: Testing & Validation
   - Communication templates
   - Quick reference commands

### 4. **This File: quick-reference.md**
   **When to use:** Quick lookups, daily standup
   - Key business facts
   - Success criteria
   - Critical commands
   - Timeline overview
   - Immediate action items

---

## 🎯 QUICK PROJECT FACTS

**Project:** SyncStore (Personal Edition)  
**Owner:** [FPV 3D Printing Business]  
**GitHub:** https://github.com/crypcodes/syncstore  

### Business Model
```
Business: 3D Printing Services for FPV Drone Parts (3 years old)
Products: ~500 items with variants (pre-order, 5-day delivery promise)
Platforms: Shopee (primary) + TikTok Shop (+ Tokopedia auto)
Future: motekarfpv.com (own website)

Pain Point: Manual sync across platforms → causing data inconsistency

Solution: SyncStore = Centralized master catalog with auto-sync
```

### Pricing Strategy
```
Master Price = Cost + Margin

Platform-Specific:
├─ Shopee = Master × 1.15 (15% fee)
├─ TikTok = Master × 1.20 (20% fee)
├─ Website = Master × 1.00 (0% fee = direct sales benefit)

Example:
├─ Master: Rp 150,000
├─ Shopee: Rp 172,500
├─ TikTok: Rp 180,000
└─ Website: Rp 150,000
```

---

## 🚀 IMMEDIATE ACTION ITEMS (Next 48 Hours)

**TODAY (If Starting Today):**

1. **Read Core Documents** (2-3 hours)
   ```bash
   # In order:
   1. agent-dev-guide.md (sections 1-2: context + status)
   2. master-product-schema.md (quick reference table)
   3. phase1-execution-checklist.md (Week 1 overview)
   ```

2. **Set Up Environment** (1-2 hours)
   ```bash
   git clone https://github.com/crypcodes/syncstore.git
   cd syncstore
   npm install
   cp .env.example .env.local
   npm run diagnose
   ```

3. **Verify Credentials** (30 min)
   ```bash
   npm run diagnose:env
   # Check: SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY, DATABASE_URL present
   ```

**TOMORROW:**
- Test API credentials (Shopee + TikTok Shop OAuth flows)
- Create field mapping analysis spreadsheet
- Document actual data structure from APIs

---

## ✅ PHASE 1 SUCCESS CRITERIA

**MUST HAVE (Go/No-Go):**
- ✓ ~500 Shopee products imported into master catalog
- ✓ ~500 TikTok products imported into master catalog
- ✓ Master schema designed and documented
- ✓ Field mapping complete (common vs platform-specific)
- ✓ Pricing calculation verified
- ✓ All data validated (>95% success rate)
- ✓ No data loss or corruption

**SHOULD HAVE:**
- Documentation complete
- Import performance metrics
- SEO title variations generated
- Database optimized with indexes

**Success Metric:** Single product input in master → auto-syncs to Shopee + TikTok with correct pricing

---

## 🔑 KEY CREDENTIALS & CONFIGURATION

### What You'll Need

**Shopee API:**
```
SHOPEE_PARTNER_ID = [numeric ID from Shopee Developer Console]
SHOPEE_PARTNER_KEY = [32+ character secret key]
Callback URL = https://yourdomain.com/api/shopee/callback
Base URL = https://partner.shopeemobile.com/api/v2
```

**TikTok Shop API:**
```
TIKTOK_SHOP_APP_KEY = [from Partner Center]
TIKTOK_SHOP_APP_SECRET = [from Partner Center]
Callback URL = https://yourdomain.com/api/tiktokshop/callback
Base URL = https://open-api.tiktokglobalshop.com
Tokopedia Flag = include_tokopedia: true (auto in TikTok Shop)
```

**Database:**
```
DATABASE_URL = postgresql://user:password@host:5432/db_name
(Neon recommended: neon.tech)
```

### Environment File Template
```env
# Copy to .env.local (NEVER commit)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
ENCRYPTION_KEY=your-32-character-key-here

DATABASE_URL=postgresql://...

SHOPEE_PARTNER_ID=...
SHOPEE_PARTNER_KEY=...
SHOPEE_SANDBOX_MODE=true # true for testing

TIKTOK_SHOP_APP_KEY=...
TIKTOK_SHOP_APP_SECRET=...
TIKTOK_SHOP_SANDBOX_MODE=true

SENTRY_DSN=...
```

---

## 📊 PHASE 1 TIMELINE

```
WEEK 1: Analysis & Setup (Days 1-5)
├─ Mon: Project kickoff + environment setup
├─ Tue: Credentials setup + API testing
├─ Wed: API documentation review + field mapping
├─ Thu: Data import planning
└─ Fri: Week review + Week 2 planning

WEEK 2: Data Import (Days 6-10)
├─ Mon: Shopee import API integration
├─ Tue: Execute Shopee import (~500 products)
├─ Wed: TikTok Shop import API integration
├─ Thu: Execute TikTok Shop import (~500 products)
└─ Fri: Data analysis + comparison

WEEK 3: Master Schema Design (Days 11-15)
├─ Mon-Tue: Refine schema based on actual data
├─ Wed-Thu: Database migrations + data population
└─ Fri: Verification

WEEK 4: Testing & Validation (Days 16-20)
├─ Mon-Wed: Comprehensive testing
├─ Thu: Documentation finalization
└─ Fri: Phase 1 sign-off + Phase 2 readiness

TOTAL: 4 weeks (28 days)
```

---

## 🛠️ ESSENTIAL COMMANDS

```bash
# DIAGNOSTICS
npm run diagnose                # Full system check (START HERE)
npm run diagnose:env            # Check environment variables
npm run diagnose:db             # Check database connection

# DATABASE
npm run db:migrate              # Apply migrations
npm run db:studio               # Open local DB viewer
npm run db:reset                # Reset DB (dev only!)

# DEVELOPMENT
npm run dev                     # Start development server
npm run dev:light               # Optimized dev (recommended)
npm run lint:fix               # Fix linting issues
npm run type-check             # TypeScript validation
npm run test                   # Run tests

# CODE QUALITY
npm run lint                   # ESLint check
npm run format                 # Prettier formatting

# IMPORT OPERATIONS (to be implemented)
npm run import:shopee          # Import from Shopee API
npm run import:tiktok          # Import from TikTok Shop API

# MONITORING
tail -f logs/error.log         # View error logs
tail -f logs/app.log           # View app logs
```

---

## ⚠️ CRITICAL DON'Ts

**SECURITY:**
- ❌ Never commit .env.local to Git
- ❌ Never expose SHOPEE_PARTNER_KEY in logs/console
- ❌ Never share ENCRYPTION_KEY with anyone
- ❌ Never log full API tokens (truncate in logs)
- ✅ Always encrypt sensitive credentials

**DATA:**
- ❌ Never delete production data without backup
- ❌ Never run db:reset on production
- ❌ Never modify existing products without validation
- ✅ Always test with small datasets first (5-10 products)

**API USAGE:**
- ❌ Don't exceed rate limits (Shopee ~100 req/min)
- ❌ Don't ignore 429 responses (implement backoff)
- ❌ Don't make concurrent requests without throttling
- ✅ Always implement exponential backoff

**GIT:**
- ❌ Don't commit secrets
- ❌ Don't force push to main/develop
- ❌ Don't skip testing before commit
- ✅ Always write descriptive commit messages

---

## 🔍 FIELD MAPPING SUMMARY

### Common Fields (Both Platforms - ~90% data)
```
✓ product_title/name
✓ product_description
✓ product_images
✓ base_price
✓ weight
✓ dimensions
✓ category
✓ variants (color, size, etc.)
```

### Platform-Specific (Required for each)
```
SHOPEE ONLY:
├─ shopee_item_id
├─ shopee_category_id
├─ shipping_template_id
└─ shopee_model_ids (for variants)

TIKTOK SHOP ONLY:
├─ tiktok_product_id
├─ tiktok_category_id
├─ include_tokopedia (boolean)
└─ fulfillment_type

WEBSITE (FUTURE):
├─ slug
├─ meta_description
└─ custom_fields (print_time, material, etc.)
```

### SEO Title Variations (70% similar, 30% unique)
```
Master: "Frame Racing 5 Inch Carbon Fiber"

Shopee: "Frame 5 Inch Racing Carbon Fiber Ringan - Grosir Ready [BEST SELLER]"
(Added: Ringan=light, Grosir=volume, BEST SELLER=social proof)

TikTok: "Racing Frame 5 Inch Carbon - Ringan & Kuat Banget untuk FPV"
(Added: Kuat=strong, casual language, use case)

Website: "5-Inch Racing Drone Frame - Premium Carbon Fiber | Motekar FPV"
(Professional, brand, keywords)
```

---

## 📈 SUCCESS METRICS

### What Success Looks Like

**By End of Week 1:**
- Environment fully set up ✓
- All credentials tested ✓
- Field mapping identified ✓
- Import strategy ready ✓

**By End of Week 2:**
- 500 Shopee products imported ✓
- 500 TikTok products imported ✓
- Data validation >95% ✓
- Import reports generated ✓

**By End of Week 3:**
- Master schema finalized ✓
- Database migrations applied ✓
- All products mapped ✓
- Pricing verified ✓

**By End of Week 4:**
- All validation passed ✓
- Documentation complete ✓
- Phase 1 sign-off ✓
- Ready for Phase 2 ✓

**Phase 1 Complete Success:**
```
INPUT: 1 product in SyncStore master catalog
OUTPUT: 
├─ Auto-appears in Shopee with Rp 172,500 (+15%)
├─ Auto-appears in TikTok with Rp 180,000 (+20%)
├─ (Future) Auto-appears in website with Rp 150,000
└─ All with SEO-optimized titles per platform
```

---

## 🆘 QUICK TROUBLESHOOTING

| Problem | Solution | Reference |
|---------|----------|-----------|
| "Cannot connect to database" | Check DATABASE_URL, verify Neon is running | agent-dev-guide.md §7.1 |
| "API auth failed" | Verify Partner ID/Key, check .env.local | agent-dev-guide.md §4 |
| "Rate limited (429)" | Implement backoff, reduce request rate | agent-dev-guide.md §7 |
| "Data mismatch" | Cross-check platform field names | master-product-schema.md |
| "TypeScript errors" | Run npm run type-check | phase1-execution-checklist.md |
| "Variant mapping wrong" | Verify platform IDs match | master-product-schema.md |
| "Image 404" | Check URLs still active in Shopee/TikTok | phase1-execution-checklist.md |

---

## 📞 SUPPORT & ESCALATION

**Quick Issues:**
1. Check troubleshooting guide first
2. Run diagnostic commands
3. Review related documentation section

**Complex Issues:**
1. Document error completely (message, steps, expected vs actual)
2. Run: `npm run diagnose > diagnostic-report.txt`
3. Check Sentry error dashboard
4. Review recent Git changes

**For Owner/Stakeholders:**
- Daily standup format provided in phase1-execution-checklist.md
- Weekly summary template provided
- Critical blockers escalated immediately

---

## 📋 DAILY STANDUP TEMPLATE

Copy this to Slack/email at end of each day:

```
📊 SyncStore Phase 1 - Daily Update [DATE]

✅ Completed Today:
- [Task 1]
- [Task 2]

🚀 In Progress:
- [Task 3] - [%] complete

🎯 Tomorrow's Plan:
- [Task 4]

⚠️ Blockers:
- [If any]

📈 Progress: [Week] Day [#] | Phase 1: [X]% complete
```

---

## 🎯 THIS WEEK'S GOALS

**If Today is Monday (Week 1):**
- [ ] Read all 4 documentation files
- [ ] Set up development environment
- [ ] Test API credentials
- [ ] Create field mapping spreadsheet
- [ ] Define import strategy

**Success = Ready to start data import on Monday Week 2**

---

## 📞 QUICK CONTACT INFO

**Project Repository:** https://github.com/crypcodes/syncstore  
**Issue Tracking:** GitHub Issues (use labels: bug, feature, help-wanted)  
**Documentation:** `/docs` folder in repo  

**API Support:**
- Shopee: https://open.shopee.com (Developer Console)
- TikTok Shop: https://partner.tiktokshop.com (Partner Center)
- Database (Neon): https://console.neon.tech

---

## ✨ You Are Now Ready!

This kit provides everything needed for Phase 1 implementation:
1. ✅ Complete business context
2. ✅ Technical specifications
3. ✅ Day-by-day execution plan
4. ✅ Field mapping reference
5. ✅ Testing procedures
6. ✅ Troubleshooting guide
7. ✅ Communication templates

**Next Step:** Open `agent-dev-guide.md` Section 1 and begin!

---

**Kit Version:** 1.0  
**Prepared:** November 1, 2025  
**Status:** ✅ READY FOR AGENT EXECUTION  
**Target Start:** As soon as credentials are ready