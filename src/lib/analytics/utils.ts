/**
 * Analytics Utilities (Client-Safe)
 * Utility functions that can be safely used in both client and server components
 */

/**
 * Analytics System Configuration
 */
export const ANALYTICS_CONFIG = {
  // Cache settings
  DEFAULT_TTL: 300, // 5 minutes
  MAX_CACHE_SIZE: 1000,
  REFRESH_THRESHOLD: 0.8,
  
  // Query limits
  MAX_DATE_RANGE_DAYS: 365,
  MAX_RESULTS_PER_QUERY: 10000,
  
  // Real-time settings
  REAL_TIME_BATCH_SIZE: 100,
  REAL_TIME_FLUSH_INTERVAL: 5000, // 5 seconds
  
  // Performance settings
  BACKGROUND_REFRESH_PROBABILITY: 0.1, // 10%
  CACHE_CLEANUP_INTERVAL: 600000, // 10 minutes
} as const;

/**
 * Analytics Metrics Registry
 */
export const ANALYTICS_METRICS = {
  // Order metrics
  ORDER_COUNT: 'count',
  ORDER_REVENUE: 'revenue',
  AVERAGE_ORDER_VALUE: 'averageOrderValue',
  UNIQUE_CUSTOMERS: 'uniqueCustomers',
  
  // Product metrics
  PRODUCT_SALES: 'productSales',
  PRODUCT_REVENUE: 'productRevenue',
  PRODUCT_QUANTITY: 'productQuantity',
  
  // Inventory metrics
  STOCK_LEVEL: 'stockLevel',
  STOCK_MOVEMENT: 'stockMovement',
  TURNOVER_RATE: 'turnoverRate',
  
  // Platform metrics
  PLATFORM_REVENUE: 'platformRevenue',
  PLATFORM_ORDERS: 'platformOrders',
  
  // Sync metrics
  SYNC_SUCCESS_RATE: 'successRate',
  SYNC_JOB_COUNT: 'syncJobCount',
  SYNC_DURATION: 'syncDuration',
} as const;

/**
 * Analytics Group By Options
 */
export const ANALYTICS_GROUP_BY = {
  // Time-based grouping
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year',
  
  // Entity-based grouping
  STORE: 'store',
  PLATFORM: 'platform',
  PRODUCT: 'product',
  CATEGORY: 'category',
  STATUS: 'status',
  
  // Location-based grouping
  LOCATION: 'location',
  REGION: 'region',
} as const;

/**
 * Utility functions for analytics
 */
export const analyticsUtils = {
  /**
   * Generate date range for common periods
   */
  getDateRange: (period: 'today' | 'week' | 'month' | 'quarter' | 'year') => {
    const end = new Date();
    const start = new Date();
    
    switch (period) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start.setDate(end.getDate() - 7);
        break;
      case 'month':
        start.setMonth(end.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(end.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(end.getFullYear() - 1);
        break;
    }
    
    return { start, end };
  },

  /**
   * Format analytics data for charts
   */
  formatForChart: (data: any[], xField: string, yField: string) => {
    return {
      labels: data.map(item => item[xField]),
      datasets: [{
        label: yField,
        data: data.map(item => item[yField]),
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgba(59, 130, 246, 1)',
      }],
    };
  },

  /**
   * Calculate percentage change
   */
  calculatePercentageChange: (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  },

  /**
   * Format currency values
   */
  formatCurrency: (amount: number, currency = 'IDR'): string => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency,
    }).format(amount);
  },

  /**
   * Format large numbers
   */
  formatNumber: (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  },
};