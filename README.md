# SyncStore 🏪

> Cross-platform e-commerce store management system for unified multi-marketplace operations

**Current Status**: Shopee Integration 85% Complete | Ready for AI-Assisted Development

[![Development Status](https://img.shields.io/badge/Status-Active%20Development-green.svg)](https://github.com/kerjaptc/syncstore)
[![Shopee Integration](https://img.shields.io/badge/Shopee-85%25%20Complete-orange.svg)](docs/development/shopee-integration/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Overview

SyncStore is a comprehensive cross-platform e-commerce management system designed to unify store operations across multiple marketplaces and channels. It provides centralized control for multi-platform selling operations, focusing on synchronizing inventory, managing orders, and providing business intelligence.

**🎯 Current Development Focus**: Completing Shopee integration and preparing for multi-platform expansion.

### ✅ Implemented Features

- 🔐 **Authentication System**: Clerk integration fully functional
- 🏗️ **Core Infrastructure**: Database, API routes, middleware (95% complete)
- 🛍️ **Shopee Integration**: OAuth flow, store connection, UI components (85% complete)
- 🎨 **Modern Dashboard**: Responsive UI with store management interface
- 🔒 **Security**: Credential encryption, multi-tenant isolation
- 📊 **Monitoring**: Error tracking with Sentry, performance monitoring

### 🔄 In Development

- 🛍️ **Shopee Product Sync**: API integration and data mapping
- 📦 **Inventory Management**: Real-time stock synchronization
- 📋 **Order Processing**: Unified order management interface

### 📋 Planned Features

- 🔗 **TikTok Shop Integration**: Multi-platform expansion
- 📊 **Advanced Analytics**: Business intelligence and reporting
- ⚡ **Real-Time Sync**: Automated synchronization with conflict resolution
- 🌐 **Custom Website**: Integrated e-commerce storefront

## 🏗️ Architecture

StoreSync follows a modular monolith architecture with microservices readiness:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Web App       │  │   Mobile Web    │  │   Admin Panel   │  │
│  │  (Next.js 15)   │  │   (Responsive)  │  │   (Dashboard)   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└────────────────┬────────────────────────────────────────────────┘
                 │ HTTPS/WebSocket
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  API GATEWAY LAYER                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │           Next.js App Router + tRPC                         │ │
│  │     (Authentication, Rate Limiting, Request Routing)        │ │
│  └─────────────────────────────────────────────────────────────┘ │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                 BUSINESS LOGIC LAYER                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │   Store     │ │  Inventory  │ │    Order    │ │ Integration │ │
│  │  Service    │ │   Service   │ │   Service   │ │   Service   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 🛠️ Tech Stack

### Core Technologies
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Clerk
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **State Management**: Zustand + tRPC
- **Testing**: Vitest + Testing Library

### Infrastructure
- **Hosting**: Vercel (✅ Active)
- **Database**: Neon PostgreSQL (✅ Active)
- **Authentication**: Clerk (✅ Active)
- **Monitoring**: Sentry (✅ Active)
- **Cache/Queue**: Redis (📋 Planned)
- **Analytics**: PostHog (📋 Planned)

## 🤖 For AI Development Tools

This project is **optimized for AI-assisted development** with:

### 📚 **Comprehensive Documentation**
- **Current Status**: [`docs/development/current-status.md`](docs/development/current-status.md)
- **Architecture**: [`docs/development/architecture.md`](docs/development/architecture.md)
- **Shopee Integration**: [`docs/development/shopee-integration/`](docs/development/shopee-integration/)
- **Next Steps**: [`docs/development/next-steps.md`](docs/development/next-steps.md)
- **Troubleshooting**: [`docs/development/troubleshooting.md`](docs/development/troubleshooting.md)

### 🎯 **Current Development Context**
- **Phase**: Shopee integration testing and refinement
- **Progress**: 85% complete, OAuth flow implemented
- **Next Priority**: Complete sandbox testing, implement product sync
- **Known Issues**: Configuration management, error handling refinement

### 🛠️ **Development Ready**
- ✅ **Core Infrastructure**: Authentication, database, API routes working
- ✅ **Development Environment**: Optimized scripts, diagnostic tools
- ✅ **Error Tracking**: Comprehensive logging and monitoring
- ✅ **Type Safety**: Full TypeScript implementation with strict types

### 📋 **Immediate Tasks Available**
1. Complete Shopee sandbox testing validation
2. Implement basic product synchronization
3. Enhance error handling and user feedback
4. Optimize API call patterns and caching

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm 8+ (or pnpm/yarn)
- PostgreSQL 15+ (for production database)
- Supabase account (recommended for database hosting)
- Clerk account (for authentication)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kerjaptc/syncstore.git
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
   
   Fill in the required environment variables:
   ```env
   # Authentication (Required) - Get from Clerk Dashboard
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
   CLERK_SECRET_KEY="sk_test_..."
   
   # Database (Required) - Get from Neon Dashboard
   DATABASE_URL="postgresql://username:password@host/database"
   
   # Security (Required) - Generate a secure 32+ character key
   ENCRYPTION_KEY="your-32-character-encryption-key-here"
   
   # Shopee Integration (Optional) - For marketplace integration
   SHOPEE_PARTNER_ID="your-partner-id"
   SHOPEE_PARTNER_KEY="your-partner-key"
   
   # Monitoring (Optional) - For error tracking
   SENTRY_DSN="your-sentry-dsn"
   ```

4. **Set up authentication (Clerk)**
   - Create account at [clerk.com](https://clerk.com)
   - Create new application
   - Copy API keys to `.env.local`

5. **Set up database (Neon)**
   - Create account at [neon.tech](https://neon.tech)
   - Create new project
   - Copy connection string to `.env.local`
   - Run migrations: `npm run db:migrate`

6. **Start the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📋 Development Workflow

### Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run dev:light        # Start with optimizations (recommended)
npm run build            # Build for production
npm run start            # Start production server

# Diagnostics & Maintenance
npm run diagnose         # Full system health check
npm run diagnose:env     # Check environment variables
npm run diagnose:db      # Check database connectivity
npm run fix:clerk        # Fix Clerk authentication issues

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run type-check       # Run TypeScript checks

# Testing
npm run test             # Run tests
npm run test:coverage    # Run tests with coverage

# Database
npm run db:migrate       # Run database migrations
npm run db:studio        # Open Drizzle Studio
npm run db:reset         # Reset database (development only)
```

### Code Style

This project uses:
- **ESLint** for code linting
- **Prettier** for code formatting
- **Husky** for git hooks
- **lint-staged** for pre-commit checks

### Testing Strategy

- **Unit Tests**: Service layer and utility functions
- **Integration Tests**: API endpoints and database operations
- **E2E Tests**: Critical user journeys
- **Coverage Target**: 80%+ for all metrics

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key | ✅ |
| `CLERK_SECRET_KEY` | Clerk secret key | ✅ |
| `ENCRYPTION_KEY` | 32+ character encryption key | ✅ |
| `REDIS_URL` | Redis connection string | ❌ |
| `SHOPEE_PARTNER_ID` | Shopee API partner ID | ❌ |
| `TIKTOK_SHOP_APP_KEY` | TikTok Shop API key | ❌ |

### Database Setup

1. **Create a PostgreSQL database**
2. **Set the `DATABASE_URL` environment variable**
3. **Run migrations**: `pnpm db:migrate`
4. **Seed data**: `pnpm db:seed`

### Authentication Setup (Clerk)

1. **Create a Clerk account** at [clerk.com](https://clerk.com)
2. **Create a new application**
3. **Copy the API keys** to your `.env.local` file
4. **Configure sign-in methods** in the Clerk dashboard

## 🔒 Security Features

- **Environment Validation**: Zod schemas for all environment variables
- **Data Encryption**: AES-256 encryption for sensitive data
- **Row Level Security**: Multi-tenant data isolation
- **CSRF Protection**: Built-in protection for state-changing operations
- **Rate Limiting**: API endpoint protection
- **Security Headers**: HSTS, CSP, and other security headers
- **Dependency Scanning**: Automated vulnerability scanning in CI/CD

## 📊 Monitoring & Observability

- **Error Tracking**: Sentry integration
- **Performance Monitoring**: Web Vitals and custom metrics
- **Structured Logging**: JSON logs with correlation IDs
- **Health Checks**: Automated system health monitoring
- **Alerting**: Real-time notifications for critical issues

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect your repository** to Vercel
2. **Set environment variables** in Vercel dashboard
3. **Deploy**: Automatic deployments on push to main

### Docker (Alternative)

```bash
# Build the Docker image
docker build -t storesync .

# Run the container
docker run -p 3000:3000 --env-file .env.local storesync
```

### Environment-Specific Deployments

- **Development**: `develop` branch → Staging environment
- **Production**: `main` branch → Production environment

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Process

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Add tests** for new functionality
5. **Run the test suite**: `pnpm test`
6. **Commit your changes**: `git commit -m 'Add amazing feature'`
7. **Push to the branch**: `git push origin feature/amazing-feature`
8. **Open a Pull Request**

### Code Review Process

- All changes require review from at least one maintainer
- Automated tests must pass
- Code coverage must not decrease
- Security scan must pass

## 📚 Documentation

- **API Documentation**: Available at `/api/docs` when running locally
- **Database Schema**: See `src/lib/db/schema.ts`
- **Architecture Decision Records**: See `docs/adr/`
- **Deployment Guide**: See `docs/deployment.md`

## 🐛 Troubleshooting

### Common Issues

**Database Connection Issues**
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Verify connection string format
DATABASE_URL="postgresql://username:password@host:port/database"
```

**Environment Variable Issues**
```bash
# Validate environment variables
pnpm type-check

# Check for missing variables
SKIP_ENV_VALIDATION=false pnpm build
```

**Build Issues**
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) for the amazing framework
- [Clerk](https://clerk.com/) for authentication
- [Drizzle](https://orm.drizzle.team/) for the type-safe ORM
- [shadcn/ui](https://ui.shadcn.com/) for the beautiful components
- [Vercel](https://vercel.com/) for hosting and deployment

## 📞 Support

- **Documentation**: [docs.syncstore.com](https://docs.syncstore.com)
- **Issues**: [GitHub Issues](https://github.com/kerjaptc/syncstore/issues)
- **Discussions**: [GitHub Discussions](https://github.com/kerjaptc/syncstore/discussions)
- **Email**: support@syncstore.com

---

**Built with ❤️ by the SyncStore Team**