/**
 * Database Monitoring Middleware
 * Integrates performance monitoring with database operations
 */

import { databaseMonitor } from './database-monitor';
import { db } from '@/lib/db';

/**
 * Wrap database queries with performance monitoring
 */
export function withDatabaseMonitoring<T extends any[], R>(
  queryFn: (...args: T) => Promise<R>,
  queryName: string
) {
  return async (...args: T): Promise<R> => {
    // Extract SQL query if available
    let query = queryName;
    if (args.length > 0 && typeof args[0] === 'string') {
      query = args[0];
    }

    return databaseMonitor.trackQuery(
      query,
      () => queryFn(...args),
      { queryName, args: args.length }
    );
  };
}

/**
 * Enhanced database client with monitoring
 */
export const monitoredDb = {
  // Wrap common database operations
  execute: withDatabaseMonitoring(db.execute.bind(db), 'execute'),
  
  select: withDatabaseMonitoring(db.select.bind(db), 'select'),
  
  insert: withDatabaseMonitoring(db.insert.bind(db), 'insert'),
  
  update: withDatabaseMonitoring(db.update.bind(db), 'update'),
  
  delete: withDatabaseMonitoring(db.delete.bind(db), 'delete'),

  // Transaction wrapper with monitoring
  transaction: async <T>(
    callback: (tx: typeof db) => Promise<T>
  ): Promise<T> => {
    return databaseMonitor.trackQuery(
      'TRANSACTION',
      () => db.transaction(callback),
      { type: 'transaction' }
    );
  },

  // Batch operation wrapper
  batch: withDatabaseMonitoring(db.batch.bind(db), 'batch'),
};

/**
 * Query builder wrapper that adds monitoring
 */
export function monitorQuery<T>(queryBuilder: T, queryName: string): T {
  if (typeof queryBuilder === 'object' && queryBuilder !== null) {
    // Create a proxy to intercept method calls
    return new Proxy(queryBuilder, {
      get(target: any, prop: string | symbol) {
        const value = target[prop];
        
        if (typeof value === 'function' && prop === 'execute') {
          return async (...args: any[]) => {
            return databaseMonitor.trackQuery(
              queryName,
              () => value.apply(target, args),
              { queryBuilder: true, method: prop.toString() }
            );
          };
        }
        
        return value;
      }
    });
  }
  
  return queryBuilder;
}

/**
 * Decorator for service methods that perform database operations
 */
export function MonitorDatabase(queryName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const name = queryName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      return databaseMonitor.trackQuery(
        name,
        () => originalMethod.apply(this, args),
        { 
          service: target.constructor.name,
          method: propertyKey,
          args: args.length 
        }
      );
    };

    return descriptor;
  };
}