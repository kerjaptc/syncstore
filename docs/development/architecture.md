# 🏗️ System Architecture

**Project**: StoreSync - Multi-platform E-commerce Management System  
**Architecture Pattern**: Modular Monolith with Microservices Readiness  
**Last Updated**: November 2024

## 🎯 Architecture Overview

StoreSync uses a **Modular Monolith** architecture that provides:
- Fast initial development and deployment
- Clear module boundaries for future microservices migration
- Easier debugging and maintenance during early stages
- Reduced operational complexity for MVP

## 🏛️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                                │
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
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ Analytics   │ │    User     │ │ Notification│ │   Sync      │ │
│  │  Service    │ │  Service    │ │   Service   │ │  Service    │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DATA ACCESS LAYER                              │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  Drizzle ORM                                │ │
│  └─────────────────────────────────────────────────────────────┘ │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PERSISTENCE LAYER                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ PostgreSQL  │ │    Redis    │ │    Files    │ │   Queues    │ │
│  │ (Primary)   │ │   (Cache)   │ │ (S3/Local)  │ │  (Redis)    │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                EXTERNAL INTEGRATIONS                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │   Shopee    │ │ TikTok Shop │ │   Custom    │ │   Future    │ │
│  │     API     │ │     API     │ │   Website   │ │ Platforms   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 🛠️ Technology Stack

### **Core Technologies**
| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Frontend** | Next.js | 15.x | Full-stack React framework |
| **Language** | TypeScript | 5.x | Type safety and developer experience |
| **Database** | PostgreSQL | 15+ | Primary data persistence |
| **ORM** | Drizzle | Latest | Type-safe database queries |
| **Cache/Queue** | Redis | 7.x | Caching and job queues |
| **Authentication** | Clerk | Latest | User management and auth |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS framework |
| **UI Components** | shadcn/ui | Latest | Pre-built component library |

### **External Services**
| Service | Provider | Purpose | Status |
|---------|----------|---------|---------|
| **Hosting** | Vercel | Frontend and API hosting | ✅ Active |
| **Database** | Neon | PostgreSQL hosting | ✅ Active |
| **Authentication** | Clerk | User management | ✅ Active |
| **Monitoring** | Sentry | Error monitoring | ✅ Active |

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── platforms/     # Platform integrations
│   │   │   └── shopee/    # Shopee-specific endpoints
│   │   └── stores/        # Store management endpoints
│   ├── dashboard/         # Protected dashboard pages
│   │   ├── stores/        # Store management UI
│   │   ├── products/      # Product management UI
│   │   └── orders/        # Order management UI
│   └── (auth)/           # Authentication pages
├── components/            # React components
│   ├── stores/           # Store-related components
│   ├── products/         # Product management components
│   └── ui/               # UI components (shadcn)
├── lib/                  # Utilities and configurations
│   ├── db/               # Database schemas and operations
│   ├── services/         # Business logic services
│   ├── shopee/           # Shopee integration logic
│   └── utils/            # Utility functions
└── types/                # TypeScript type definitions
```

## 🔄 Data Flow Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Customer  │    │   Seller    │    │   System    │
│   Orders    │────│   Actions   │────│   Events    │
│ (External)  │    │    (UI)     │    │ (Internal)  │
└─────────────┘    └─────────────┘    └─────────────┘
      │                    │                    │
      ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────┐
│              Event Processing Queue                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│  │   Order     │ │  Inventory  │ │    Sync     │    │
│  │   Events    │ │   Events    │ │   Events    │    │
│  └─────────────┘ └─────────────┘ └─────────────┘    │
└─────────────────────────────────────────────────────┘
      │                    │                    │
      ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────┐
│              Business Logic Handlers                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│  │   Process   │ │   Update    │ │  Propagate  │    │
│  │   Orders    │ │ Inventory   │ │   Changes   │    │
│  └─────────────┘ └─────────────┘ └─────────────┘    │
└─────────────────────────────────────────────────────┘
      │                    │                    │
      ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────┐
│                Database & Cache                     │
└─────────────────────────────────────────────────────┘
      │                    │                    │
      ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────┐
│            External Platform APIs                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│  │   Shopee    │ │ TikTok Shop │ │   Website   │    │
│  │  Updates    │ │  Updates    │ │  Updates    │    │
│  └─────────────┘ └─────────────┘ └─────────────┘    │
└─────────────────────────────────────────────────────┘
```

## 🔌 Platform Integration Architecture

### **Adapter Pattern Implementation**

