/**
 * Mock Data for SyncStore MVP Components
 * 
 * This file provides realistic mock data for testing and demonstration
 * of SyncStore MVP components in development environment.
 */

import type { 
  SyncProgress, 
  OperationStatus, 
  StoreConnection,
  Product 
} from './types';

// Mock Store Connections
export const mockStoreConnections: StoreConnection[] = [
  {
    id: 'store-1',
    organizationId: 'org-1',
    platform: 'shopee',
    storeId: 'shopee-store-123',
    storeName: 'Toko Elektronik Jakarta',
    credentials: {
      accessToken: 'mock-access-token-1',
      refreshToken: 'mock-refresh-token-1',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    },
    status: 'active',
    lastSyncAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    updatedAt: new Date(Date.now() - 30 * 60 * 1000),
  },
  {
    id: 'store-2',
    organizationId: 'org-1',
    platform: 'shopee',
    storeId: 'shopee-store-456',
    storeName: 'Fashion Store Bandung',
    credentials: {
      accessToken: 'mock-access-token-2',
      refreshToken: 'mock-refresh-token-2',
      expiresAt: new Date(Date.now() - 60 * 60 * 1000), // Expired 1 hour ago
    },
    status: 'expired',
    lastSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  }
];

// Mock Products
export const mockProducts: Product[] = [
  {
    id: 'prod-1',
    storeId: 'store-1',
    platformProductId: 'shopee-prod-123',
    name: 'Smartphone Samsung Galaxy A54 5G 8/128GB',
    description: 'Smartphone terbaru dengan kamera 50MP dan layar Super AMOLED 6.4 inch',
    sku: 'SAMSUNG-A54-8-128',
    price: 4999000,
    stock: 25,
    images: [
      'https://example.com/samsung-a54-1.jpg',
      'https://example.com/samsung-a54-2.jpg'
    ],
    status: 'active',
    lastSyncAt: new Date(Date.now() - 15 * 60 * 1000),
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 15 * 60 * 1000),
  },
  {
    id: 'prod-2',
    storeId: 'store-1',
    platformProductId: 'shopee-prod-456',
    name: 'Laptop ASUS VivoBook 14 Intel Core i5',
    description: 'Laptop ringan untuk produktivitas dengan prosesor Intel Core i5 generasi terbaru',
    sku: 'ASUS-VIVOBOOK-14-I5',
    price: 8999000,
    stock: 12,
    images: [
      'https://example.com/asus-vivobook-1.jpg'
    ],
    status: 'active',
    lastSyncAt: new Date(Date.now() - 45 * 60 * 1000),
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 45 * 60 * 1000),
  }
];

// Mock Sync Progress
export const mockSyncProgress: SyncProgress = {
  stage: 'processing',
  progress: 65,
  totalItems: 150,
  processedItems: 98,
  currentItem: 'Smartphone Samsung Galaxy A54 5G',
  message: 'Memproses produk dari Shopee...',
  startTime: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
  estimatedTimeRemaining: 120, // 2 minutes
  errors: [
    'Produk "Laptop Gaming MSI" tidak memiliki gambar utama',
    'SKU duplikat ditemukan untuk "Mouse Wireless Logitech"',
    'Harga produk "Keyboard Mechanical" melebihi batas maksimum'
  ]
};

// Mock Operations
export const mockOperations: OperationStatus[] = [
  {
    id: 'op-1',
    type: 'sync',
    status: 'running',
    progress: 75,
    message: 'Sinkronisasi produk Toko Elektronik Jakarta',
    startTime: new Date(Date.now() - 3 * 60 * 1000),
  },
  {
    id: 'op-2',
    type: 'fetch',
    status: 'completed',
    progress: 100,
    message: 'Mengambil data pesanan dari Shopee',
    startTime: new Date(Date.now() - 10 * 60 * 1000),
    endTime: new Date(Date.now() - 8 * 60 * 1000),
  },
  {
    id: 'op-3',
    type: 'connect',
    status: 'failed',
    progress: 0,
    message: 'Menghubungkan ke Fashion Store Bandung',
    startTime: new Date(Date.now() - 15 * 60 * 1000),
    endTime: new Date(Date.now() - 14 * 60 * 1000),
    error: 'Token expired - perlu reauthorization'
  },
  {
    id: 'op-4',
    type: 'validate',
    status: 'completed',
    progress: 100,
    message: 'Validasi data produk selesai',
    startTime: new Date(Date.now() - 25 * 60 * 1000),
    endTime: new Date(Date.now() - 20 * 60 * 1000),
  },
  {
    id: 'op-5',
    type: 'save',
    status: 'running',
    progress: 45,
    message: 'Menyimpan perubahan harga produk',
    startTime: new Date(Date.now() - 2 * 60 * 1000),
  }
];

