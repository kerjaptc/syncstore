/**
 * Database Performance Monitor
 * Tracks database query performance, detects slow queries, and provides optimization recommendations
 */

import { getLogger } from '@/lib/error-handling';
import { performanceMonitor } from './performance-monitor';

const logger = getLogger('database-monitor');

export interface QueryMetric {
  id: string;
  query: string;
  queryHash: string;
  duration: number;
  success: boolean;
  error?: string;
  rowsAffected?: number;
  timestamp: Date;
  stackTrace?: string;
}

export interface QueryOptimizationSuggestion {
  id: string;
  queryHash: string;
  query: string;
  issue: string;
  suggestion: string;
  severity: 'low' | 'medium' | 'high';
  estimatedImprovement: string;
  timestamp: Date;
}

export interface DatabaseStats {
  totalQueries: number;
  slowQueries: number;
  averageQueryTime: number;
  errorRate: number;
  topSlowQueries: QueryMetric[];
  optimizationSuggestions: QueryOptimizationSuggestion[];
}

class DatabasePerformanceMonitor {
  private queryMetrics: Map<string, QueryMetric> = new Map();
  private optimizationSuggestions: Map<string, QueryOptimizationSuggestion> = new Map();
  
  // Thresholds for slow query detection
  private slowQueryThreshold = 1000; // 1 second
  private verySlowQueryThreshold = 5000; // 5 seconds
  private maxMetricsRetention = 10000; // Keep last 10k queries

  /**
   * Track a database query
   */
  async trackQuery<T>(
    query: string,
    queryFn: () => Promise<T>,
    context: Record<string, any> = {}
  ): Promise<T> {
    const queryHash = this.hashQuery(query);
    const metricId = performanceMonitor.startMetric(`db_query_${queryHash}`, 'database', {
      query: this.sanitizeQuery(query),
      queryHash,
      ...context,
    });

    const startTime = performance.now();
    let result: T;
    let success = true;
    let error: string | undefined;
    let rowsAffected: number | undefined;

    try {
      result = await queryFn();
      
      // Try to extract rows affected if it's a result object
      if (result && typeof result === 'object' && 'rowCount' in result) {
        rowsAffected = (result as any).rowCount;
      }
      
      return result;
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      const duration = performance.now() - startTime;
      
      // Record query metric
      const queryMetric: QueryMetric = {
        id: this.generateQueryId(),
        query: this.sanitizeQuery(query),
        queryHash,
        duration,
        success,
        error,
        rowsAffected,
        timestamp: new Date(),
        stackTrace: success ? undefined : new Error().stack,
      };

      this.queryMetrics.set(queryMetric.id, queryMetric);
      
      // End performance monitoring
      performanceMonitor.endMetric(metricId, success, error, {
        duration,
        rowsAffected,
      });

      // Check for optimization opportunities
      if (duration > this.slowQueryThreshold) {
        this.analyzeSlowQuery(queryMetric);
      }

      // Log slow queries
      if (duration > this.slowQueryThreshold) {
        logger.warn('Slow query detected', {
          queryHash,
          duration: Math.round(duration),
          query: this.sanitizeQuery(query),
          success,
          error,
        });
      }

      // Cleanup old metrics
      this.cleanupOldMetrics();
    }
  }

  /**
   * Get database performance statistics
   */
  getDatabaseStats(timeRange: number = 24 * 60 * 60 * 1000): DatabaseStats {
    const cutoff = Date.now() - timeRange;
    const recentMetrics = Array.from(this.queryMetrics.values())
      .filter(metric => metric.timestamp.getTime() > cutoff);

    const totalQueries = recentMetrics.length;
    const slowQueries = recentMetrics.filter(m => m.duration > this.slowQueryThreshold).length;
    const failedQueries = recentMetrics.filter(m => !m.success).length;
    
    const averageQueryTime = totalQueries > 0
      ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / totalQueries
      : 0;

    const errorRate = totalQueries > 0 ? (failedQueries / totalQueries) * 100 : 0;

    // Get top 10 slowest queries
    const topSlowQueries = recentMetrics
      .filter(m => m.duration > this.slowQueryThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    // Get recent optimization suggestions
    const optimizationSuggestions = Array.from(this.optimizationSuggestions.values())
      .filter(suggestion => suggestion.timestamp.getTime() > cutoff)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return {
      totalQueries,
      slowQueries,
      averageQueryTime: Math.round(averageQueryTime),
      errorRate: Math.round(errorRate * 100) / 100,
      topSlowQueries,
      optimizationSuggestions,
    };
  }

  /**
   * Get slow queries grouped by query pattern
   */
  getSlowQueriesByPattern(limit: number = 20): Array<{
    queryHash: string;
    query: string;
    count: number;
    averageDuration: number;
    maxDuration: number;
    lastSeen: Date;
  }> {
    const queryGroups = new Map<string, QueryMetric[]>();

    // Group queries by hash
    for (const metric of this.queryMetrics.values()) {
      if (metric.duration > this.slowQueryThreshold) {
        const existing = queryGroups.get(metric.queryHash) || [];
        existing.push(metric);
        queryGroups.set(metric.queryHash, existing);
      }
    }

    // Calculate statistics for each group
    const results = Array.from(queryGroups.entries()).map(([queryHash, metrics]) => {
      const durations = metrics.map(m => m.duration);
      const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const lastSeen = new Date(Math.max(...metrics.map(m => m.timestamp.getTime())));

      return {
        queryHash,
        query: metrics[0].query,
        count: metrics.length,
        averageDuration: Math.round(averageDuration),
        maxDuration: Math.round(maxDuration),
        lastSeen,
      };
    });

    return results
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, limit);
  }

