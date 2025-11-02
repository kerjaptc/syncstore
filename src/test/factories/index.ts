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

// Test fixture builders for complex scenarios
export const createCompleteProductWithVariants = (overrides?: Partial<Product>) => {
  const product = createMockProduct(overrides);
  const variants = createMockArray(() => createMockProductVariant({ productId: product.id }), 3);
  
  return {
    ...product,
    variants,
  };
};

export const createCompleteOrderWithItems = (overrides?: Partial<Order>) => {
  const order = createMockOrder(overrides);
  const items = createMockArray(() => createMockOrderItem({ orderId: order.id }), 2);
  const orderWithItems = { ...order, items };
  
  return calculateOrderTotals(orderWithItems);
};

export const createStoreWithProducts = (overrides?: { store?: Partial<Store>; productCount?: number }) => {
  const store = createMockStore(overrides?.store);
  const products = createMockArray(
    () => createMockProduct({ organizationId: store.organizationId }),
    overrides?.productCount || 5
  );
  
  return { store, products };
};

// Test data sets for different scenarios
export const testDataSets = {
  // Small dataset for unit tests
  small: {
    organizations: () => createMockArray(createMockOrganization, 1),
    users: () => createMockArray(createMockUser, 2),
    stores: () => createMockArray(createMockStore, 1),
    products: () => createMockArray(createMockProduct, 3),
    orders: () => createMockArray(createMockOrder, 2),
  },
  
  // Medium dataset for integration tests
  medium: {
    organizations: () => createMockArray(createMockOrganization, 2),
    users: () => createMockArray(createMockUser, 5),
    stores: () => createMockArray(createMockStore, 3),
    products: () => createMockArray(createMockProduct, 10),
    orders: () => createMockArray(createMockOrder, 8),
  },
  
  // Large dataset for performance tests
  large: {
    organizations: () => createMockArray(createMockOrganization, 5),
    users: () => createMockArray(createMockUser, 20),
    stores: () => createMockArray(createMockStore, 10),
    products: () => createMockArray(createMockProduct, 100),
    orders: () => createMockArray(createMockOrder, 50),
  },
};

// Scenario-specific factories
export const createSyncScenario = () => {
  const organization = createMockOrganization();
  const store = createMockStore({ organizationId: organization.id });
  const products = createMockArray(() => createMockProduct({ organizationId: organization.id }), 5);
  const syncJob = createMockSyncJob({ organizationId: organization.id, storeId: store.id });
  
  return { organization, store, products, syncJob };
};

export const createErrorScenario = () => {
  const organization = createMockOrganization();
  const store = createMockStore({ 
    organizationId: organization.id,
    syncStatus: 'error',
    credentials: {
      accessToken: 'expired-token',
      refreshToken: 'expired-refresh',
      expiresAt: faker.date.past(),
    },
  });
  const syncJob = createMockSyncJob({
    organizationId: organization.id,
    storeId: store.id,
    status: 'failed',
    error: {
      code: 'AUTH_ERROR',
      message: 'Authentication failed',
      details: 'Access token has expired',
    },
  });
  
  return { organization, store, syncJob };
};

export const createMultiPlatformScenario = () => {
  const organization = createMockOrganization();
  const shopeeStore = createMockStore({ 
    organizationId: organization.id,
    platform: 'shopee',
    name: 'Shopee Store',
  });
  const tiktokStore = createMockStore({
    organizationId: organization.id,
    platform: 'tiktokshop',
    name: 'TikTok Shop Store',
  });
  const products = createMockArray(() => createMockProduct({ organizationId: organization.id }), 10);
  
  return { organization, shopeeStore, tiktokStore, products };
};

// Platform-specific test data
export const platformTestData = {
  shopee: {
    createAuthResponse: () => ({
      access_token: faker.string.alphanumeric(32),
      refresh_token: faker.string.alphanumeric(32),
      expires_in: 3600,
      shop_id: faker.number.int({ min: 100000, max: 999999 }),
      partner_id: faker.number.int({ min: 1000, max: 9999 }),
    }),
    
    createProductResponse: () => ({
      item_id: faker.number.int({ min: 100000000, max: 999999999 }),
      item_name: faker.commerce.productName(),
      item_sku: faker.string.alphanumeric(8).toUpperCase(),
      price: parseFloat(faker.commerce.price({ min: 10, max: 100 })),
      stock: faker.number.int({ min: 0, max: 1000 }),
      status: 'NORMAL',
      images: [faker.image.url(), faker.image.url()],
    }),
    
    createOrderResponse: () => ({
      order_sn: faker.string.alphanumeric(12),
      order_status: 'READY_TO_SHIP',
      create_time: faker.date.recent().getTime(),
      update_time: faker.date.recent().getTime(),
      currency: 'USD',
      total_amount: parseFloat(faker.commerce.price({ min: 50, max: 500 })),
      buyer_username: faker.internet.username(),
      recipient_address: {
        name: faker.person.fullName(),
        phone: faker.phone.number(),
        full_address: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        zipcode: faker.location.zipCode(),
      },
    }),
  },
  
  tiktokshop: {
    createAuthResponse: () => ({
      access_token: faker.string.alphanumeric(32),
      refresh_token: faker.string.alphanumeric(32),
      expires_in: 3600,
      shop_id: faker.string.alphanumeric(10),
      shop_name: faker.company.name(),
    }),
    
    createProductResponse: () => ({
      product_id: faker.string.alphanumeric(12),
      product_name: faker.commerce.productName(),
      skus: [
        {
          id: faker.string.alphanumeric(10),
          seller_sku: faker.string.alphanumeric(8).toUpperCase(),
          price: {
            amount: faker.commerce.price({ min: 10, max: 100 }),
            currency: 'USD',
          },
          inventory: {
            quantity: faker.number.int({ min: 0, max: 1000 }),
          },
        },
      ],
      status: 'ACTIVE',
      images: [
        { uri: faker.image.url() },
        { uri: faker.image.url() },
      ],
    }),
    
    createOrderResponse: () => ({
      order_id: faker.string.alphanumeric(12),
      order_status: 'AWAITING_SHIPMENT',
      create_time: faker.date.recent().getTime(),
      update_time: faker.date.recent().getTime(),
      payment_info: {
        currency: 'USD',
        total_amount: faker.commerce.price({ min: 50, max: 500 }),
      },
      recipient_info: {
        name: faker.person.fullName(),
        phone: faker.phone.number(),
        address_detail: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        zipcode: faker.location.zipCode(),
      },
    }),
  },
};

// Reset faker seed for consistent test data
export const resetFakerSeed = (seed?: number) => {
  faker.seed(seed || 12345);
};

// Create deterministic test data
export const createDeterministicTestData = (seed = 12345) => {
  resetFakerSeed(seed);
  return testDataSets.medium;
};