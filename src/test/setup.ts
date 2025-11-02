import '@testing-library/jest-dom';
import { beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Enhanced test environment configuration
beforeAll(async () => {
  // Mock environment variables for testing
  (process.env as any).NODE_ENV = 'test';
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_mock_key_for_testing';
  process.env.CLERK_SECRET_KEY = 'sk_test_mock_secret_key_for_testing';
  process.env.CLERK_WEBHOOK_SECRET = 'whsec_test_webhook_secret';
  process.env.DATABASE_URL = 'postgresql://test_user:test_pass@localhost:5432/syncstore_test';
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters-long';
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  process.env.SHOPEE_APP_ID = 'test_shopee_app_id';
  process.env.SHOPEE_APP_SECRET = 'test_shopee_app_secret';
  process.env.TIKTOKSHOP_APP_KEY = 'test_tiktok_app_key';
  process.env.TIKTOKSHOP_APP_SECRET = 'test_tiktok_app_secret';
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock_stripe_key';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_stripe_webhook';
  process.env.SENTRY_DSN = 'https://test@sentry.io/test';
  process.env.SENTRY_AUTH_TOKEN = 'test_sentry_token';
  
  // Set test-specific configurations
  process.env.DISABLE_MONITORING = 'true';
  process.env.DISABLE_ANALYTICS = 'true';
  process.env.DISABLE_EXTERNAL_APIS = 'true';
  process.env.TEST_MODE = 'true';
});

// Setup before each test
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  
  // Reset timers
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
});

// Cleanup after each test
afterEach(() => {
  // Cleanup React Testing Library
  cleanup();
  
  // Restore real timers
  vi.useRealTimers();
  
  // Clear all mocks
  vi.clearAllMocks();
  
  // Reset modules
  vi.resetModules();
});

// Cleanup after all tests
afterAll(() => {
  vi.restoreAllMocks();
});

// Global test utilities and polyfills
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock Next.js router
vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    pathname: '/',
    route: '/',
    query: {},
    asPath: '/',
    basePath: '',
    locale: 'en',
    locales: ['en'],
    defaultLocale: 'en',
    isReady: true,
    isPreview: false,
    isFallback: false,
    events: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
  }),
}));

// Mock Next.js navigation (App Router)
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// Mock Next.js headers
vi.mock('next/headers', () => ({
  headers: () => new Map(),
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    has: vi.fn(),
    getAll: vi.fn(),
  }),
}));

// Mock Clerk authentication
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    userId: 'test-user-id',
    sessionId: 'test-session-id',
    orgId: 'test-org-id',
    orgRole: 'admin',
    orgSlug: 'test-org',
    signOut: vi.fn(),
    getToken: vi.fn().mockResolvedValue('test-token'),
  }),
  useUser: () => ({
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: 'test-user-id',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
      firstName: 'Test',
      lastName: 'User',
      fullName: 'Test User',
      imageUrl: 'https://example.com/avatar.jpg',
    },
  }),
  useOrganization: () => ({
    isLoaded: true,
    organization: {
      id: 'test-org-id',
      name: 'Test Organization',
      slug: 'test-org',
      imageUrl: 'https://example.com/org.jpg',
    },
  }),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
  SignOutButton: ({ children }: { children: React.ReactNode }) => children,
  UserButton: () => null,
  OrganizationSwitcher: () => null,
}));

// Mock tRPC
vi.mock('@/lib/trpc/client', () => ({
  api: {
    useUtils: () => ({
      invalidate: vi.fn(),
      refetch: vi.fn(),
    }),
  },
}));

// Mock database connection
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: vi.fn(),
    transaction: vi.fn(),
  },
}));

// Mock Redis connection
vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
    flushall: vi.fn(),
  },
}));

// Mock external API clients
vi.mock('@/lib/platforms/shopee/client', () => ({
  ShopeeClient: vi.fn().mockImplementation(() => ({
    getProducts: vi.fn(),
    getOrders: vi.fn(),
    updateInventory: vi.fn(),
    authenticate: vi.fn(),
  })),
}));

vi.mock('@/lib/platforms/tiktokshop/client', () => ({
  TikTokShopClient: vi.fn().mockImplementation(() => ({
    getProducts: vi.fn(),
    getOrders: vi.fn(),
    updateInventory: vi.fn(),
    authenticate: vi.fn(),
  })),
}));

// Mock Stripe
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    customers: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
    },
    subscriptions: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  })),
}));

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  setContext: vi.fn(),
}));

// Mock file system operations for testing
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  rmdir: vi.fn(),
  unlink: vi.fn(),
  stat: vi.fn(),
  access: vi.fn(),
}));

// Mock crypto for testing
vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
    randomBytes: vi.fn((size: number) => Buffer.alloc(size, 'test')),
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => 'test-hash'),
    })),
    createHmac: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => 'test-hmac'),
    })),
  };
});

// Console suppression for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = (...args: any[]) => {
    // Suppress known test warnings
    const message = args[0]?.toString() || '';
    if (
      message.includes('Warning: ReactDOM.render is deprecated') ||
      message.includes('Warning: validateDOMNesting') ||
      message.includes('act(...) is not supported in production')
    ) {
      return;
    }
    originalConsoleError(...args);
  };

  console.warn = (...args: any[]) => {
    // Suppress known test warnings
    const message = args[0]?.toString() || '';
    if (
      message.includes('componentWillReceiveProps has been renamed') ||
      message.includes('componentWillMount has been renamed')
    ) {
      return;
    }
    originalConsoleWarn(...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});