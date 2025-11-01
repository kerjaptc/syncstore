/**
 * Test data factories for consistent test data generation
 */

import { faker } from '@faker-js/faker';
import type {
  Product,
  ProductVariant,
  Store,
  Order,
  OrderItem,
  InventoryItem,
  Organization,
  User,
  SyncJob,
  PlatformProduct,
  PlatformOrder,
} from '@/lib/types';

// Organization factory
export const createMockOrganization = (overrides?: Partial<Organization>): Organization => ({
  id: faker.string.uuid(),
  name: faker.company.name(),
  slug: faker.internet.domainWord(),
  settings: {
    timezone: 'UTC',
    currency: 'USD',
    language: 'en',
  },
  subscriptionPlan: 'pro',
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  ...overrides,
});

// User factory
export const createMockUser = (overrides?: Partial<User>): User => ({
  id: faker.string.uuid(),
  organizationId: faker.string.uuid(),
  email: faker.internet.email(),
  fullName: faker.person.fullName(),
  role: 'member',
  isActive: true,
  lastActiveAt: faker.date.recent(),
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  ...overrides,
});

// Store factory
export const createMockStore = (overrides?: Partial<Store>): Store => ({
  id: faker.string.uuid(),
  organizationId: faker.string.uuid(),
  platform: faker.helpers.arrayElement(['shopee', 'tiktokshop']),
  name: faker.company.name(),
  platformStoreId: faker.string.alphanumeric(10),
  credentials: {
    accessToken: faker.string.alphanumeric(32),
    refreshToken: faker.string.alphanumeric(32),
    expiresAt: faker.date.future(),
  },
  settings: {
    syncEnabled: true,
    syncInterval: 300,
    autoSync: true,
  },
  syncStatus: 'idle',
  lastSyncAt: faker.date.recent(),
  isActive: true,
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  ...overrides,
});

// Product factory
export const createMockProduct = (overrides?: Partial<Product>): Product => ({
  id: faker.string.uuid(),
  organizationId: faker.string.uuid(),
  sku: faker.string.alphanumeric(8).toUpperCase(),
  name: faker.commerce.productName(),
  description: faker.commerce.productDescription(),
  category: faker.commerce.department(),
  brand: faker.company.name(),
  costPrice: parseFloat(faker.commerce.price({ min: 10, max: 100 })),
  weight: faker.number.float({ min: 0.1, max: 5.0, fractionDigits: 2 }),
  dimensions: {
    length: faker.number.float({ min: 1, max: 50, fractionDigits: 1 }),
    width: faker.number.float({ min: 1, max: 50, fractionDigits: 1 }),
    height: faker.number.float({ min: 1, max: 50, fractionDigits: 1 }),
  },
  images: [faker.image.url(), faker.image.url()],
  attributes: {
    color: faker.color.human(),
    material: faker.commerce.productMaterial(),
  },
  variants: [],
  isActive: true,
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  ...overrides,
});

// Product variant factory
export const createMockProductVariant = (overrides?: Partial<ProductVariant>): ProductVariant => ({
  id: faker.string.uuid(),
  productId: faker.string.uuid(),
  variantSku: faker.string.alphanumeric(10).toUpperCase(),
  name: faker.commerce.productName(),
  attributes: {
    size: faker.helpers.arrayElement(['S', 'M', 'L', 'XL']),
    color: faker.color.human(),
  },
  costPrice: parseFloat(faker.commerce.price({ min: 10, max: 100 })),
  weight: faker.number.float({ min: 0.1, max: 5.0, fractionDigits: 2 }),
  images: [faker.image.url()],
  isActive: true,
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  ...overrides,
});

// Inventory item factory
export const createMockInventoryItem = (overrides?: Partial<InventoryItem>): InventoryItem => ({
  id: faker.string.uuid(),
  productVariantId: faker.string.uuid(),
  locationId: faker.string.uuid(),
  quantityOnHand: faker.number.int({ min: 0, max: 1000 }),
  quantityReserved: faker.number.int({ min: 0, max: 50 }),
  quantityAvailable: 0, // Will be calculated
  reorderPoint: faker.number.int({ min: 5, max: 50 }),
  reorderQuantity: faker.number.int({ min: 10, max: 100 }),
  updatedAt: faker.date.recent(),
  ...overrides,
});