```typescript
// Platform abstraction layer
interface PlatformAdapter {
  readonly platform: Platform;
  
  // Authentication
  authenticateStore(credentials: any): Promise<StoreConnection>;
  refreshToken(connection: StoreConnection): Promise<StoreConnection>;
  
  // Products
  fetchProducts(connection: StoreConnection, options?: FetchOptions): Promise<PlatformProduct[]>;
  updateProduct(connection: StoreConnection, product: PlatformProduct): Promise<void>;
  updateInventory(connection: StoreConnection, updates: InventoryUpdate[]): Promise<void>;
  
  // Orders
  fetchOrders(connection: StoreConnection, options?: FetchOptions): Promise<PlatformOrder[]>;
  updateOrderStatus(connection: StoreConnection, orderId: string, status: string): Promise<void>;
}

// Current Implementations
class ShopeeAdapter implements PlatformAdapter {
  // Shopee-specific API implementation
}

// Future Implementations
class TikTokShopAdapter implements PlatformAdapter {
  // TikTok Shop API implementation
}

class CustomWebsiteAdapter implements PlatformAdapter {
  // Custom website implementation
}
```

## 🗄️ Database Architecture

### **Core Entities**
- **Organizations**: Multi-tenant isolation
- **Users**: User management with role-based access
- **Platforms**: Marketplace definitions (Shopee, TikTok Shop, etc.)
- **Stores**: Platform-specific store connections
- **Products**: Master product catalog
- **Product Variants**: SKU-level product variations
- **Store Product Mappings**: Platform-specific product mappings
- **Inventory**: Multi-location inventory tracking
- **Orders**: Unified order management
- **Sync Jobs**: Background synchronization tracking

### **Multi-tenancy Strategy**
- **Organization-based isolation** using Row Level Security (RLS)
- **Encrypted credentials** for platform connections
- **Audit logging** for all data changes

## 🔐 Security Architecture

### **Authentication Flow**
1. User signs up/signs in via Clerk
2. JWT token issued with user ID
3. Organization membership verified
4. Row-level security policies enforce data isolation

### **Data Protection**
- **Encryption at Rest**: Platform credentials, sensitive customer data
- **Encryption in Transit**: HTTPS/TLS 1.3 for all communications
- **Secrets Management**: Organization-specific encryption keys

### **Authorization**
- **Role-Based Access Control** (Owner, Admin, Member, Viewer)
- **Resource-level permissions** for fine-grained access control
- **API rate limiting** and input validation

## 📊 Performance Architecture

### **Caching Strategy**
- **Application Cache**: Products (15m), Inventory (5m), Orders (10m)
- **API Response Cache**: Varies by endpoint and organization
- **Database Query Cache**: Optimized with proper indexing

### **Scalability Design**
- **Stateless application** design for horizontal scaling
- **Database connection pooling** for efficient resource usage
- **Background job processing** for heavy operations
- **CDN integration** for static assets

## 🔄 Synchronization Architecture

### **Sync Job System**
- **Scheduled synchronization** for regular updates
- **Event-driven sync** for real-time changes
- **Conflict resolution** algorithms for data consistency
- **Retry mechanisms** with exponential backoff

### **Data Consistency**
- **Optimistic locking** for concurrent updates
- **Audit trails** for all data changes
- **Transaction management** for data integrity

## 🚀 Deployment Architecture

### **Infrastructure**
```
┌─────────────────────────────────────────────────────────────┐
│                    Production Environment                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Vercel    │  │    Neon     │  │   Upstash   │          │
│  │ (Frontend   │  │ (Database)  │  │ (Redis &    │          │
│  │  & API)     │  │             │  │  Queue)     │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
├─────────────────────────────────────────────────────────────┤
│                    External Services                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │    Clerk    │  │   Sentry    │  │  PostHog    │          │
│  │   (Auth)    │  │(Monitoring) │  │(Analytics)  │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### **CI/CD Pipeline**
- **Automated testing** on pull requests
- **Preview deployments** for feature branches
- **Blue-green deployments** for production
- **Database migrations** with zero downtime

## 📈 Monitoring & Observability

### **Application Monitoring**
- **Error tracking** with Sentry
- **Performance monitoring** with Web Vitals
- **API response time** tracking
- **User behavior** analytics with PostHog

### **Infrastructure Monitoring**
- **Database performance** metrics
- **Resource utilization** tracking
- **Third-party API health** monitoring
- **Uptime monitoring** with alerts

## 🔮 Future Architecture Considerations

### **Microservices Migration Path**
- **Service boundaries** already defined in modules
- **API contracts** established with tRPC
- **Data isolation** prepared with clear schemas
- **Independent deployment** capabilities

### **Scalability Enhancements**
- **Event-driven architecture** for better decoupling
- **CQRS pattern** for read/write optimization
- **Message queues** for asynchronous processing
- **Multi-region deployment** for global scale

This architecture provides a solid foundation for the current requirements while maintaining flexibility for future growth and platform additions.