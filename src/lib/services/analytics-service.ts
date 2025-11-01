/**
 * Analytics Service
 * Provides data aggregation and analytics functionality for sales and inventory metrics
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
  organizations
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
  between
} from 'drizzle-orm';
import { 
  AnalyticsQuery, 
  AnalyticsResult, 
  DashboardMetrics 
} from '@/types';
import { cache } from '@/lib/cache';

export class AnalyticsService {
  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(organizationId: string): Promise<DashboardMetrics> {
    const cacheKey = `dashboard-metrics:${organizationId}`;
    
    return cache.get(cacheKey, async () => {
      // Get store metrics
      const storeMetrics = await db
        .select({
          total: count(),
          active: sql<number>`COUNT(CASE WHEN ${stores.isActive} = true THEN 1 END)`,
          syncing: sql<number>`COUNT(CASE WHEN ${stores.syncStatus} = 'active' THEN 1 END)`,
          errors: sql<number>`COUNT(CASE WHEN ${stores.syncStatus} = 'error' THEN 1 END)`,
        })
        .from(stores)
        .where(eq(stores.organizationId, organizationId));

      // Get product metrics
      const productMetrics = await db
        .select({
          total: count(),
          active: sql<number>`COUNT(CASE WHEN ${products.isActive} = true THEN 1 END)`,
        })
        .from(products)
        .where(eq(products.organizationId, organizationId));

      // Get inventory metrics
      const inventoryMetrics = await db
        .select({
          lowStock: sql<number>`COUNT(CASE WHEN ${inventoryItems.quantityOnHand} <= ${inventoryItems.reorderPoint} AND ${inventoryItems.reorderPoint} > 0 THEN 1 END)`,
          outOfStock: sql<number>`COUNT(CASE WHEN ${inventoryItems.quantityOnHand} = 0 THEN 1 END)`,
        })
        .from(inventoryItems)
        .innerJoin(productVariants, eq(inventoryItems.productVariantId, productVariants.id))
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(eq(products.organizationId, organizationId));

      // Get order metrics (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const orderMetrics = await db
        .select({
          total: count(),
          pending: sql<number>`COUNT(CASE WHEN ${orders.status} = 'pending' THEN 1 END)`,
          processing: sql<number>`COUNT(CASE WHEN ${orders.status} = 'processing' THEN 1 END)`,
          completed: sql<number>`COUNT(CASE WHEN ${orders.status} = 'completed' THEN 1 END)`,
          revenue: sql<number>`COALESCE(SUM(CAST(${orders.totalAmount} AS DECIMAL)), 0)`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.organizationId, organizationId),
            gte(orders.orderedAt, thirtyDaysAgo)
          )
        );

      return {
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    conversionRate: 0,
    topProducts: [],
    recentOrders: [],
    platformBreakdown: [],
    growthMetrics: { revenue: 0, orders: 0 },
        stores: {
          total: storeMetrics[0]?.total || 0,
          active: storeMetrics[0]?.active || 0,
          syncing: storeMetrics[0]?.syncing || 0,
          errors: storeMetrics[0]?.errors || 0,
        },
        products: {
          total: productMetrics[0]?.total || 0,
          active: productMetrics[0]?.active || 0,
          lowStock: inventoryMetrics[0]?.lowStock || 0,
          outOfStock: inventoryMetrics[0]?.outOfStock || 0,
        },
        orders: {
          total: orderMetrics[0]?.total || 0,
          pending: orderMetrics[0]?.pending || 0,
          processing: orderMetrics[0]?.processing || 0,
          completed: orderMetrics[0]?.completed || 0,
          revenue: Number(orderMetrics[0]?.revenue) || 0,
        },
        sync: {
          lastSync: null, // TODO: Get from sync jobs
          successRate: 0, // TODO: Calculate from sync jobs
          pendingJobs: 0, // TODO: Get from sync jobs
          failedJobs: 0, // TODO: Get from sync jobs
        },
      };
    }, 300); // Cache for 5 minutes
  }

  /**
   * Get sales analytics with flexible querying
   */
  async getSalesAnalytics(query: AnalyticsQuery): Promise<AnalyticsResult> {
    const { organizationId, storeIds, dateRange, metrics, groupBy, filters } = query;
    
    // Build base conditions
    const conditions = [
      eq(orders.organizationId, organizationId),
      gte(orders.orderedAt, dateRange.start),
      lte(orders.orderedAt, dateRange.end),
    ];

    if (storeIds && storeIds.length > 0) {
      conditions.push(sql`${orders.storeId} IN (${storeIds.join(',')})`);
    }

    // Apply additional filters
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (key === 'status' && value) {
          conditions.push(eq(orders.status, value));
        }
        if (key === 'minAmount' && value) {
          conditions.push(gte(orders.totalAmount, value.toString()));
        }
        if (key === 'maxAmount' && value) {
          conditions.push(lte(orders.totalAmount, value.toString()));
        }
      });
    }

    // Get aggregated data
    const aggregatedData = await this.getAggregatedSalesData(conditions, groupBy);
    
    // Get summary metrics
    const summary = await this.getSalesSummary(conditions);

    // Format chart data if groupBy is specified
    let chartData;
    if (groupBy && groupBy.length > 0) {
      chartData = this.formatChartData(aggregatedData, groupBy[0]);
    }

    return {
      data: aggregatedData,
      summary,
      chartData,
    };
  }

  /**
   * Get inventory analytics
   */
  async getInventoryAnalytics(query: AnalyticsQuery): Promise<AnalyticsResult> {
    const { organizationId, dateRange, groupBy } = query;

    // Get inventory turnover data
    const turnoverData = await db
      .select({
        productName: products.name,
        sku: products.sku,
        currentStock: inventoryItems.quantityOnHand,
        soldQuantity: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)`,
        turnoverRate: sql<number>`
          CASE 
            WHEN ${inventoryItems.quantityOnHand} > 0 
            THEN COALESCE(SUM(${orderItems.quantity}), 0) / ${inventoryItems.quantityOnHand}
            ELSE 0 
          END
        `,
      })
      .from(products)
      .innerJoin(productVariants, eq(products.id, productVariants.productId))
      .innerJoin(inventoryItems, eq(productVariants.id, inventoryItems.productVariantId))
      .leftJoin(orderItems, eq(productVariants.id, orderItems.productVariantId))
      .leftJoin(orders, and(
        eq(orderItems.orderId, orders.id),
        gte(orders.orderedAt, dateRange.start),
        lte(orders.orderedAt, dateRange.end)
      ))
      .where(eq(products.organizationId, organizationId))
      .groupBy(
        products.id,
        products.name,
        products.sku,
        inventoryItems.quantityOnHand
      )
      .orderBy(desc(sql`COALESCE(SUM(${orderItems.quantity}), 0)`));

    // Get stock level trends
    const stockTrends = await this.getStockLevelTrends(organizationId, dateRange);

    const summary = {
      totalProducts: turnoverData.length,
      averageTurnover: turnoverData.reduce((acc, item) => acc + Number(item.turnoverRate), 0) / turnoverData.length || 0,
      lowStockItems: turnoverData.filter(item => item.currentStock <= 10).length,
      outOfStockItems: turnoverData.filter(item => item.currentStock === 0).length,
    };

    return {
      data: turnoverData.map(item => ({
        ...item,
        soldQuantity: Number(item.soldQuantity),
        turnoverRate: Number(item.turnoverRate),
      })),
      summary,
      chartData: stockTrends,
    };
  }

  /**
   * Get platform comparison analytics
   */
  async getPlatformComparison(organizationId: string, dateRange: { start: Date; end: Date }): Promise<AnalyticsResult> {
    const platformData = await db
      .select({
        platformName: sql<string>`COALESCE(${stores.name}, 'Unknown')`,
        storeId: stores.id,
        orderCount: count(orders.id),
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${orders.totalAmount} AS DECIMAL)), 0)`,
        averageOrderValue: sql<number>`COALESCE(AVG(CAST(${orders.totalAmount} AS DECIMAL)), 0)`,
      })
      .from(stores)
      .leftJoin(orders, and(
        eq(stores.id, orders.storeId),
        gte(orders.orderedAt, dateRange.start),
        lte(orders.orderedAt, dateRange.end)
      ))
      .where(eq(stores.organizationId, organizationId))
      .groupBy(stores.id, stores.name)
      .orderBy(desc(sql`COALESCE(SUM(CAST(${orders.totalAmount} AS DECIMAL)), 0)`));

    const totalRevenue = platformData.reduce((acc, platform) => acc + Number(platform.totalRevenue), 0);
    const totalOrders = platformData.reduce((acc, platform) => acc + platform.orderCount, 0);

    const summary = {
      totalPlatforms: platformData.length,
      totalRevenue,
      totalOrders,
      averageRevenuePerPlatform: totalRevenue / platformData.length || 0,
    };

    // Format for chart
    const chartData = {
      labels: platformData.map(p => p.platformName),
      datasets: [
        {
          label: 'Revenue',
          data: platformData.map(p => Number(p.totalRevenue)),
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgba(59, 130, 246, 1)',
        },
        {
          label: 'Orders',
          data: platformData.map(p => p.orderCount),
          backgroundColor: 'rgba(16, 185, 129, 0.5)',
          borderColor: 'rgba(16, 185, 129, 1)',
        },
      ],
    };

    return {
      data: platformData.map(item => ({
        ...item,
        totalRevenue: Number(item.totalRevenue),
        averageOrderValue: Number(item.averageOrderValue),
      })),
      summary,
      chartData,
    };
  }

  /**
   * Private helper methods
   */
  private async getAggregatedSalesData(conditions: any[], groupBy?: string[]): Promise<any[]> {
    let groupByClause = '';
    let selectClause = `
      COUNT(${orders.id}) as orderCount,
      COALESCE(SUM(CAST(${orders.totalAmount} AS DECIMAL)), 0) as totalRevenue,
      COALESCE(AVG(CAST(${orders.totalAmount} AS DECIMAL)), 0) as averageOrderValue
    `;

    if (groupBy && groupBy.includes('day')) {
      selectClause += `, DATE(${orders.orderedAt}) as period`;
      groupByClause = `DATE(${orders.orderedAt})`;
    } else if (groupBy && groupBy.includes('week')) {
      selectClause += `, DATE_TRUNC('week', ${orders.orderedAt}) as period`;
      groupByClause = `DATE_TRUNC('week', ${orders.orderedAt})`;
    } else if (groupBy && groupBy.includes('month')) {
      selectClause += `, DATE_TRUNC('month', ${orders.orderedAt}) as period`;
      groupByClause = `DATE_TRUNC('month', ${orders.orderedAt})`;
    }

    const query = db
      .select({
        orderCount: count(orders.id),
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${orders.totalAmount} AS DECIMAL)), 0)`,
        averageOrderValue: sql<number>`COALESCE(AVG(CAST(${orders.totalAmount} AS DECIMAL)), 0)`,
        ...(groupByClause && { period: sql<string>`${groupByClause}` }),
      })
      .from(orders)
      .where(and(...conditions));

    if (groupByClause) {
      query.groupBy(sql.raw(groupByClause));
      query.orderBy(sql.raw(groupByClause));
    }

    const result = await query;
    return result.map(item => ({
      ...item,
      totalRevenue: Number(item.totalRevenue),
      averageOrderValue: Number(item.averageOrderValue),
    }));
  }

  private async getSalesSummary(conditions: any[]): Promise<Record<string, number>> {
    const [summary] = await db
      .select({
        totalOrders: count(orders.id),
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${orders.totalAmount} AS DECIMAL)), 0)`,
        averageOrderValue: sql<number>`COALESCE(AVG(CAST(${orders.totalAmount} AS DECIMAL)), 0)`,
        uniqueCustomers: sql<number>`COUNT(DISTINCT ${orders.customerInfo}->>'email')`,
      })
      .from(orders)
      .where(and(...conditions));

    return {
      totalOrders: summary.totalOrders || 0,
      totalRevenue: Number(summary.totalRevenue) || 0,
      averageOrderValue: Number(summary.averageOrderValue) || 0,
      uniqueCustomers: summary.uniqueCustomers || 0,
    };
  }

  private async getStockLevelTrends(organizationId: string, dateRange: { start: Date; end: Date }) {
    // Get stock movement over time from inventory transactions
    const stockMovements = await db
      .select({
        date: sql<string>`DATE(${inventoryTransactions.createdAt})`,
        totalMovement: sql<number>`SUM(${inventoryTransactions.quantityChange})`,
        transactionType: inventoryTransactions.transactionType,
      })
      .from(inventoryTransactions)
      .innerJoin(inventoryItems, eq(inventoryTransactions.inventoryItemId, inventoryItems.id))
      .innerJoin(productVariants, eq(inventoryItems.productVariantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(
        and(
          eq(products.organizationId, organizationId),
          gte(inventoryTransactions.createdAt, dateRange.start),
          lte(inventoryTransactions.createdAt, dateRange.end)
        )
      )
      .groupBy(
        sql`DATE(${inventoryTransactions.createdAt})`,
        inventoryTransactions.transactionType
      )
      .orderBy(sql`DATE(${inventoryTransactions.createdAt})`);

    // Group by date and aggregate movements
    const dailyMovements = stockMovements.reduce((acc, movement) => {
      const date = movement.date;
      if (!acc[date]) {
        acc[date] = { date, inbound: 0, outbound: 0, net: 0 };
      }
      
      const quantity = Number(movement.totalMovement);
      if (quantity > 0) {
        acc[date].inbound += quantity;
      } else {
        acc[date].outbound += Math.abs(quantity);
      }
      acc[date].net += quantity;
      
      return acc;
    }, {} as Record<string, any>);

    const chartData = {
      labels: Object.keys(dailyMovements),
      datasets: [
        {
          label: 'Stock In',
          data: Object.values(dailyMovements).map((d: any) => d.inbound),
          backgroundColor: 'rgba(16, 185, 129, 0.5)',
          borderColor: 'rgba(16, 185, 129, 1)',
        },
        {
          label: 'Stock Out',
          data: Object.values(dailyMovements).map((d: any) => d.outbound),
          backgroundColor: 'rgba(239, 68, 68, 0.5)',
          borderColor: 'rgba(239, 68, 68, 1)',
        },
      ],
    };

    return chartData;
  }

  private formatChartData(data: any[], groupByField: string) {
    return {
      labels: data.map(item => item.period || item[groupByField]),
      datasets: [
        {
          label: 'Revenue',
          data: data.map(item => Number(item.totalRevenue) || 0),
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgba(59, 130, 246, 1)',
        },
        {
          label: 'Orders',
          data: data.map(item => item.orderCount || 0),
          backgroundColor: 'rgba(16, 185, 129, 0.5)',
          borderColor: 'rgba(16, 185, 129, 1)',
        },
      ],
    };
  }
}

export const analyticsService = new AnalyticsService();