// Mock Sync Progress Stages
export const mockSyncProgressStages: SyncProgress[] = [
  {
    stage: 'connecting',
    progress: 10,
    message: 'Menghubungkan ke Shopee API...',
    startTime: new Date(Date.now() - 8 * 60 * 1000),
  },
  {
    stage: 'fetching',
    progress: 35,
    totalItems: 200,
    processedItems: 70,
    message: 'Mengambil data produk dari Shopee...',
    startTime: new Date(Date.now() - 6 * 60 * 1000),
    estimatedTimeRemaining: 180,
  },
  {
    stage: 'processing',
    progress: 65,
    totalItems: 200,
    processedItems: 130,
    currentItem: 'Headphone Sony WH-1000XM4',
    message: 'Memproses dan memvalidasi data produk...',
    startTime: new Date(Date.now() - 4 * 60 * 1000),
    estimatedTimeRemaining: 90,
    errors: [
      'Produk "Speaker Bluetooth JBL" tidak memiliki deskripsi',
      'Gambar produk "Earbuds Apple AirPods" tidak dapat diakses'
    ]
  },
  {
    stage: 'saving',
    progress: 85,
    totalItems: 200,
    processedItems: 170,
    message: 'Menyimpan data ke database...',
    startTime: new Date(Date.now() - 2 * 60 * 1000),
    estimatedTimeRemaining: 30,
  },
  {
    stage: 'completed',
    progress: 100,
    totalItems: 200,
    processedItems: 200,
    message: 'Sinkronisasi selesai! 200 produk berhasil diproses.',
    startTime: new Date(Date.now() - 10 * 60 * 1000),
  }
];

// Helper functions for generating dynamic mock data
export function generateMockSyncProgress(stage?: SyncProgress['stage']): SyncProgress {
  const stages = mockSyncProgressStages;
  const selectedStage = stage ? stages.find(s => s.stage === stage) : stages[Math.floor(Math.random() * stages.length)];
  
  return {
    ...selectedStage!,
    startTime: new Date(Date.now() - Math.random() * 10 * 60 * 1000), // Random start time within last 10 minutes
  };
}

export function generateMockOperation(type?: OperationStatus['type']): OperationStatus {
  const types: OperationStatus['type'][] = ['sync', 'fetch', 'save', 'delete', 'connect', 'validate'];
  const statuses: OperationStatus['status'][] = ['pending', 'running', 'completed', 'failed'];
  
  const selectedType = type || types[Math.floor(Math.random() * types.length)];
  const selectedStatus = statuses[Math.floor(Math.random() * statuses.length)];
  
  const baseOperation: OperationStatus = {
    id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: selectedType,
    status: selectedStatus,
    progress: selectedStatus === 'completed' ? 100 : Math.floor(Math.random() * 90),
    message: `${selectedType} operation - ${selectedStatus}`,
    startTime: new Date(Date.now() - Math.random() * 30 * 60 * 1000),
  };

  if (selectedStatus === 'completed' || selectedStatus === 'failed') {
    baseOperation.endTime = new Date(baseOperation.startTime.getTime() + Math.random() * 5 * 60 * 1000);
  }

  if (selectedStatus === 'failed') {
    baseOperation.error = 'Mock error message for testing';
  }

  return baseOperation;
}

// Export all mock data as default
export default {
  storeConnections: mockStoreConnections,
  products: mockProducts,
  syncProgress: mockSyncProgress,
  operations: mockOperations,
  syncProgressStages: mockSyncProgressStages,
  generateMockSyncProgress,
  generateMockOperation,
};