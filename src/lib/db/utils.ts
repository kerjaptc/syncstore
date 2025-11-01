/**
 * Database utility functions
 * Common database operations and helpers
 */

import { sql, type SQL } from 'drizzle-orm';
import { type PgColumn } from 'drizzle-orm/pg-core';
import type { PaginationParams, PaginatedResponse } from '@/types';

/**
 * Create a paginated query with offset and limit
 */
export function withPagination<T extends Record<string, any>>(
  query: any,
  params: PaginationParams = {}
) {
  const { page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  return query.limit(limit).offset(offset);
}

/**
 * Create a paginated response with metadata
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams = {}
): PaginatedResponse<T> {
  const { page = 1, limit = 20 } = params;
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Create a search condition for text fields
 * Uses PostgreSQL's ILIKE for case-insensitive search
 */
export function createSearchCondition(
  column: PgColumn,
  searchTerm: string
): SQL {
  return sql`${column} ILIKE ${`%${searchTerm}%`}`;
}

/**
 * Create a full-text search condition
 * Uses PostgreSQL's to_tsvector for full-text search
 */
export function createFullTextSearchCondition(
  columns: PgColumn[],
  searchTerm: string
): SQL {
  const columnList = columns.map(col => sql`${col}`).join(' || \' \' || ');
  return sql`to_tsvector('english', ${sql.raw(columnList)}) @@ plainto_tsquery('english', ${searchTerm})`;
}

/**
 * Create a date range condition
 */
export function createDateRangeCondition(
  column: PgColumn,
  startDate?: Date,
  endDate?: Date
): SQL | undefined {
  if (!startDate && !endDate) return undefined;

  if (startDate && endDate) {
    return sql`${column} BETWEEN ${startDate} AND ${endDate}`;
  }

  if (startDate) {
    return sql`${column} >= ${startDate}`;
  }

  if (endDate) {
    return sql`${column} <= ${endDate}`;
  }
}

/**
 * Create an order by clause with direction
 */
export function createOrderBy(
  column: PgColumn,
  direction: 'asc' | 'desc' = 'asc'
): SQL {
  return direction === 'asc' ? sql`${column} ASC` : sql`${column} DESC`;
}

/**
 * Create a case-insensitive order by clause
 */
export function createCaseInsensitiveOrderBy(
  column: PgColumn,
  direction: 'asc' | 'desc' = 'asc'
): SQL {
  return direction === 'asc' 
    ? sql`LOWER(${column}) ASC` 
    : sql`LOWER(${column}) DESC`;
}

/**
 * Create a JSONB contains condition
 */
export function createJsonbContainsCondition(
  column: PgColumn,
  value: Record<string, any>
): SQL {
  return sql`${column} @> ${JSON.stringify(value)}`;
}

/**
 * Create a JSONB key exists condition
 */
export function createJsonbKeyExistsCondition(
  column: PgColumn,
  key: string
): SQL {
  return sql`${column} ? ${key}`;
}

/**
 * Create an array contains condition
 */
export function createArrayContainsCondition(
  column: PgColumn,
  value: any
): SQL {
  return sql`${value} = ANY(${column})`;
}

/**
 * Create a computed available quantity expression
 * For inventory items: quantity_on_hand - quantity_reserved
 */
export function computeAvailableQuantity(
  quantityOnHandColumn: PgColumn,
  quantityReservedColumn: PgColumn
): SQL {
  return sql`${quantityOnHandColumn} - ${quantityReservedColumn}`;
}

/**
 * Create a low stock condition
 * When available quantity is less than or equal to reorder point
 */
export function createLowStockCondition(
  quantityOnHandColumn: PgColumn,
  quantityReservedColumn: PgColumn,
  reorderPointColumn: PgColumn
): SQL {
  return sql`(${quantityOnHandColumn} - ${quantityReservedColumn}) <= ${reorderPointColumn}`;
}

/**
 * Create an out of stock condition
 * When available quantity is zero or negative
 */
export function createOutOfStockCondition(
  quantityOnHandColumn: PgColumn,
  quantityReservedColumn: PgColumn
): SQL {
  return sql`(${quantityOnHandColumn} - ${quantityReservedColumn}) <= 0`;
}

/**
 * Create a revenue calculation expression
 * Sum of order total amounts
 */
export function calculateRevenue(totalAmountColumn: PgColumn): SQL {
  return sql`COALESCE(SUM(${totalAmountColumn}), 0)`;
}

/**
 * Create a count with condition expression
 */
export function countWithCondition(condition: SQL): SQL {
  return sql`COUNT(CASE WHEN ${condition} THEN 1 END)`;
}

/**
 * Create a percentage calculation expression
 */
export function calculatePercentage(
  numeratorColumn: PgColumn,
  denominatorColumn: PgColumn
): SQL {
  return sql`CASE 
    WHEN ${denominatorColumn} > 0 
    THEN ROUND((${numeratorColumn}::DECIMAL / ${denominatorColumn}::DECIMAL) * 100, 2)
    ELSE 0 
  END`;
}

/**
 * Create a date truncation expression
 * Useful for grouping by day, week, month, etc.
 */
export function truncateDate(
  column: PgColumn,
  precision: 'day' | 'week' | 'month' | 'year' = 'day'
): SQL {
  return sql`DATE_TRUNC(${precision}, ${column})`;
}

/**
 * Create a conditional aggregation expression
 * Useful for creating pivot-like queries
 */
export function conditionalSum(
  column: PgColumn,
  condition: SQL
): SQL {
  return sql`SUM(CASE WHEN ${condition} THEN ${column} ELSE 0 END)`;
}

/**
 * Create a rank expression
 * Useful for ranking results within groups
 */
export function createRank(
  orderByColumn: PgColumn,
  direction: 'asc' | 'desc' = 'desc'
): SQL {
  return direction === 'desc'
    ? sql`RANK() OVER (ORDER BY ${orderByColumn} DESC)`
    : sql`RANK() OVER (ORDER BY ${orderByColumn} ASC)`;
}

/**
 * Create a row number expression
 * Useful for pagination and unique ordering
 */
export function createRowNumber(
  orderByColumn: PgColumn,
  direction: 'asc' | 'desc' = 'asc'
): SQL {
  return direction === 'asc'
    ? sql`ROW_NUMBER() OVER (ORDER BY ${orderByColumn} ASC)`
    : sql`ROW_NUMBER() OVER (ORDER BY ${orderByColumn} DESC)`;
}

/**
 * Create a window function for running totals
 */
export function createRunningTotal(
  column: PgColumn,
  orderByColumn: PgColumn
): SQL {
  return sql`SUM(${column}) OVER (ORDER BY ${orderByColumn} ROWS UNBOUNDED PRECEDING)`;
}

/**
 * Create a lag expression for comparing with previous row
 */
export function createLag(
  column: PgColumn,
  orderByColumn: PgColumn,
  offset: number = 1
): SQL {
  return sql`LAG(${column}, ${offset}) OVER (ORDER BY ${orderByColumn})`;
}

/**
 * Create a lead expression for comparing with next row
 */
export function createLead(
  column: PgColumn,
  orderByColumn: PgColumn,
  offset: number = 1
): SQL {
  return sql`LEAD(${column}, ${offset}) OVER (ORDER BY ${orderByColumn})`;
}

/**
 * Escape special characters for LIKE queries
 */
export function escapeLikeString(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

/**
 * Generate a unique SKU with prefix
 */
export function generateSku(prefix: string = 'SKU'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
}

/**
 * Validate SKU format
 */
export function isValidSku(sku: string): boolean {
  // SKU should be alphanumeric with hyphens, 3-50 characters
  const skuRegex = /^[A-Z0-9-]{3,50}$/;
  return skuRegex.test(sku);
}

/**
 * Format currency amount
 */
export function formatCurrency(
  amount: number,
  currency: string = 'IDR',
  locale: string = 'id-ID'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Calculate percentage change
 */
export function calculatePercentageChange(
  current: number,
  previous: number
): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Round to specified decimal places
 */
export function roundToDecimals(value: number, decimals: number = 2): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Check if a date is within a range
 */
export function isDateInRange(
  date: Date,
  startDate?: Date,
  endDate?: Date
): boolean {
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

/**
 * Get start and end of day for a given date
 */
export function getDayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

/**
 * Get start and end of week for a given date
 */
export function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

/**
 * Get start and end of month for a given date
 */
export function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  
  return { start, end };
}