  /**
   * Get optimization suggestions
   */
  getOptimizationSuggestions(): QueryOptimizationSuggestion[] {
    return Array.from(this.optimizationSuggestions.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Analyze a slow query and generate optimization suggestions
   */
  private analyzeSlowQuery(queryMetric: QueryMetric): void {
    const suggestions: Omit<QueryOptimizationSuggestion, 'id' | 'timestamp'>[] = [];
    const query = queryMetric.query.toLowerCase();

    // Check for missing WHERE clauses in SELECT statements
    if (query.includes('select') && !query.includes('where') && !query.includes('limit')) {
      suggestions.push({
        queryHash: queryMetric.queryHash,
        query: queryMetric.query,
        issue: 'Full table scan detected',
        suggestion: 'Add WHERE clause to filter results or use LIMIT to restrict result set',
        severity: 'high',
        estimatedImprovement: '50-90% faster execution',
      });
    }

    // Check for SELECT * usage
    if (query.includes('select *')) {
      suggestions.push({
        queryHash: queryMetric.queryHash,
        query: queryMetric.query,
        issue: 'SELECT * detected',
        suggestion: 'Select only required columns to reduce data transfer and improve performance',
        severity: 'medium',
        estimatedImprovement: '10-30% faster execution',
      });
    }

    // Check for N+1 query patterns (multiple similar queries)
    const similarQueries = Array.from(this.queryMetrics.values())
      .filter(m => 
        m.queryHash === queryMetric.queryHash && 
        Math.abs(m.timestamp.getTime() - queryMetric.timestamp.getTime()) < 5000 // Within 5 seconds
      );

    if (similarQueries.length > 5) {
      suggestions.push({
        queryHash: queryMetric.queryHash,
        query: queryMetric.query,
        issue: 'Potential N+1 query pattern detected',
        suggestion: 'Consider using JOIN or batch loading to reduce the number of database queries',
        severity: 'high',
        estimatedImprovement: '70-95% faster execution',
      });
    }

    // Check for missing ORDER BY with LIMIT
    if (query.includes('limit') && !query.includes('order by')) {
      suggestions.push({
        queryHash: queryMetric.queryHash,
        query: queryMetric.query,
        issue: 'LIMIT without ORDER BY detected',
        suggestion: 'Add ORDER BY clause to ensure consistent results and enable index usage',
        severity: 'medium',
        estimatedImprovement: '20-50% faster execution',
      });
    }

    // Check for very slow queries that might need indexing
    if (queryMetric.duration > this.verySlowQueryThreshold) {
      suggestions.push({
        queryHash: queryMetric.queryHash,
        query: queryMetric.query,
        issue: 'Very slow query execution',
        suggestion: 'Consider adding database indexes on frequently queried columns or optimizing query structure',
        severity: 'high',
        estimatedImprovement: '60-90% faster execution',
      });
    }

    // Store unique suggestions
    suggestions.forEach(suggestion => {
      const suggestionId = this.hashQuery(`${suggestion.queryHash}_${suggestion.issue}`);
      if (!this.optimizationSuggestions.has(suggestionId)) {
        this.optimizationSuggestions.set(suggestionId, {
          id: suggestionId,
          timestamp: new Date(),
          ...suggestion,
        });
      }
    });
  }

  /**
   * Hash a query to create a consistent identifier
   */
  private hashQuery(query: string): string {
    // Normalize query by removing parameters and whitespace
    const normalized = query
      .replace(/\$\d+/g, '?') // Replace $1, $2, etc. with ?
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\d+/g, 'N') // Replace numbers with N
      .replace(/'[^']*'/g, "'?'") // Replace string literals
      .trim()
      .toLowerCase();

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Sanitize query for logging (remove sensitive data)
   */
  private sanitizeQuery(query: string): string {
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password='***'")
      .replace(/token\s*=\s*'[^']*'/gi, "token='***'")
      .replace(/secret\s*=\s*'[^']*'/gi, "secret='***'")
      .substring(0, 500); // Limit length
  }

  /**
   * Generate unique query ID
   */
  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up old metrics to prevent memory leaks
   */
  private cleanupOldMetrics(): void {
    if (this.queryMetrics.size > this.maxMetricsRetention) {
      const sortedMetrics = Array.from(this.queryMetrics.entries())
        .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());

      // Remove oldest 20% of metrics
      const toRemove = Math.floor(this.maxMetricsRetention * 0.2);
      for (let i = 0; i < toRemove; i++) {
        this.queryMetrics.delete(sortedMetrics[i][0]);
      }
    }

    // Clean up old optimization suggestions (keep for 7 days)
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    for (const [id, suggestion] of this.optimizationSuggestions.entries()) {
      if (suggestion.timestamp.getTime() < cutoff) {
        this.optimizationSuggestions.delete(id);
      }
    }
  }
}

// Export singleton instance
export const databaseMonitor = new DatabasePerformanceMonitor();