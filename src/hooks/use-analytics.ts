'use client';

/**
 * Analytics Hook
 * Provides data fetching and state management for analytics components
 */

import { useState, useEffect, useCallback } from 'react';
import { AnalyticsQuery, AnalyticsResult, DashboardMetrics } from '@/types';

interface UseAnalyticsOptions {
  dateRange: { start: Date; end: Date };
  storeIds?: string[];
  includeRealTime?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseAnalyticsReturn {
  dashboardMetrics: DashboardMetrics | null;
  salesAnalytics: any | null;
  platformComparison: AnalyticsResult | null;
  inventoryAnalytics: AnalyticsResult | null;
  isLoading: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
}

export function useAnalytics(options: UseAnalyticsOptions): UseAnalyticsReturn {
  const {
    dateRange,
    storeIds = [],
    includeRealTime = false,
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
  } = options;

  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [salesAnalytics, setSalesAnalytics] = useState<any | null>(null);
  const [platformComparison, setPlatformComparison] = useState<AnalyticsResult | null>(null);
  const [inventoryAnalytics, setInventoryAnalytics] = useState<AnalyticsResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardMetrics = useCallback(async (force = false) => {
    try {
      const params = new URLSearchParams();
      if (includeRealTime) params.append('includeRealTime', 'true');
      if (force) params.append('refresh', 'true');

      const response = await fetch(`/api/analytics/dashboard?${params}`);
      if (!response.ok) throw new Error('Failed to fetch dashboard metrics');
      
      const result = await response.json();
      if (result.success) {
        setDashboardMetrics(result.data.dashboard);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [includeRealTime]);

  const fetchSalesAnalytics = useCallback(async () => {
    try {
      const query: AnalyticsQuery = {
        organizationId: '', // Will be set by API
        dateRange,
        storeIds,
        metrics: ['count', 'revenue', 'averageOrderValue'],
        groupBy: ['day'],
      };

      const response = await fetch('/api/analytics/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
      });

      if (!response.ok) throw new Error('Failed to fetch sales analytics');
      
      const result = await response.json();
      if (result.success) {
        setSalesAnalytics(result.data);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Error fetching sales analytics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [dateRange, storeIds]);

  const fetchPlatformComparison = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        type: 'platform-comparison',
        days: Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)).toString(),
      });

      const response = await fetch(`/api/analytics/query?${params}`);
      if (!response.ok) throw new Error('Failed to fetch platform comparison');
      
      const result = await response.json();
      if (result.success) {
        setPlatformComparison(result.data);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Error fetching platform comparison:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [dateRange]);

  const fetchInventoryAnalytics = useCallback(async () => {
    try {
      const query: AnalyticsQuery = {
        organizationId: '', // Will be set by API
        dateRange,
        storeIds,
        metrics: ['stockLevel', 'stockMovement'],
        groupBy: ['category'],
      };

      const response = await fetch('/api/analytics/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
      });

      if (!response.ok) throw new Error('Failed to fetch inventory analytics');
      
      const result = await response.json();
      if (result.success) {
        setInventoryAnalytics(result.data);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Error fetching inventory analytics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [dateRange, storeIds]);

  const refresh = useCallback(async (force = false) => {
    setIsLoading(true);
    setError(null);

    try {
      await Promise.all([
        fetchDashboardMetrics(force),
        fetchSalesAnalytics(),
        fetchPlatformComparison(),
        fetchInventoryAnalytics(),
      ]);
    } catch (err) {
      console.error('Error refreshing analytics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchDashboardMetrics, fetchSalesAnalytics, fetchPlatformComparison, fetchInventoryAnalytics]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refresh();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refresh]);

  return {
    dashboardMetrics,
    salesAnalytics,
    platformComparison,
    inventoryAnalytics,
    isLoading,
    error,
    refresh,
  };
}