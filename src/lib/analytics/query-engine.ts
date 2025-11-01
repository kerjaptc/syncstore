/**
 * Analytics Query Engine
 * Provides flexible querying capabilities with date range filtering and grouping
 */

import { db } from '@/lib/db';
import { 
  orders, 
  orderItems, 
  products, 
  productVariants, 
  inventoryItems, 
  inventoryTransactions,
  stores,
  syncJobs
} from '@/lib/db/schema';
import { 
  eq, 
  and, 
  gte, 
  lte, 
  count, 
  sum, 
  avg, 
  desc, 
  asc,
  sql,
  between,
  inArray
} from 'drizzle-orm';
import { AnalyticsQuery, AnalyticsResult } from '@/types';

export interface QueryBuilder {
  select(fields: string[]): QueryBuilder;
  from(table: string): QueryBuilder;
  where(conditions: any[]): QueryBuilder;
  groupBy(fields: string[]): QueryBuilder;
  orderBy(field: string, direction?: 'asc' | 'desc'): QueryBuilder;
  limit(count: number): QueryBuilder;
  execute(): Promise<any[]>;
}

export class AnalyticsQueryEngine {
  /**
   * Execute a flexible analytics query
   */
  async executeQuery(query: AnalyticsQuery): Promise<AnalyticsResult> {
    const { organizationId, storeIds, dateRange, metrics, groupBy, filters } = query;

    // Determine the primary entity based on metrics
    const primaryEntity = this.determinePrimaryEntity(metrics);
    
    // Build the query based on the primary entity
    switch (primaryEntity) {
      case 'orders':
        return this.executeOrdersQuery(query);
      case 'products':
        return this.executeProductsQuery(query);
      case 'inventory':
        return this.executeInventoryQuery(query);
      case 'sync':
        return this.executeSyncQuery(query);
      default:
        throw new Error(`Unsupported primary entity: ${primaryEntity}`);
    }
  }

  /**
   * Execute orders-focused analytics query
   */
  private async executeOrdersQuery(query: AnalyticsQuery): Promise<AnalyticsResult> {
    const { organizationId, storeIds, dateRange, metrics, groupBy, filters } = query;

    // Build base conditions
    const conditions = [
      eq(orders.organizationId, organizationId),
      gte(orders.orderedAt, dateRange.start),
      lte(orders.orderedAt, dateRange.end),
    ];

    if (storeIds && storeIds.length > 0) {
      conditions.push(inArray(orders.storeId, storeIds));
    }

    // Apply filters
    this.applyFilters(conditions, filters, 'orders');

    // Build select fields based on metrics
    const selectFields = this.buildSelectFields(metrics, 'orders');
    
    // Build group by clause
    const groupByClause = this.buildGroupByClause(groupBy, 'orders');

    // Execute query
    let queryBuilder = db
      .select(selectFields)
      .from(orders);

    // Add joins if needed
    if (metrics.some(m => m.includes('item') || m.includes('product'))) {
      queryBuilder = queryBuilder.leftJoin(orderItems, eq(orders.id, orderItems.orderId));
    }

    if (metrics.some(m => m.includes('store'))) {
      queryBuilder = queryBuilder.leftJoin(stores, eq(orders.storeId, stores.id));
    }

    queryBuilder = queryBuilder.where(and(...conditions));

    if (groupByClause.length > 0) {
      queryBuilder = queryBuilder.groupBy(...groupByClause);
    }

    const data = await queryBuilder;

    // Calculate summary
    const summary = await this.calculateSummary(conditions, metrics, 'orders');

    // Format chart data if grouping is applied
    const chartData = groupBy && groupBy.length > 0 
      ? this.formatChartData(data, groupBy[0], metrics)
      : undefined;

    return { total: 0, 
      data: this.formatData(data),
      summary,
      chartData,
     };
  }