// Order factory
export const createMockOrder = (overrides?: Partial<Order>): Order => ({
  id: faker.string.uuid(),
  organizationId: faker.string.uuid(),
  storeId: faker.string.uuid(),
  platformOrderId: faker.string.alphanumeric(12),
  orderNumber: faker.string.alphanumeric(8).toUpperCase(),
  customer: {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    phone: faker.phone.number(),
    address: {
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      postalCode: faker.location.zipCode(),
      country: faker.location.country(),
    },
  },
  status: 'pending',
  financialStatus: 'pending',
  fulfillmentStatus: 'unfulfilled',
  items: [],
  totals: {
    subtotal: 0,
    tax: 0,
    shipping: 0,
    discount: 0,
    total: 0,
  },
  orderedAt: faker.date.recent(),
  createdAt: faker.date.recent(),
  updatedAt: faker.date.recent(),
  ...overrides,
});

// Order item factory
export const createMockOrderItem = (overrides?: Partial<OrderItem>): OrderItem => ({
  id: faker.string.uuid(),
  orderId: faker.string.uuid(),
  productVariantId: faker.string.uuid(),
  sku: faker.string.alphanumeric(8).toUpperCase(),
  name: faker.commerce.productName(),
  quantity: faker.number.int({ min: 1, max: 5 }),
  unitPrice: parseFloat(faker.commerce.price({ min: 10, max: 100 })),
  totalPrice: 0, // Will be calculated
  ...overrides,
});

// Sync job factory
export const createMockSyncJob = (overrides?: Partial<SyncJob>): SyncJob => ({
  id: faker.string.uuid(),
  organizationId: faker.string.uuid(),
  storeId: faker.string.uuid(),
  jobType: faker.helpers.arrayElement(['product_sync', 'inventory_sync', 'order_sync']),
  status: 'pending',
  progress: {
    total: 100,
    completed: 0,
    failed: 0,
    percentage: 0,
  },
  error: undefined,
  retryCount: 0,
  metadata: {},
  createdAt: faker.date.recent(),
  updatedAt: faker.date.recent(),
  ...overrides,
});

// Platform product factory
export const createMockPlatformProduct = (overrides?: Partial<PlatformProduct>): PlatformProduct => ({
  platformProductId: faker.string.alphanumeric(12),
  name: faker.commerce.productName(),
  description: faker.commerce.productDescription(),
  sku: faker.string.alphanumeric(8).toUpperCase(),
  price: parseFloat(faker.commerce.price({ min: 10, max: 100 })),
  stock: faker.number.int({ min: 0, max: 1000 }),
  images: [faker.image.url(), faker.image.url()],
  category: faker.commerce.department(),
  attributes: {
    brand: faker.company.name(),
    color: faker.color.human(),
  },
  isActive: true,
  ...overrides,
});

// Platform order factory
export const createMockPlatformOrder = (overrides?: Partial<PlatformOrder>): PlatformOrder => ({
  platformOrderId: faker.string.alphanumeric(12),
  orderNumber: faker.string.alphanumeric(8).toUpperCase(),
  status: 'pending',
  customer: {
    name: faker.person.fullName(),
    email: faker.internet.email(),
    phone: faker.phone.number(),
  },
  items: [
    {
      platformProductId: faker.string.alphanumeric(12),
      sku: faker.string.alphanumeric(8).toUpperCase(),
      name: faker.commerce.productName(),
      quantity: faker.number.int({ min: 1, max: 3 }),
      unitPrice: parseFloat(faker.commerce.price({ min: 10, max: 100 })),
    },
  ],
  totals: {
    subtotal: 50,
    tax: 5,
    shipping: 10,
    total: 65,
  },
  orderedAt: faker.date.recent(),
  ...overrides,
});

// Utility function to create multiple items
export const createMockArray = <T>(factory: () => T, count: number = 3): T[] => {
  return Array.from({ length: count }, factory);
};

// Calculate derived fields
export const calculateInventoryAvailable = (item: InventoryItem): InventoryItem => ({
  ...item,
  quantityAvailable: Math.max(0, item.quantityOnHand - item.quantityReserved),
});

export const calculateOrderItemTotal = (item: OrderItem): OrderItem => ({
  ...item,
  totalPrice: item.quantity * item.unitPrice,
});

export const calculateOrderTotals = (order: Order): Order => {
  const subtotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const tax = subtotal * 0.1; // 10% tax
  const shipping = subtotal > 100 ? 0 : 10; // Free shipping over $100
  const total = subtotal + tax + shipping - (order.totals.discount || 0);

  return {
    ...order,
    totals: {
      ...order.totals,
      subtotal,
      tax,
      shipping,
      total,
    },
  };
};