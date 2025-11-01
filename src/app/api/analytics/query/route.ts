/**
 * Analytics Query API Route
 * Provides flexible analytics querying with caching
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { analyticsCacheLayer } from '@/lib/analytics/cache-layer';
import { analyticsQueryEngine } from '@/lib/analytics/query-engine';
import { z } from 'zod';

const analyticsQuerySchema = z.object({
  storeIds: z.array(z.string()).optional(),
  dateRange: z.object({
    start: z.string().transform(str => new Date(str)),
    end: z.string().transform(str => new Date(str)),
  }),
  metrics: z.array(z.string()),
  groupBy: z.array(z.string()).optional(),
  filters: z.record(z.any()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    
    const queryData = analyticsQuerySchema.parse(body);
    
    // Build analytics query
    const analyticsQuery = {
      organizationId: user.organizationId,
      ...queryData,
    };

    // Validate date range
    if (analyticsQuery.dateRange.start >= analyticsQuery.dateRange.end) {
      return NextResponse.json(
        { success: false, error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    // Check date range limit (max 1 year)
    const maxDays = 365;
    const daysDiff = Math.ceil(
      (analyticsQuery.dateRange.end.getTime() - analyticsQuery.dateRange.start.getTime()) / 
      (1000 * 60 * 60 * 24)
    );
    
    if (daysDiff > maxDays) {
      return NextResponse.json(
        { success: false, error: `Date range cannot exceed ${maxDays} days` },
        { status: 400 }
      );
    }

    // Execute query with caching
    const result = await analyticsCacheLayer.getAnalytics(analyticsQuery);

    return NextResponse.json({
      success: true,
      data: result,
      query: {
        ...analyticsQuery,
        dateRange: {
          start: analyticsQuery.dateRange.start.toISOString(),
          end: analyticsQuery.dateRange.end.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('Analytics query error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to execute analytics query' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    
    // Get predefined analytics queries
    const queryType = searchParams.get('type');
    const days = parseInt(searchParams.get('days') || '30');
    
    if (!queryType) {
      return NextResponse.json(
        { success: false, error: 'Query type is required' },
        { status: 400 }
      );
    }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    let analyticsQuery;

    switch (queryType) {
      case 'sales-overview':
        analyticsQuery = {
          organizationId: user.organizationId,
          dateRange: { start: startDate, end: endDate },
          metrics: ['count', 'revenue', 'averageOrderValue'],
          groupBy: days <= 7 ? ['day'] : days <= 30 ? ['day'] : ['week'],
        };
        break;

      case 'platform-comparison':
        analyticsQuery = {
          organizationId: user.organizationId,
          dateRange: { start: startDate, end: endDate },
          metrics: ['platformRevenue', 'platformOrders'],
          groupBy: ['store'],
        };
        break;

      case 'inventory-overview':
        analyticsQuery = {
          organizationId: user.organizationId,
          dateRange: { start: startDate, end: endDate },
          metrics: ['stockLevel', 'stockMovement'],
          groupBy: ['category'],
        };
        break;

      case 'top-products':
        analyticsQuery = {
          organizationId: user.organizationId,
          dateRange: { start: startDate, end: endDate },
          metrics: ['productRevenue', 'productQuantity'],
          groupBy: ['product'],
          filters: { limit: 10 },
        };
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid query type' },
          { status: 400 }
        );
    }

    const result = await analyticsCacheLayer.getAnalytics(analyticsQuery);

    return NextResponse.json({
      success: true,
      data: result,
      queryType,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    });
  } catch (error) {
    console.error('Predefined analytics query error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to execute predefined query' },
      { status: 500 }
    );
  }
}