  /**
   * Execute products-focused analytics query
   */
  private async executeProductsQuery(query: AnalyticsQuery): Promise<AnalyticsResult> {
    const { organizationId, dateRange, metrics, groupBy, filters } = query;

    const conditions = [eq(products.organizationId, organizationId)];
    
    // Apply filters
    this.applyFilters(conditions, filters, 'products');

    const selectFields = this.buildSelectFields(metrics, 'products');
    const groupByClause = this.buildGroupByClause(groupBy, 'products');

    let queryBuilder = db
      .select(selectFields)
      .from(products);

    // Add joins based on metrics
    if (metrics.some(m => m.includes('variant'))) {
      queryBuilder = queryBuilder.leftJoin(productVariants, eq(products.id, productVariants.productId));
    }

    if (metrics.some(m => m.includes('inventory') || m.includes('stock'))) {
      queryBuilder = queryBuilder
        .leftJoin(productVariants, eq(products.id, productVariants.productId))
        .leftJoin(inventoryItems, eq(productVariants.id, inventoryItems.productVariantId));
    }

    if (metrics.some(m => m.includes('sales') || m.includes('revenue'))) {
      queryBuilder = queryBuilder
        .leftJoin(productVariants, eq(products.id, productVariants.productId))
        .leftJoin(orderItems, eq(productVariants.id, orderItems.productVariantId))
        .leftJoin(orders, and(
          eq(orderItems.orderId, orders.id),
          gte(orders.orderedAt, dateRange.start),
          lte(orders.orderedAt, dateRange.end)
        ));
    }

    queryBuilder = queryBuilder.where(and(...conditions));

    if (groupByClause.length > 0) {
      queryBuilder = queryBuilder.groupBy(...groupByClause);
    }

    const data = await queryBuilder;
    const summary = await this.calculateSummary(conditions, metrics, 'products');

    return { total: 0, 
      data: this.formatData(data),
      summary,
      chartData: groupBy && groupBy.length > 0 
        ? this.formatChartData(data, groupBy[0], metrics)
        : undefined,
     };
  }

  /**
   * Execute inventory-focused analytics query
   */
  private async executeInventoryQuery(query: AnalyticsQuery): Promise<AnalyticsResult> {
    const { organizationId, dateRange, metrics, groupBy, filters } = query;

    const conditions = [eq(products.organizationId, organizationId)];
    
    if (dateRange) {
      conditions.push(
        gte(inventoryTransactions.createdAt, dateRange.start),
        lte(inventoryTransactions.createdAt, dateRange.end)
      );
    }

    this.applyFilters(conditions, filters, 'inventory');

    const selectFields = this.buildSelectFields(metrics, 'inventory');
    const groupByClause = this.buildGroupByClause(groupBy, 'inventory');

    let queryBuilder = db
      .select(selectFields)
      .from(inventoryItems)
      .innerJoin(productVariants, eq(inventoryItems.productVariantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id));

    if (metrics.some(m => m.includes('transaction') || m.includes('movement'))) {
      queryBuilder = queryBuilder.leftJoin(
        inventoryTransactions, 
        eq(inventoryItems.id, inventoryTransactions.inventoryItemId)
      );
    }

    queryBuilder = queryBuilder.where(and(...conditions));

    if (groupByClause.length > 0) {
      queryBuilder = queryBuilder.groupBy(...groupByClause);
    }

    const data = await queryBuilder;
    const summary = await this.calculateSummary(conditions, metrics, 'inventory');

    return { total: 0, 
      data: this.formatData(data),
      summary,
      chartData: groupBy && groupBy.length > 0 
        ? this.formatChartData(data, groupBy[0], metrics)
        : undefined,
     };
  }

