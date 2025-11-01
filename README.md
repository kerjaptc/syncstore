# 🚀 SyncStore - E-commerce Multi-Platform Management System

> A comprehensive solution for managing FPV drone parts across multiple e-commerce platforms with automated synchronization, inventory management, and analytics.

[![Phase 1](https://img.shields.io/badge/Phase%201-Complete-success)](./docs/phase1/)
[![Phase 2](https://img.shields.io/badge/Phase%202-Planned-blue)](./.kiro/specs/syncstore-phase2/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](./LICENSE)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Project Status](#project-status)
- [Documentation](#documentation)
- [Technology Stack](#technology-stack)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

SyncStore is a personal e-commerce management system designed to streamline product management across multiple marketplace platforms. It provides a unified master catalog, automated synchronization, intelligent pricing, and SEO optimization.

### Key Objectives

1. **Unified Product Management** - Single source of truth for all products
2. **Multi-Platform Sync** - Automated synchronization to Shopee, TikTok Shop, and more
3. **Intelligent Pricing** - Platform-specific pricing with fee calculations
4. **SEO Optimization** - Automated title generation with platform variations
5. **Inventory Management** - Real-time stock tracking across platforms
6. **Analytics & Insights** - Performance tracking and reporting

---

## ✨ Features

### Phase 1 (✅ Complete)

#### Data Import & Management
- ✅ Import products from Shopee and TikTok Shop
- ✅ Automated data validation and transformation
- ✅ Master catalog with unified schema
- ✅ Platform-specific mappings
- ✅ Batch processing with error handling

#### Pricing System
- ✅ Base price calculation
- ✅ Platform-specific fee calculations
- ✅ Configurable pricing rules
- ✅ 95%+ pricing accuracy
- ✅ Performance optimized (< 100ms)

#### SEO System
- ✅ Automated title generation
- ✅ 70-80% similarity with variations
- ✅ Platform-specific optimizations
- ✅ Keyword integration
- ✅ Quality scoring

#### Testing & Validation
- ✅ Comprehensive data validator
- ✅ Pricing and SEO tester
- ✅ Integration tests
- ✅ Performance tests
- ✅ 80%+ test coverage

### Phase 2 (📋 Planned)

#### Web Dashboard
- 📋 Product management interface
- 📋 Dashboard with analytics
- 📋 Responsive design
- 📋 Real-time updates

#### Synchronization
- 📋 Automated sync to platforms
- 📋 Job queue system (BullMQ)
- 📋 Retry logic and error handling
- 📋 Sync monitoring and logs

#### Inventory Management
- 📋 Cross-platform inventory sync
- 📋 Low-stock alerts
- 📋 Inventory history tracking
- 📋 Real-time updates

#### Advanced Features
- 📋 Webhook integration
- 📋 Conflict resolution
- 📋 Bulk operations
- 📋 Analytics & reporting
- 📋 Dry-run mode
- 📋 Event sourcing

---

## 🏗️ Architecture

### Current Architecture (Phase 1)

```
┌─────────────────────────────────────────────────────┐
│                  Next.js Application                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │   Importers  │  │   Pricing    │  │    SEO    │ │
│  │   (Shopee,   │  │  Calculator  │  │ Generator │ │
│  │  TikTokShop) │  │              │  │           │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              PostgreSQL Database (Neon)              │
│  ┌──────────────────────────────────────────────┐  │
│  │  Master Catalog + Platform Mappings          │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Planned Architecture (Phase 2)

```
┌──────────────────────────────────────────────────────┐
│                    VERCEL                             │
│  Frontend (Next.js 15 + React 18) + API Routes       │
│  Authentication: Clerk                                │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│                 UPSTASH REDIS                         │
│  Job Queue + Cache + Rate Limiting                   │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│              RAILWAY/RENDER                           │
│  BullMQ Workers (Sync, Webhook, Outbox, Cleanup)    │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│            NEON/SUPABASE POSTGRESQL                   │
│  Master Catalog + 10 New Tables                      │
└──────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Shopee API credentials
- TikTok Shop API credentials

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd syncstore
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your credentials:
   ```env
   DATABASE_URL=your_postgresql_url
   SHOPEE_PARTNER_ID=your_shopee_partner_id
   SHOPEE_PARTNER_KEY=your_shopee_partner_key
   TIKTOKSHOP_APP_KEY=your_tiktokshop_app_key
   TIKTOKSHOP_APP_SECRET=your_tiktokshop_app_secret
   ```

4. **Run database migrations**
   ```bash
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open browser**
   ```
   http://localhost:3000
   ```

### Quick Start Scripts

```bash
# Import Shopee products
npm run import:shopee

# Import TikTok Shop products
npm run import:tiktokshop

# Validate data
npm run validate:data

# Test pricing and SEO
npm run test:pricing-seo

# Check task completion
npm run check:tasks
```

---

## 📊 Project Status

### Phase 1: Backend Foundation ✅

| Component | Status | Completion |
|-----------|--------|------------|
| Data Import | ✅ Complete | 100% |
| Master Catalog | ✅ Complete | 100% |
| Pricing System | ✅ Complete | 100% |
| SEO System | ✅ Complete | 100% |
| Testing | ✅ Complete | 100% |
| Documentation | ✅ Complete | 100% |

**Overall: 41/41 tasks completed (100%)**

### Phase 2: UI & Synchronization 📋

| Component | Status | Completion |
|-----------|--------|------------|
| Planning | ✅ Complete | 100% |
| Infrastructure | 📋 Planned | 0% |
| Dashboard UI | 📋 Planned | 0% |
| Sync Engine | 📋 Planned | 0% |
| Webhooks | 📋 Planned | 0% |
| Analytics | 📋 Planned | 0% |

**Overall: 0/60+ tasks completed (0%)**

See [PROJECT-STATUS.md](./docs/PROJECT-STATUS.md) for detailed status.

---

## 📚 Documentation

### Phase 1 Documentation
- [Requirements](./kiro/specs/syncstore-phase1/requirements.md)
- [Design](./kiro/specs/syncstore-phase1/design.md)
- [Tasks](./kiro/specs/syncstore-phase1/tasks.md)
- [Technical Documentation](./docs/phase1/technical-documentation.md)
- [Completion Report](./docs/phase1/phase1-completion-report.md)
- [Final Validation Report](./docs/phase1/final-validation-report.md)

### Phase 2 Documentation
- [Requirements](./kiro/specs/syncstore-phase2/requirements.md)
- [Design](./kiro/specs/syncstore-phase2/design.md)
- [Tasks](./kiro/specs/syncstore-phase2/tasks.md)
- [Overview](./kiro/specs/syncstore-phase2/PHASE2-OVERVIEW.md)
- [Design Updates](./kiro/specs/syncstore-phase2/DESIGN-UPDATES.md)
- [Ready to Start](./kiro/specs/syncstore-phase2/READY-TO-START.md)

### Additional Documentation
- [Project Status](./docs/PROJECT-STATUS.md)
- [Changelog](./CHANGELOG.md)
- [Troubleshooting Guide](./docs/phase1/troubleshooting-guide.md)

---

## 🛠️ Technology Stack

### Frontend
- **Framework:** Next.js 15 (App Router)
- **UI Library:** React 18
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui (Phase 2)
- **State Management:** Zustand (Phase 2)
- **Data Fetching:** TanStack Query (Phase 2)

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Next.js API Routes
- **ORM:** Drizzle
- **Database:** PostgreSQL (Neon)
- **Authentication:** Clerk (Phase 2)
- **Job Queue:** BullMQ (Phase 2)
- **Cache:** Redis (Upstash) (Phase 2)

### Testing
- **Framework:** Vitest
- **Coverage:** 80%+
- **E2E:** Playwright (planned)

### DevOps
- **Hosting:** Vercel
- **Database:** Neon
- **Workers:** Railway/Render (Phase 2)
- **Monitoring:** Sentry, LogRocket (Phase 2)
- **CI/CD:** GitHub Actions (planned)

---

## 💻 Development

### Project Structure

```
syncstore/
├── .kiro/specs/          # Project specifications
├── docs/                 # Documentation
├── src/
│   ├── app/             # Next.js app directory
│   ├── lib/             # Core business logic
│   │   ├── importers/   # Platform importers
│   │   ├── validators/  # Data validators
│   │   ├── pricing/     # Pricing calculator
│   │   ├── seo/         # SEO title generator
│   │   ├── schema/      # Data schemas
│   │   ├── db/          # Database schema
│   │   └── services/    # Business services
│   └── components/      # React components (Phase 2)
├── scripts/             # Automation scripts
├── data/                # Raw data imports
└── drizzle/             # Database migrations
```

### Available Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm run type-check       # Run TypeScript check

# Database
npm run db:push          # Push schema changes
npm run db:studio        # Open Drizzle Studio
npm run db:generate      # Generate migrations

# Testing
npm run test             # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report

# Phase 1 Scripts
npm run import:shopee    # Import Shopee products
npm run import:tiktokshop # Import TikTok Shop products
npm run validate:data    # Validate all data
npm run test:pricing-seo # Test pricing and SEO
npm run check:tasks      # Check task completion
```

### Coding Standards

- **TypeScript:** Strict mode enabled
- **ESLint:** Airbnb config with custom rules
- **Prettier:** Automatic formatting
- **Commit Messages:** Conventional commits
- **Testing:** Minimum 80% coverage

---

## 🚢 Deployment

### Current Deployment (Phase 1)

**Platform:** Vercel  
**Database:** Neon PostgreSQL  
**Status:** Development

### Planned Deployment (Phase 2)

**Frontend & API:** Vercel  
**Workers:** Railway or Render  
**Database:** Neon or Supabase  
**Cache/Queue:** Upstash Redis  
**Monitoring:** Sentry + LogRocket

### Environment Variables

Required environment variables:

```env
# Database
DATABASE_URL=

# Shopee API
SHOPEE_PARTNER_ID=
SHOPEE_PARTNER_KEY=
SHOPEE_REDIRECT_URL=

# TikTok Shop API
TIKTOKSHOP_APP_KEY=
TIKTOKSHOP_APP_SECRET=
TIKTOKSHOP_REDIRECT_URL=

# Phase 2 (Additional)
REDIS_URL=
CLERK_SECRET_KEY=
ENCRYPTION_KEY=
SENTRY_DSN=
```

---

## 🤝 Contributing

This is a private project. For internal contributions:

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Update documentation
5. Submit for review

---

## 📈 Statistics

### Phase 1 Achievements
- **Products Imported:** 4,147
- **Shopee Products:** 3,647
- **TikTok Shop Products:** 500
- **Data Quality Score:** 95%+
- **Test Coverage:** 80%+
- **Tasks Completed:** 41/41 (100%)
- **Documentation Pages:** 15+

### Performance Metrics
- **Pricing Calculation:** < 100ms average
- **SEO Generation:** < 200ms average
- **Data Import:** 4,147 products processed
- **Validation Success:** 95%+

---

## 📄 License

Proprietary - All rights reserved

---

## 🙏 Acknowledgments

- Built with Next.js, React, and TypeScript
- Database powered by Neon PostgreSQL
- ORM by Drizzle
- UI components by shadcn/ui
- Developed with AI assistance (Kiro)

---

## 📞 Support

For questions or issues:
- Check [Documentation](./docs/)
- Review [Project Status](./docs/PROJECT-STATUS.md)
- See [Troubleshooting Guide](./docs/phase1/troubleshooting-guide.md)

---

**Built with ❤️ for efficient e-commerce management**

*Last Updated: ${new Date().toISOString().split('T')[0]}*
