/**
 * SyncStore MVP Database Connection
 * 
 * This file provides database connection utilities with connection pooling,
 * health checks, and proper error handling for the MVP.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  mvpStoreConnections,
  mvpProducts,
  mvpSyncStatus,
  mvpSyncLogs,
  mvpEncryptedCredentials,
  type MvpDatabaseConfig,
  validateDatabaseConfig,
} from './schema';
import {
  DatabaseError,
  createErrorContext,
  CircuitBreaker,
} from '../index';

// ============================================================================
// Database Connection Manager
// ============================================================================

export class MvpDatabaseConnection {
  private sql: postgres.Sql;
  private db: ReturnType<typeof drizzle>;
  private config: MvpDatabaseConfig;
  private circuitBreaker: CircuitBreaker;
  private connectionPool: postgres.Sql;
  private isConnected = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: MvpDatabaseConfig) {
    // Validate configuration
    const configErrors = validateDatabaseConfig(config);
    if (configErrors.length > 0) {
      throw new DatabaseError(
        `Invalid database configuration: ${configErrors.join(', ')}`,
        'configuration',
        undefined,
        createErrorContext('MvpDatabaseConnection', { config })
      );
    }

    this.config = config;
    this.circuitBreaker = new CircuitBreaker(5, 30000, 2); // 5 failures, 30s recovery, 2 successes

    // Create connection pool
    this.connectionPool = postgres(this.config.connectionString, {
      max: this.config.maxConnections,
      idle_timeout: this.config.idleTimeout / 1000,
      connect_timeout: this.config.connectionTimeout / 1000,
      ssl: this.config.ssl ? 'require' : false,
      onnotice: () => {}, // Suppress notices
      debug: process.env.NODE_ENV === 'development',
    });

    this.sql = this.connectionPool;
    this.db = drizzle(this.sql, {
      schema: {
        mvpStoreConnections,
        mvpProducts,
        mvpSyncStatus,
        mvpSyncLogs,
        mvpEncryptedCredentials,
      },
    });
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Initializes the database connection
   */
  async connect(): Promise<void> {
    try {
      await this.circuitBreaker.execute(async () => {
        // Test connection
        await this.sql`SELECT 1 as test`;
        this.isConnected = true;
        
        // Start health check interval
        this.startHealthCheck();
        
        console.log('✅ Database connection established');
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new DatabaseError(
        `Failed to connect to database: ${errorMessage}`,
        'connection',
        undefined,
        createErrorContext('connect', { config: this.config })
      );
    }
  }

  /**
   * Closes the database connection
   */
  async disconnect(): Promise<void> {
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = undefined;
      }

      await this.sql.end();
      this.isConnected = false;
      
      console.log('✅ Database connection closed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Warning: Error closing database connection: ${errorMessage}`);
    }
  }

  /**
   * Gets the Drizzle database instance
   */
  getDb() {
    if (!this.isConnected) {
      throw new DatabaseError(
        'Database not connected. Call connect() first.',
        'connection',
        undefined,
        createErrorContext('getDb')
      );
    }
    return this.db;
  }

  /**
   * Gets the raw SQL instance
   */
  getSql() {
    if (!this.isConnected) {
      throw new DatabaseError(
        'Database not connected. Call connect() first.',
        'connection',
        undefined,
        createErrorContext('getSql')
      );
    }
    return this.sql;
  }

  /**
   * Checks if the connection is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.circuitBreaker.execute(async () => {
        await this.sql`SELECT 1 as health_check`;
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets connection status and metrics
   */
  getConnectionStatus(): {
    isConnected: boolean;
    circuitBreakerStatus: any;
    config: {
      maxConnections: number;
      connectionTimeout: number;
      idleTimeout: number;
      ssl: boolean;
    };
  } {
    return {
      isConnected: this.isConnected,
      circuitBreakerStatus: this.circuitBreaker.status,
      config: {
        maxConnections: this.config.maxConnections,
        connectionTimeout: this.config.connectionTimeout,
        idleTimeout: this.config.idleTimeout,
        ssl: this.config.ssl,
      },
    };
  }

  // ============================================================================
  // Transaction Support
  // ============================================================================

  /**
   * Executes a function within a database transaction
   */
  async transaction<T>(
    callback: (tx: ReturnType<typeof drizzle>) => Promise<T>
  ): Promise<T> {
    if (!this.isConnected) {
      throw new DatabaseError(
        'Database not connected',
        'transaction',
        undefined,
        createErrorContext('transaction')
      );
    }

    try {
      return await this.circuitBreaker.execute(async () => {
        return await this.db.transaction(callback);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new DatabaseError(
        `Transaction failed: ${errorMessage}`,
        'transaction',
        undefined,
        createErrorContext('transaction', { error: errorMessage })
      );
    }
  }

  /**
   * Executes raw SQL within a transaction
   */
  async rawTransaction<T>(
    callback: (sql: postgres.Sql) => Promise<T>
  ): Promise<T> {
    if (!this.isConnected) {
      throw new DatabaseError(
        'Database not connected',
        'raw_transaction',
        undefined,
        createErrorContext('rawTransaction')
      );
    }

    try {
      return await this.circuitBreaker.execute(async () => {
        return await this.sql.begin(callback);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new DatabaseError(
        `Raw transaction failed: ${errorMessage}`,
        'raw_transaction',
        undefined,
        createErrorContext('rawTransaction', { error: errorMessage })
      );
    }
  }

  // ============================================================================
  // Health Check and Monitoring
  // ============================================================================

  /**
   * Starts periodic health checks
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const isHealthy = await this.isHealthy();
        if (!isHealthy) {
          console.warn('⚠️  Database health check failed');
          this.isConnected = false;
        }
      } catch (error) {
        console.warn('⚠️  Database health check error:', error);
        this.isConnected = false;
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Performs a comprehensive health check
   */
  async performHealthCheck(): Promise<{
    isHealthy: boolean;
    latency: number;
    connectionCount: number;
    errors: string[];
  }> {
    const result = {
      isHealthy: true,
      latency: 0,
      connectionCount: 0,
      errors: [] as string[],
    };

    try {
      // Test basic connectivity and measure latency
      const startTime = Date.now();
      await this.sql`SELECT 1 as health_check`;
      result.latency = Date.now() - startTime;

      // Get connection count
      const connectionResult = await this.sql`
        SELECT count(*) as connection_count 
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;
      result.connectionCount = parseInt(connectionResult[0]?.connection_count || '0', 10);

      // Test table access
      await this.sql`SELECT COUNT(*) FROM mvp_store_connections LIMIT 1`;

    } catch (error) {
      result.isHealthy = false;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
    }

    return result;
  }

  /**
   * Gets database statistics
   */
  async getDatabaseStats(): Promise<{
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    tableStats: Record<string, { rowCount: number; size: string }>;
  }> {
    try {
      // Get connection stats
      const connectionStats = await this.sql`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;

      // Get table stats
      const tableStats = await this.sql`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins + n_tup_upd + n_tup_del as total_operations,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_stat_user_tables 
        WHERE tablename LIKE 'mvp_%'
        ORDER BY tablename
      `;

      const stats = connectionStats[0] || {};
      const tables: Record<string, { rowCount: number; size: string }> = {};

      for (const table of tableStats) {
        tables[table.tablename] = {
          rowCount: parseInt(table.total_operations || '0', 10),
          size: table.size || '0 bytes',
        };
      }

      return {
        totalConnections: parseInt(stats.total_connections || '0', 10),
        activeConnections: parseInt(stats.active_connections || '0', 10),
        idleConnections: parseInt(stats.idle_connections || '0', 10),
        tableStats: tables,
      };

    } catch (error) {
      throw new DatabaseError(
        `Failed to get database stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'stats',
        undefined,
        createErrorContext('getDatabaseStats')
      );
    }
  }
}

// ============================================================================
// Singleton Connection Manager
// ============================================================================

let globalConnection: MvpDatabaseConnection | null = null;

/**
 * Gets or creates the global database connection
 */
export function getMvpDatabaseConnection(config?: MvpDatabaseConfig): MvpDatabaseConnection {
  if (!globalConnection) {
    const dbConfig: MvpDatabaseConfig = config || {
      connectionString: process.env.DATABASE_URL || '',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000', 10),
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '600000', 10),
      ssl: process.env.NODE_ENV === 'production',
    };

    globalConnection = new MvpDatabaseConnection(dbConfig);
  }

  return globalConnection;
}

/**
 * Initializes the global database connection
 */
export async function initializeMvpDatabase(config?: MvpDatabaseConfig): Promise<MvpDatabaseConnection> {
  const connection = getMvpDatabaseConnection(config);
  await connection.connect();
  return connection;
}

/**
 * Closes the global database connection
 */
export async function closeMvpDatabase(): Promise<void> {
  if (globalConnection) {
    await globalConnection.disconnect();
    globalConnection = null;
  }
}

/**
 * Gets the Drizzle database instance from global connection
 */
export function getMvpDb() {
  const connection = getMvpDatabaseConnection();
  return connection.getDb();
}

/**
 * Gets the raw SQL instance from global connection
 */
export function getMvpSql() {
  const connection = getMvpDatabaseConnection();
  return connection.getSql();
}

/**
 * Executes a function within a database transaction using global connection
 */
export async function mvpTransaction<T>(
  callback: (tx: ReturnType<typeof drizzle>) => Promise<T>
): Promise<T> {
  const connection = getMvpDatabaseConnection();
  return await connection.transaction(callback);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Tests database connectivity
 */
export async function testMvpDatabaseConnection(config?: MvpDatabaseConfig): Promise<{
  success: boolean;
  latency: number;
  error?: string;
}> {
  let testConnection: MvpDatabaseConnection | null = null;
  
  try {
    testConnection = new MvpDatabaseConnection(config || {
      connectionString: process.env.DATABASE_URL || '',
      maxConnections: 1,
      connectionTimeout: 10000,
      idleTimeout: 60000,
      ssl: process.env.NODE_ENV === 'production',
    });

    const startTime = Date.now();
    await testConnection.connect();
    const latency = Date.now() - startTime;

    return {
      success: true,
      latency,
    };

  } catch (error) {
    return {
      success: false,
      latency: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    if (testConnection) {
      await testConnection.disconnect();
    }
  }
}

/**
 * Validates database schema
 */
export async function validateMvpDatabaseSchema(): Promise<{
  isValid: boolean;
  missingTables: string[];
  errors: string[];
}> {
  const result = {
    isValid: true,
    missingTables: [] as string[],
    errors: [] as string[],
  };

  try {
    const connection = getMvpDatabaseConnection();
    const sql = connection.getSql();

    const requiredTables = [
      'mvp_store_connections',
      'mvp_products',
      'mvp_sync_status',
      'mvp_sync_logs',
      'mvp_encrypted_credentials',
    ];

    const existingTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ANY(${requiredTables})
    `;

    const existingTableNames = existingTables.map(row => row.table_name as string);

    for (const table of requiredTables) {
      if (!existingTableNames.includes(table)) {
        result.missingTables.push(table);
        result.isValid = false;
      }
    }

  } catch (error) {
    result.isValid = false;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return result;
}