  /**
   * Execute sync-focused analytics query
   */
  private async executeSyncQuery(query: AnalyticsQuery): Promise<AnalyticsResult> {
    const { organizationId, storeIds, dateRange, metrics, groupBy, filters } = query;

    const conditions = [eq(syncJobs.organizationId, organizationId)];
    
    if (dateRange) {
      conditions.push(
        gte(syncJobs.createdAt, dateRange.start),
        lte(syncJobs.createdAt, dateRange.end)
      );
    }

    if (storeIds && storeIds.length > 0) {
      conditions.push(inArray(syncJobs.storeId, storeIds));
    }

    this.applyFilters(conditions, filters, 'sync');

    const selectFields = this.buildSelectFields(metrics, 'sync');
    const groupByClause = this.buildGroupByClause(groupBy, 'sync');

    let queryBuilder = db
      .select(selectFields)
      .from(syncJobs);

    if (metrics.some(m => m.includes('store'))) {
      queryBuilder = queryBuilder.leftJoin(stores, eq(syncJobs.storeId, stores.id));
    }

    queryBuilder = queryBuilder.where(and(...conditions));

    if (groupByClause.length > 0) {
      queryBuilder = queryBuilder.groupBy(...groupByClause);
    }

    const data = await queryBuilder;
    const summary = await this.calculateSummary(conditions, metrics, 'sync');

    return { total: 0, 
      data: this.formatData(data),
      summary,
      chartData: groupBy && groupBy.length > 0 
        ? this.formatChartData(data, groupBy[0], metrics)
        : undefined,
     };
  }

  /**
   * Helper methods
   */
  private determinePrimaryEntity(metrics: string[]): string {
    if (metrics.some(m => m.includes('order') || m.includes('revenue') || m.includes('sales'))) {
      return 'orders';
    }
    if (metrics.some(m => m.includes('product') || m.includes('catalog'))) {
      return 'products';
    }
    if (metrics.some(m => m.includes('inventory') || m.includes('stock'))) {
      return 'inventory';
    }
    if (metrics.some(m => m.includes('sync') || m.includes('job'))) {
      return 'sync';
    }
    return 'orders'; // Default
  }

  private buildSelectFields(metrics: string[], entity: string): Record<string, any> {
    const fields: Record<string, any> = {};

    metrics.forEach(metric => {
      switch (metric) {
        case 'count':
          fields.count = count();
          break;
        case 'revenue':
          if (entity === 'orders') {
            fields.revenue = sql<number>`COALESCE(SUM(CAST(${orders.totalAmount} AS DECIMAL)), 0)`;
          }
          break;
        case 'averageOrderValue':
          if (entity === 'orders') {
            fields.averageOrderValue = sql<number>`COALESCE(AVG(CAST(${orders.totalAmount} AS DECIMAL)), 0)`;
          }
          break;
        case 'stockLevel':
          if (entity === 'inventory') {
            fields.stockLevel = sum(inventoryItems.quantityOnHand);
          }
          break;
        case 'stockMovement':
          if (entity === 'inventory') {
            fields.stockMovement = sum(inventoryTransactions.quantityChange);
          }
          break;
        case 'successRate':
          if (entity === 'sync') {
            fields.successRate = sql<number>`
              COALESCE(
                COUNT(CASE WHEN ${syncJobs.status} = 'completed' THEN 1 END) * 100.0 / COUNT(*),
                0
              )
            `;
          }
          break;
        default:
          // Handle custom metrics
          break;
      }
    });

    return fields;
  }

  private buildGroupByClause(groupBy: string[] | undefined, entity: string): any[] {
    if (!groupBy || groupBy.length === 0) return [];

    const clauses: any[] = [];

    groupBy.forEach(field => {
      switch (field) {
        case 'day':
          if (entity === 'orders') {
            clauses.push(sql`DATE(${orders.orderedAt})`);
          } else if (entity === 'sync') {
            clauses.push(sql`DATE(${syncJobs.createdAt})`);
          }
          break;
        case 'week':
          if (entity === 'orders') {
            clauses.push(sql`DATE_TRUNC('week', ${orders.orderedAt})`);
          } else if (entity === 'sync') {
            clauses.push(sql`DATE_TRUNC('week', ${syncJobs.createdAt})`);
          }
          break;
        case 'month':
          if (entity === 'orders') {
            clauses.push(sql`DATE_TRUNC('month', ${orders.orderedAt})`);
          } else if (entity === 'sync') {
            clauses.push(sql`DATE_TRUNC('month', ${syncJobs.createdAt})`);
          }
          break;
        case 'store':
          if (entity === 'orders') {
            clauses.push(orders.storeId);
          } else if (entity === 'sync') {
            clauses.push(syncJobs.storeId);
          }
          break;
        case 'status':
          if (entity === 'orders') {
            clauses.push(orders.status);
          } else if (entity === 'sync') {
            clauses.push(syncJobs.status);
          }
          break;
        case 'category':
          if (entity === 'products') {
            clauses.push(products.category);
          }
          break;
        default:
          // Handle custom grouping
          break;
      }
    });

    return clauses;
  }

