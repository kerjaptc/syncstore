import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/env';
import * as schema from './schema';

/**
 * Database connection configuration
 * Uses connection pooling for optimal performance
 */
const connectionString = env.DATABASE_URL;

// Create postgres client with connection pooling
const client = postgres(connectionString, {
  // Connection pool configuration
  max: 10, // Maximum number of connections
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
  
  // Performance optimizations
  prepare: false, // Disable prepared statements for better compatibility
  transform: postgres.camel, // Transform snake_case to camelCase
  
  // Error handling
  onnotice: env.NODE_ENV === 'development' ? console.log : () => {}, // Log notices in development
});

/**
 * Drizzle database instance
 * Configured with schema and logging
 */
export const db = drizzle(client, {
  schema,
  logger: env.NODE_ENV === 'development', // Enable query logging in development
});

/**
 * Database connection health check
 * Used for monitoring and health endpoints
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Close database connection
 * Used for graceful shutdown
 */
export async function closeDatabaseConnection(): Promise<void> {
  await client.end();
}

// Export types for use in other files
export type Database = typeof db;
export * from './schema';