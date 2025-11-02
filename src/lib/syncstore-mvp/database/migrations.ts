/**
 * SyncStore MVP Database Migrations
 * 
 * This file contains migration utilities for creating and managing
 * the MVP database schema with proper error handling and rollback support.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  createMvpTablesSQL,
  dropMvpTablesSQL,
  validateDatabaseConfig,
  type MvpDatabaseConfig,
} from './schema';
import {
  DatabaseError,
  createErrorContext,
  validateData,
} from '../index';
import { z } from 'zod';

// ============================================================================
// Migration Configuration
// ============================================================================

export interface MigrationConfig {
  databaseUrl: string;
  timeout: number;
  retryAttempts: number;
  dryRun: boolean;
}

export interface MigrationResult {
  success: boolean;
  tablesCreated: string[];
  indexesCreated: string[];
  errors: string[];
  duration: number;
  timestamp: Date;
}

const MigrationConfigSchema = z.object({
  databaseUrl: z.string().min(1, 'Database URL is required'),
  timeout: z.number().min(1000).max(300000), // 1s to 5min
  retryAttempts: z.number().min(0).max(5),
  dryRun: z.boolean(),
});

// ============================================================================
// Migration Service
// ============================================================================

export class MvpMigrationService {
  private config: MigrationConfig;
  private sql: postgres.Sql;

  constructor(config: MigrationConfig) {
    this.config = validateData(MigrationConfigSchema, config, 'MigrationConfig');
    this.sql = postgres(this.config.databaseUrl, {
      max: 1, // Single connection for migrations
      idle_timeout: 20,
      connect_timeout: this.config.timeout / 1000,
    });
  }

  // ============================================================================
  // Migration Operations
  // ============================================================================

  /**
   * Runs the complete MVP migration
   */
  async runMigration(): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: false,
      tablesCreated: [],
      indexesCreated: [],
      errors: [],
      duration: 0,
      timestamp: new Date(),
    };

    try {
      console.log('🚀 Starting SyncStore MVP database migration...');

      // Check database connection
      await this.checkDatabaseConnection();
      console.log('✅ Database connection verified');

      // Check if tables already exist
      const existingTables = await this.checkExistingTables();
      if (existingTables.length > 0) {
        console.log(`⚠️  Found existing MVP tables: ${existingTables.join(', ')}`);
        
        if (!this.config.dryRun) {
          const shouldContinue = await this.promptForConfirmation(
            'Some MVP tables already exist. Continue with migration?'
          );
          if (!shouldContinue) {
            result.errors.push('Migration cancelled by user');
            return result;
          }
        }
      }

      // Run migration
      if (this.config.dryRun) {
        console.log('🔍 Dry run mode - no changes will be made');
        result.success = true;
        result.tablesCreated = ['mvp_store_connections', 'mvp_products', 'mvp_sync_status', 'mvp_sync_logs', 'mvp_encrypted_credentials'];
        result.indexesCreated = ['Various performance indexes'];
      } else {
        await this.executeMigration(result);
      }

      result.duration = Date.now() - startTime;
      
      if (result.success) {
        console.log(`✅ Migration completed successfully in ${result.duration}ms`);
        console.log(`📊 Tables created: ${result.tablesCreated.length}`);
        console.log(`📈 Indexes created: ${result.indexesCreated.length}`);
      }

      return result;

    } catch (error) {
      result.duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
      
      console.error('❌ Migration failed:', errorMessage);
      throw new DatabaseError(
        `Migration failed: ${errorMessage}`,
        'migration',
        undefined,
        createErrorContext('runMigration', { config: this.config })
      );
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Rolls back the MVP migration
   */
  async rollbackMigration(): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: false,
      tablesCreated: [], // Will be empty for rollback
      indexesCreated: [], // Will be empty for rollback
      errors: [],
      duration: 0,
      timestamp: new Date(),
    };

    try {
      console.log('🔄 Starting SyncStore MVP database rollback...');

      // Check database connection
      await this.checkDatabaseConnection();
      console.log('✅ Database connection verified');

      // Check existing tables
      const existingTables = await this.checkExistingTables();
      if (existingTables.length === 0) {
        console.log('ℹ️  No MVP tables found to rollback');
        result.success = true;
        return result;
      }

      console.log(`🗑️  Found MVP tables to remove: ${existingTables.join(', ')}`);

      if (!this.config.dryRun) {
        const shouldContinue = await this.promptForConfirmation(
          'This will permanently delete all MVP tables and data. Continue?'
        );
        if (!shouldContinue) {
          result.errors.push('Rollback cancelled by user');
          return result;
        }
      }

      // Execute rollback
      if (this.config.dryRun) {
        console.log('🔍 Dry run mode - no changes will be made');
        result.success = true;
      } else {
        await this.executeRollback(result);
      }

      result.duration = Date.now() - startTime;
      
      if (result.success) {
        console.log(`✅ Rollback completed successfully in ${result.duration}ms`);
      }

      return result;

    } catch (error) {
      result.duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
      
      console.error('❌ Rollback failed:', errorMessage);
      throw new DatabaseError(
        `Rollback failed: ${errorMessage}`,
        'rollback',
        undefined,
        createErrorContext('rollbackMigration', { config: this.config })
      );
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Validates the migration state
   */
  async validateMigration(): Promise<{
    isValid: boolean;
    missingTables: string[];
    missingIndexes: string[];
    errors: string[];
  }> {
    const result = {
      isValid: true,
      missingTables: [] as string[],
      missingIndexes: [] as string[],
      errors: [] as string[],
    };

    try {
      // Check required tables
      const requiredTables = [
        'mvp_store_connections',
        'mvp_products',
        'mvp_sync_status',
        'mvp_sync_logs',
        'mvp_encrypted_credentials',
      ];

      const existingTables = await this.checkExistingTables();
      
      for (const table of requiredTables) {
        if (!existingTables.includes(table)) {
          result.missingTables.push(table);
          result.isValid = false;
        }
      }

      // Check required indexes
      const requiredIndexes = await this.checkRequiredIndexes();
      const existingIndexes = await this.checkExistingIndexes();
      
      for (const index of requiredIndexes) {
        if (!existingIndexes.includes(index)) {
          result.missingIndexes.push(index);
          result.isValid = false;
        }
      }

      // Validate table structures
      const structureValidation = await this.validateTableStructures();
      if (!structureValidation.isValid) {
        result.errors.push(...structureValidation.errors);
        result.isValid = false;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Validation failed: ${errorMessage}`);
      result.isValid = false;
    }

    return result;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Checks database connection
   */
  private async checkDatabaseConnection(): Promise<void> {
    try {
      await this.sql`SELECT 1 as test`;
    } catch (error) {
      throw new DatabaseError(
        'Failed to connect to database',
        'connection',
        undefined,
        createErrorContext('checkDatabaseConnection', { databaseUrl: this.config.databaseUrl })
      );
    }
  }

  /**
   * Checks for existing MVP tables
   */
  private async checkExistingTables(): Promise<string[]> {
    try {
      const result = await this.sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'mvp_%'
        ORDER BY table_name
      `;
      
      return result.map(row => row.table_name as string);
    } catch (error) {
      throw new DatabaseError(
        'Failed to check existing tables',
        'query',
        'information_schema.tables',
        createErrorContext('checkExistingTables')
      );
    }
  }

  /**
   * Executes the migration SQL
   */
  private async executeMigration(result: MigrationResult): Promise<void> {
    try {
      console.log('📝 Executing migration SQL...');
      
      // Execute the migration in a transaction
      await this.sql.begin(async (sql) => {
        // Split the SQL into individual statements
        const statements = createMvpTablesSQL
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0);

        for (const statement of statements) {
          if (statement.includes('CREATE TABLE')) {
            const tableName = this.extractTableName(statement);
            if (tableName) {
              console.log(`  📋 Creating table: ${tableName}`);
              result.tablesCreated.push(tableName);
            }
          } else if (statement.includes('CREATE INDEX')) {
            const indexName = this.extractIndexName(statement);
            if (indexName) {
              console.log(`  📈 Creating index: ${indexName}`);
              result.indexesCreated.push(indexName);
            }
          }
          
          await sql.unsafe(statement);
        }
      });

      result.success = true;
      console.log('✅ Migration SQL executed successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Migration execution failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Executes the rollback SQL
   */
  private async executeRollback(result: MigrationResult): Promise<void> {
    try {
      console.log('🗑️  Executing rollback SQL...');
      
      await this.sql.begin(async (sql) => {
        await sql.unsafe(dropMvpTablesSQL);
      });

      result.success = true;
      console.log('✅ Rollback SQL executed successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Rollback execution failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Validates table structures
   */
  private async validateTableStructures(): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      // Check mvp_store_connections structure
      const storeConnectionsColumns = await this.getTableColumns('mvp_store_connections');
      const requiredStoreColumns = ['id', 'organization_id', 'platform', 'store_id', 'store_name', 'credentials_id', 'status'];
      
      for (const column of requiredStoreColumns) {
        if (!storeConnectionsColumns.includes(column)) {
          errors.push(`Missing column '${column}' in mvp_store_connections table`);
        }
      }

      // Check mvp_products structure
      const productsColumns = await this.getTableColumns('mvp_products');
      const requiredProductColumns = ['id', 'store_id', 'platform_product_id', 'name', 'sku', 'price', 'stock'];
      
      for (const column of requiredProductColumns) {
        if (!productsColumns.includes(column)) {
          errors.push(`Missing column '${column}' in mvp_products table`);
        }
      }

    } catch (error) {
      errors.push(`Structure validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Gets table columns
   */
  private async getTableColumns(tableName: string): Promise<string[]> {
    const result = await this.sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = ${tableName}
      ORDER BY ordinal_position
    `;
    
    return result.map(row => row.column_name as string);
  }

  /**
   * Checks required indexes
   */
  private async checkRequiredIndexes(): Promise<string[]> {
    return [
      'mvp_store_connections_org_idx',
      'mvp_store_connections_status_idx',
      'mvp_products_store_idx',
      'mvp_products_sku_idx',
      'mvp_sync_status_status_idx',
      'mvp_sync_logs_store_idx',
    ];
  }

  /**
   * Checks existing indexes
   */
  private async checkExistingIndexes(): Promise<string[]> {
    const result = await this.sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND indexname LIKE 'mvp_%'
      ORDER BY indexname
    `;
    
    return result.map(row => row.indexname as string);
  }

  /**
   * Extracts table name from CREATE TABLE statement
   */
  private extractTableName(statement: string): string | null {
    const match = statement.match(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(\w+)/i);
    return match ? match[1] : null;
  }

  /**
   * Extracts index name from CREATE INDEX statement
   */
  private extractIndexName(statement: string): string | null {
    const match = statement.match(/CREATE INDEX(?:\s+IF NOT EXISTS)?\s+(\w+)/i);
    return match ? match[1] : null;
  }

  /**
   * Prompts for user confirmation (in non-dry-run mode)
   */
  private async promptForConfirmation(message: string): Promise<boolean> {
    // In a real implementation, this would use readline or similar
    // For now, we'll assume confirmation in automated environments
    console.log(`⚠️  ${message}`);
    return true; // Auto-confirm for now
  }

  /**
   * Cleans up database connection
   */
  private async cleanup(): Promise<void> {
    try {
      await this.sql.end();
    } catch (error) {
      console.warn('Warning: Failed to close database connection:', error);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates migration service from environment variables
 */
export function createMigrationService(options?: Partial<MigrationConfig>): MvpMigrationService {
  const config: MigrationConfig = {
    databaseUrl: process.env.DATABASE_URL || '',
    timeout: parseInt(process.env.MIGRATION_TIMEOUT || '60000', 10),
    retryAttempts: parseInt(process.env.MIGRATION_RETRY_ATTEMPTS || '3', 10),
    dryRun: process.env.MIGRATION_DRY_RUN === 'true',
    ...options,
  };

  return new MvpMigrationService(config);
}

/**
 * Runs migration with default configuration
 */
export async function runMvpMigration(options?: Partial<MigrationConfig>): Promise<MigrationResult> {
  const migrationService = createMigrationService(options);
  return await migrationService.runMigration();
}

/**
 * Runs rollback with default configuration
 */
export async function rollbackMvpMigration(options?: Partial<MigrationConfig>): Promise<MigrationResult> {
  const migrationService = createMigrationService(options);
  return await migrationService.rollbackMigration();
}

/**
 * Validates migration with default configuration
 */
export async function validateMvpMigration(options?: Partial<MigrationConfig>) {
  const migrationService = createMigrationService(options);
  return await migrationService.validateMigration();
}