  private applyFilters(conditions: any[], filters: Record<string, any> | undefined, entity: string): void {
    if (!filters) return;

    Object.entries(filters).forEach(([key, value]) => {
      if (!value) return;

      switch (key) {
        case 'status':
          if (entity === 'orders') {
            conditions.push(eq(orders.status, value));
          } else if (entity === 'sync') {
            conditions.push(eq(syncJobs.status, value));
          }
          break;
        case 'minAmount':
          if (entity === 'orders') {
            conditions.push(gte(orders.totalAmount, value.toString()));
          }
          break;
        case 'maxAmount':
          if (entity === 'orders') {
            conditions.push(lte(orders.totalAmount, value.toString()));
          }
          break;
        case 'category':
          if (entity === 'products') {
            conditions.push(eq(products.category, value));
          }
          break;
        case 'isActive':
          if (entity === 'products') {
            conditions.push(eq(products.isActive, value));
          }
          break;
        default:
          // Handle custom filters
          break;
      }
    });
  }

  private async calculateSummary(conditions: any[], metrics: string[], entity: string): Promise<Record<string, number>> {
    const summary: Record<string, number> = {};

    // Calculate basic summary based on entity and metrics
    if (entity === 'orders') {
      const [result] = await db
        .select({
          totalCount: count(),
          totalRevenue: sql<number>`COALESCE(SUM(CAST(${orders.totalAmount} AS DECIMAL)), 0)`,
          averageValue: sql<number>`COALESCE(AVG(CAST(${orders.totalAmount} AS DECIMAL)), 0)`,
        })
        .from(orders)
        .where(and(...conditions));

      summary.totalCount = result.totalCount || 0;
      summary.totalRevenue = Number(result.totalRevenue) || 0;
      summary.averageValue = Number(result.averageValue) || 0;
    }

    return summary;
  }

  private formatData(data: any[]): any[] {
    return data.map(item => {
      const formatted: any = {};
      
      Object.entries(item).forEach(([key, value]) => {
        if (typeof value === 'string' && !isNaN(Number(value))) {
          formatted[key] = Number(value);
        } else {
          formatted[key] = value;
        }
      });

      return formatted;
    });
  }

  private formatChartData(data: any[], groupByField: string, metrics: string[]) {
    const labels = data.map(item => {
      if (item.period) return item.period;
      if (item[groupByField]) return item[groupByField];
      return 'Unknown';
    });

    const datasets = metrics.map(metric => {
      let label = metric;
      let backgroundColor = 'rgba(59, 130, 246, 0.5)';
      let borderColor = 'rgba(59, 130, 246, 1)';

      if (metric === 'revenue') {
        label = 'Revenue';
        backgroundColor = 'rgba(16, 185, 129, 0.5)';
        borderColor = 'rgba(16, 185, 129, 1)';
      } else if (metric === 'count') {
        label = 'Count';
        backgroundColor = 'rgba(239, 68, 68, 0.5)';
        borderColor = 'rgba(239, 68, 68, 1)';
      }

      return { total: 0, 
        label,
        data: data.map(item => Number(item[metric]) || 0),
        backgroundColor,
        borderColor,
       };
    });

    return { total: 0, 
      labels,
      datasets,
     };
  }
}

export const analyticsQueryEngine = new AnalyticsQueryEngine();