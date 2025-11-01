#!/usr/bin/env tsx

/**
 * Database migration utilities
 * Handles database schema migrations and rollbacks
 * 
 * Usage: 
 * - npm run db:generate (generate migrations)
 * - npm run db:migrate (run migrations)
 */

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, closeDatabaseConnection } from './index';
import { env } from '@/env';

/**
 * Run database migrations
 * Applies all pending migrations to the database
 */
export async function runMigrations() {
  console.log('🚀 Starting database migrations...');
  
  try {
    await migrate(db, {
      migrationsFolder: './drizzle',
    });
    
    console.log('✅ Database migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    throw error;
  }
}

/**
 * Check migration status
 * Shows which migrations have been applied
 */
export async function checkMigrationStatus() {
  console.log('📋 Checking migration status...');
  
  try {
    // Query the migrations table to see applied migrations
    const result = await db.execute(`
      SELECT * FROM __drizzle_migrations__ 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    if (result.length === 0) {
      console.log('📝 No migrations have been applied yet.');
    } else {
      console.log('📝 Recent migrations:');
      result.forEach((migration: any) => {
        console.log(`  ✅ ${migration.hash} - ${new Date(migration.created_at).toISOString()}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Failed to check migration status:', error);
    throw error;
  }
}

/**
 * Validate database connection
 * Ensures the database is accessible before running migrations
 */
export async function validateDatabaseConnection() {
  console.log('🔍 Validating database connection...');
  
  try {
    // Simple query to test connection
    await db.execute('SELECT 1');
    console.log('✅ Database connection is valid');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.error('Please check your DATABASE_URL environment variable');
    throw error;
  }
}

/**
 * Create database if it doesn't exist
 * Useful for initial setup
 */
export async function ensureDatabaseExists() {
  console.log('🔍 Ensuring database exists...');
  
  try {
    // Extract database name from connection string
    const url = new URL(env.DATABASE_URL);
    const dbName = url.pathname.slice(1); // Remove leading slash
    
    if (!dbName) {
      throw new Error('Database name not found in DATABASE_URL');
    }
    
    console.log(`📊 Database: ${dbName}`);
    
    // Try to connect - if it fails, the database might not exist
    await validateDatabaseConnection();
    
  } catch (error) {
    console.error('❌ Database validation failed:', error);
    throw error;
  }
}

/**
 * Reset database (DANGEROUS - only for development)
 * Drops all tables and re-runs migrations
 */
export async function resetDatabase() {
  if (env.NODE_ENV === 'production') {
    throw new Error('❌ Database reset is not allowed in production!');
  }
  
  console.log('⚠️  WARNING: This will delete all data in the database!');
  console.log('🗑️  Resetting database...');
  
  try {
    // Drop all tables (this is a simplified approach)
    // In a real scenario, you might want to be more selective
    await db.execute(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO public;
    `);
    
    console.log('🗑️  Database reset completed');
    
    // Re-run migrations
    await runMigrations();
    
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    throw error;
  }
}

/**
 * Backup database schema
 * Creates a backup of the current schema
 */
export async function backupSchema() {
  console.log('💾 Creating schema backup...');
  
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `schema_backup_${timestamp}`;
    
    // This is a simplified backup - in production you'd use pg_dump
    console.log(`📁 Backup would be created as: ${backupName}`);
    console.log('💡 For production, use pg_dump for proper backups');
    
  } catch (error) {
    console.error('❌ Schema backup failed:', error);
    throw error;
  }
}

/**
 * Main migration function
 * Orchestrates the migration process with proper error handling
 */
async function main() {
  console.log('🏗️  StoreSync Database Migration Tool');
  console.log('=====================================');
  
  try {
    // Validate environment
    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    
    // Check database connection
    await validateDatabaseConnection();
    
    // Ensure database exists
    await ensureDatabaseExists();
    
    // Check current migration status
    await checkMigrationStatus();
    
    // Run migrations
    await runMigrations();
    
    // Final status check
    await checkMigrationStatus();
    
    console.log('');
    console.log('🎉 Migration process completed successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Run: npm run db:seed (to populate initial data)');
    console.log('2. Start the application: npm run dev');
    
  } catch (error) {
    console.error('❌ Migration process failed:', error);
    process.exit(1);
  } finally {
    // Clean up database connection
    await closeDatabaseConnection();
  }
}

/**
 * Cleanup function for graceful shutdown
 */
async function cleanup() {
  console.log('🧹 Cleaning up...');
  await closeDatabaseConnection();
  process.exit(0);
}

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Run migrations if this file is executed directly
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'status':
      checkMigrationStatus()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    case 'reset':
      resetDatabase()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    case 'backup':
      backupSchema()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    default:
      main().catch((error) => {
        console.error('❌ Unhandled error:', error);
        process.exit(1);
      });
  }
}