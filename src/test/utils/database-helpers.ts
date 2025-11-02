/**
 * Database testing utilities for isolated test database setup and teardown
 */

import { vi } from 'vitest';

// Test database configuration
export interface TestDatabaseConfig {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
}

// Default test database configuration
const DEFAULT_TEST_CONFIG: TestDatabaseConfig = {
  host: 'localhost',
  port: 5432,
  database: 'syncstore_test',
  username: 'test_user',
  password: 'test_pass',
  ssl: false,
};

// Test database connection pool
let testDbConnection: any = null;
let testDb: any = null;

/**
 * Create a test database connection
 */
export const createTestDatabase = async (config: TestDatabaseConfig = {}) => {
  const dbConfig = { ...DEFAULT_TEST_CONFIG, ...config };
  
  try {
    // For now, always return mock database in test environment
    return createMockDatabase();
  } catch (error) {
    console.warn('Failed to create test database connection:', error);
    return createMockDatabase();
  }
};

/**
 * Create a mock database for testing when real database is not available
 */
export const createMockDatabase = () => {
  const mockDb = {
    // Query methods
    select: vi.fn().mockReturnThis(),
    selectDistinct: vi.fn().mockReturnThis(),
    selectDistinctOn: vi.fn().mockReturnThis(),
    
    // From methods
    from: vi.fn().mockReturnThis(),
    
    // Where methods
    where: vi.fn().mockReturnThis(),
    
    // Join methods
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    rightJoin: vi.fn().mockReturnThis(),
    fullJoin: vi.fn().mockReturnThis(),
    
    // Group and order methods
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    
    // Limit and offset
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    
    // Insert methods
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    
    // Update methods
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    
    // Delete methods
    delete: vi.fn().mockReturnThis(),
    
    // Execution methods
    execute: vi.fn().mockResolvedValue([]),
    all: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({ changes: 0, lastInsertRowid: 0 }),
    
    // Returning methods
    returning: vi.fn().mockReturnThis(),
    
    // Transaction methods
    transaction: vi.fn().mockImplementation(async (callback) => {
      return await callback(mockDb);
    }),
    
    // Raw query methods
    query: vi.fn().mockResolvedValue({ rows: [] }),
    
    // Schema access (mocked)
    schema: {},
    
    // Batch operations
    batch: vi.fn().mockResolvedValue([]),
  };
  
  return mockDb;
};

/**
 * Setup test database with migrations
 */
export const setupTestDatabase = async (config?: TestDatabaseConfig) => {
  const db = await createTestDatabase(config);
  console.log('Test database setup completed (using mocks)');
  return db;
};

/**
 * Clean up test database
 */
export const cleanupTestDatabase = async () => {
  // Mock cleanup for now
  console.log('Test database cleaned up (using mocks)');
};

/**
 * Close test database connection
 */
export const closeTestDatabase = async () => {
  testDbConnection = null;
  testDb = null;
  console.log('Test database connection closed (using mocks)');
};

/**
 * Seed test database with sample data
 */
export const seedTestDatabase = async (db: any) => {
  // Mock seeding for now
  const mockData = {
    organization: { id: 'test-org-id', name: 'Test Organization' },
    user: { id: 'test-user-id', email: 'test@example.com' },
    store: { id: 'test-store-id', name: 'Test Store' },
    product: { id: 'test-product-id', name: 'Test Product' },
    variant: { id: 'test-variant-id', name: 'Test Variant' },
  };
  
  console.log('Test database seeded with sample data (using mocks)');
  return mockData;
};

/**
 * Create test transaction
 */
export const createTestTransaction = async (db: any, callback: (tx: any) => Promise<any>) => {
  return await db.transaction(callback);
};

/**
 * Utility to check if test database is available
 */
export const isTestDatabaseAvailable = async (config?: TestDatabaseConfig): Promise<boolean> => {
  try {
    const db = await createTestDatabase(config);
    if (testDbConnection) {
      await testDbConnection`SELECT 1`;
      await closeTestDatabase();
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

/**
 * Database test utilities for specific operations
 */
export const dbTestUtils = {
  /**
   * Insert test data and return cleanup function
   */
  insertTestData: async (db: any, table: string, data: any[]) => {
    // Mock insert for now
    console.log(`Inserting ${data.length} records into ${table} (mocked)`);
    
    // Return cleanup function
    return async () => {
      console.log(`Cleaning up test data from ${table} (mocked)`);
    };
  },
  
  /**
   * Count records in table
   */
  countRecords: async (db: any, table: string) => {
    // Mock count for now
    return 0;
  },
  
  /**
   * Verify data integrity
   */
  verifyDataIntegrity: async (db: any) => {
    // Mock integrity check for now
    console.log('Data integrity check passed (mocked)');
    return true;
  },
};

// Export the current test database instance
export const getTestDatabase = () => testDb;
export const getTestConnection = () => testDbConnection;