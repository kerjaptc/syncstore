/**
 * Monitoring System Integration Example
 * Shows how to integrate monitoring into existing services
 */

import { monitoredDb, MonitorDatabase } from './db-middleware';
import { performanceMonitor } from './performance-monitor';
import { cacheMonitor } from './cache-monitor';

/**
 * Example service class with monitoring integration
 */
export class MonitoredProductService {
  /**
   * Get product with database monitoring
   */
  @MonitorDatabase('ProductService.getProduct')
  async getProduct(id: string) {
    // Use monitored database client
    const result = await monitoredDb.select()
      .from('products')
      .where('id', id)
      .limit(1);
    
    return result[0];
  }

  /**
   * Get products with caching and performance monitoring
   */
  async getProducts(organizationId: string, filters: any = {}) {
    const cacheKey = `products:${organizationId}:${JSON.stringify(filters)}`;
    
    return cacheMonitor.get('products', cacheKey, async () => {
      // This will be automatically monitored by the cache system
      return performanceMonitor.trackFunction(
        'ProductService.fetchProducts',
        'database',
        async () => {
          return monitoredDb.select()
            .from('products')
            .where('organizationId', organizationId);
        },
        { organizationId, filters }
      );
    }, 300); // 5 minutes cache
  }

  /**
   * Create product with comprehensive monitoring
   */
  async createProduct(productData: any) {
    const metricId = performanceMonitor.startMetric(
      'ProductService.createProduct',
      'database',
      { productData: Object.keys(productData) }
    );

    try {
      // Use transaction with monitoring
      const result = await monitoredDb.transaction(async (tx) => {
        const product = await tx.insert('products').values(productData).returning();
        
        // Clear related cache entries
        cacheMonitor.delete('products', `products:${productData.organizationId}:*`);
        
        return product[0];
      });

      performanceMonitor.endMetric(metricId, true, undefined, {
        productId: result.id,
      });

      return result;
    } catch (error) {
      performanceMonitor.endMetric(
        metricId, 
        false, 
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  /**
   * Bulk operation with performance tracking
   */
  async bulkUpdateProducts(productIds: string[], updates: any) {
    return performanceMonitor.trackFunction(
      'ProductService.bulkUpdateProducts',
      'database',
      async () => {
        const results = [];
        
        // Process in batches for better performance
        const batchSize = 100;
        for (let i = 0; i < productIds.length; i += batchSize) {
          const batch = productIds.slice(i, i + batchSize);
          
          const batchResult = await monitoredDb
            .update('products')
            .set(updates)
            .where('id', 'in', batch)
            .returning();
          
          results.push(...batchResult);
        }

        // Clear cache for affected products
        cacheMonitor.clear('products');
        
        return results;
      },
      { 
        productCount: productIds.length,
        batchSize,
        updates: Object.keys(updates)
      }
    );
  }
}

/**
 * Example API route with monitoring
 */
export async function monitoredApiHandler(request: Request) {
  const startTime = performance.now();
  const metricId = performanceMonitor.startMetric(
    'api_products_list',
    'request',
    { 
      method: request.method,
      url: request.url 
    }
  );

  try {
    const productService = new MonitoredProductService();
    const products = await productService.getProducts('org-123');

    const responseTime = performance.now() - startTime;
    
    performanceMonitor.endMetric(metricId, true, undefined, {
      responseTime,
      productCount: products.length,
      statusCode: 200,
    });

    return new Response(JSON.stringify(products), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const responseTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    performanceMonitor.endMetric(metricId, false, errorMessage, {
      responseTime,
      statusCode: 500,
    });

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Example middleware for automatic request monitoring
 */
export function withRequestMonitoring(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const startTime = performance.now();
    const url = new URL(request.url);
    const metricId = performanceMonitor.startMetric(
      `api_${url.pathname.replace(/\//g, '_')}`,
      'request',
      {
        method: request.method,
        pathname: url.pathname,
        userAgent: request.headers.get('user-agent'),
      }
    );

    try {
      const response = await handler(request);
      const responseTime = performance.now() - startTime;
      
      performanceMonitor.endMetric(metricId, true, undefined, {
        responseTime,
        statusCode: response.status,
        contentLength: response.headers.get('content-length'),
      });

      return response;
    } catch (error) {
      const responseTime = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      performanceMonitor.endMetric(metricId, false, errorMessage, {
        responseTime,
        statusCode: 500,
      });

      throw error;
    }
  };
}

/**
 * Example of monitoring a sync operation
 */
export async function monitoredSyncOperation(storeId: string, syncType: string) {
  const metricId = performanceMonitor.startMetric(
    `sync_${syncType}`,
    'sync',
    { storeId, syncType }
  );

  try {
    // Simulate sync operation
    const results = await performanceMonitor.trackFunction(
      `sync_${syncType}_fetch`,
      'sync',
      async () => {
        // Fetch data from external API
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { processed: 100, errors: 0 };
      },
      { storeId, operation: 'fetch' }
    );

    // Update database with monitoring
    await performanceMonitor.trackFunction(
      `sync_${syncType}_update`,
      'database',
      async () => {
        await monitoredDb.insert('sync_logs').values({
          storeId,
          syncType,
          status: 'completed',
          itemsProcessed: results.processed,
          errors: results.errors,
          timestamp: new Date(),
        });
      },
      { storeId, itemsProcessed: results.processed }
    );

    performanceMonitor.endMetric(metricId, true, undefined, {
      itemsProcessed: results.processed,
      errors: results.errors,
    });

    return results;
  } catch (error) {
    performanceMonitor.endMetric(
      metricId,
      false,
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
}

/**
 * Example of using cache with monitoring for analytics
 */
export async function getCachedAnalytics(organizationId: string, dateRange: string) {
  const cacheKey = `analytics:${organizationId}:${dateRange}`;
  
  return cacheMonitor.get('analytics', cacheKey, async () => {
    return performanceMonitor.trackFunction(
      'Analytics.calculateMetrics',
      'database',
      async () => {
        // Simulate complex analytics calculation
        const metrics = await monitoredDb.select()
          .from('orders')
          .where('organizationId', organizationId)
          .groupBy('date')
          .orderBy('date');

        return {
          totalRevenue: 10000,
          orderCount: 150,
          averageOrderValue: 66.67,
          metrics,
        };
      },
      { organizationId, dateRange }
    );
  }, 600); // 10 minutes cache for analytics
}