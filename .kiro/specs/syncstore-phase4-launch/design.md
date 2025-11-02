# Design Document - SyncStore Phase 4 Launch

## Overview

Phase 4 design fokus pada delivery fully operational platform dengan real data integration, comprehensive error handling, dan owner-ready testing. Semua functionality harus end-to-end dengan bukti konkret.

## Architecture

### System Flow

```
Browser → Dashboard → API Layer → Database
                ↓
         Sync Engine → Logs → Monitoring
```

**Components:**
- Frontend: Products table, sync controls, log viewer
- API: /api/products, /api/inventory, /api/sync/*
- Backend: PostgreSQL with Drizzle ORM
- Monitoring: Real-time logging and error tracking

### Data Flow

```
1. Seed DB (10+ products) → 2. API fetch → 3. Display table
4. User clicks sync → 5. Progress updates → 6. Logs stream → 7. Complete
```

## Components and Interfaces

### 1. Data Foundation

**Purpose:** Real, persistent product data

**Files:**
- `scripts/seed-products.ts` - Populate 10+ products
- `lib/db/products.ts` - Database layer with Drizzle ORM

**Key Interface:**
```typescript
interface ProductData {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  sku: string;
  syncStatus: 'synced' | 'pending' | 'syncing' | 'error';
  platforms: string[];
  lastSyncAt?: Date;
  images: string[];
}
```

**Guardrails:**
- Data must persist after reload
- Queries <500ms
- Log execution time

### 2. API Layer

**Purpose:** Reliable endpoints returning real data

**Endpoints:**
- GET /api/products - with pagination & search
- GET /api/inventory - stock levels
- PUT /api/inventory/[id] - update stock
- POST /api/sync/start - initiate sync
- GET /api/sync/status - progress (0-100%)
- GET /api/sync/logs - operation logs
- POST /api/sync/cancel - stop operation

**Key Interfaces:**
```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    timestamp: Date;
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
  };
}

interface SyncOperation {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
  logs: SyncLogEntry[];
}
```

**Guardrails:**
- Response time <500ms, >1s log warning
- All operations generate unique sync_id
- Sync timeout after 5min

### 3. Frontend Dashboard

**Purpose:** Functional UI with real data

**Components:**
- `ProductsTable.tsx` - Display products with pagination, search, batch selection
- `SyncPanel.tsx` - Sync controls with progress bar
- `LogViewer.tsx` - Expandable drawer with logs

**Key Interface:**
```typescript
interface DashboardState {
  products: ProductData[];
  loading: boolean;
  error: string | null;
  syncStatus: SyncOperation | null;
  selectedProducts: string[];
  currentPage: number;
  pageSize: number;
  searchQuery: string;
  logs: SyncLogEntry[];
}
```

**Features:**
- Pagination: Previous/Next, page size selector
- Search: 300ms debounce, case-insensitive
- Batch: Checkbox selection, "Select All"
- Status badges: green/yellow/red
- Log viewer: filter by level, search, export

**Guardrails:**
- Must render ≥10 products
- If empty, show error + seed instructions
- Disable sync button when no selection
- Show last 100 logs only

### 4. Error Handling

**Purpose:** Catch and recover from all error scenarios

**Components:**
- `ErrorBoundary.tsx` - Catch render errors, show fallback UI
- `errorHandler.ts` - Standardize API error responses
- `sessionManager.ts` - Monitor auth token, auto-refresh
- `ErrorToast.tsx` - User-friendly notifications

**Key Interface:**
```typescript
interface ErrorHandler {
  handleAPIError(error: Error): UserErrorMessage;
  handleComponentError(error: Error, context: string): void;
  showUserError(message: string, action?: () => void): void;
  logError(level: 'error' | 'warning', message: string, context?: object): void;
}
```

**Features:**
- Error boundary with "Try Again" button
- Retry logic: max 3 retries with exponential backoff
- Auto token refresh 5min before expiry
- Toast notifications: color-coded, auto-dismiss 5s
- Max 3 toasts visible

**Guardrails:**
- App must NOT crash on component error
- Timeout errors must retry
- Validate session every API call
- Never stack >3 toasts

### 5. Monitoring & Logging

**Purpose:** Track operations, errors, and performance

**Components:**
- `logger.ts` - Centralized logging (DEBUG, INFO, WARN, ERROR)
- `syncTracker.ts` - Track sync events and timing
- `performance.ts` - Monitor API response times
- `healthCheck.ts` - Periodic system health checks

**Key Interface:**
```typescript
interface Logger {
  debug(message: string, context?: object): void;
  info(message: string, context?: object): void;
  warn(message: string, context?: object): void;
  error(message: string, error?: Error, context?: object): void;
  getLogs(filter?: {level?: string, component?: string}): LogEntry[];
  exportLogs(): string;
}

interface SystemHealth {
  database: 'healthy' | 'degraded' | 'down';
  api: 'healthy' | 'degraded' | 'down';
  authentication: 'valid' | 'expired' | 'invalid';
  lastCheckTime: Date;
}
```

**Features:**
- Format: [HH:MM:SS] [LEVEL] [COMPONENT] message
- Store: console + persistent storage (max 1000 logs)
- Track API response times, log slow endpoints (>1s)
- Health checks every 30s
- Export logs as JSON

**Guardrails:**
- Sync logs persist across reload
- Log slow operations (>1s WARNING, >3s ERROR)
- Alert if critical service down
- No sensitive data in logs

## Implementation Phases

### Phase A: Data Foundation
- Seed script: 10+ products
- Data persists after reload
- Evidence: Screenshot + products.json

### Phase B: API Integration
- All endpoints return real data
- Pagination & search work
- Evidence: Postman screenshots

### Phase C: Sync Operations
- Sync button works
- Progress 0→100%
- Logs stream in real-time
- Evidence: Video + log file

### Phase D: Frontend Integration
- Table shows real data
- Pagination, search, batch work
- No console errors
- Evidence: Feature screenshots

### Phase E: Error Handling
- All error scenarios handled
- Error boundaries work
- Auth refresh works
- Evidence: Error screenshots

### Phase F: Documentation
- OWNER-GUIDE.md complete (15+ screenshots)
- TROUBLESHOOTING.md
- KNOWN-BUGS.md
- Evidence: All docs + logs

## Success Criteria

Phase 4 SUCCESS only if ALL true:
1. Dashboard shows ≥10 real products after reload
2. Sync functional: click → progress → complete
3. All API endpoints return valid data
4. No crashes, errors handled gracefully
5. Owner can test independently per guide
6. Evidence provided for every feature
7. No "READY" without Evidence

## Fail Criteria

Phase 4 FAILS if ANY true:
- Dashboard empty or "No products found"
- Data doesn't persist after reload
- Sync doesn't work or no progress
- API returns errors/empty
- Console has uncaught errors
- Owner can't test independently
- "READY" claimed without Evidence

