/**
 * Memory Optimizer
 * Helps identify and fix memory usage issues
 */

export class MemoryOptimizer {
  private static instance: MemoryOptimizer;
  private memoryCheckInterval?: NodeJS.Timeout;
  private lastMemoryUsage: NodeJS.MemoryUsage | null = null;

  static getInstance(): MemoryOptimizer {
    if (!MemoryOptimizer.instance) {
      MemoryOptimizer.instance = new MemoryOptimizer();
    }
    return MemoryOptimizer.instance;
  }

  /**
   * Start monitoring memory usage
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }

    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, intervalMs);

    console.log('🔍 Memory monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = undefined;
      console.log('🔍 Memory monitoring stopped');
    }
  }

  /**
   * Check current memory usage and provide recommendations
   */
  checkMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    const memoryPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    // Log memory usage
    console.log(`📊 Memory Usage: ${Math.round(memoryPercentage)}% (${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB)`);

    // Check for memory issues
    if (memoryPercentage > 90) {
      console.warn('⚠️  HIGH MEMORY USAGE DETECTED!');
      this.provideOptimizationTips();
      this.forceGarbageCollection();
    } else if (memoryPercentage > 70) {
      console.warn('⚠️  Memory usage is getting high');
    }

    // Check for memory leaks
    if (this.lastMemoryUsage) {
      const heapGrowth = memUsage.heapUsed - this.lastMemoryUsage.heapUsed;
      if (heapGrowth > 50 * 1024 * 1024) { // 50MB growth
        console.warn('⚠️  Potential memory leak detected - heap grew by', Math.round(heapGrowth / 1024 / 1024), 'MB');
      }
    }

    this.lastMemoryUsage = memUsage;
  }

  /**
   * Provide optimization tips
   */
  private provideOptimizationTips(): void {
    console.log('\n🔧 MEMORY OPTIMIZATION TIPS:');
    console.log('1. Disable monitoring in development:');
    console.log('   export DISABLE_MONITORING=true');
    console.log('');
    console.log('2. Reduce monitoring intervals:');
    console.log('   - Performance monitoring: every 1 minute instead of 30 seconds');
    console.log('   - Job queue processing: every 1 second instead of 100ms');
    console.log('');
    console.log('3. Clear old data more frequently:');
    console.log('   - Metrics cleanup: every 5 minutes instead of 1 hour');
    console.log('   - Keep only 10 minutes of data instead of 24 hours');
    console.log('');
    console.log('4. Restart the development server to clear accumulated data');
    console.log('');
  }

  /**
   * Force garbage collection if available
   */
  private forceGarbageCollection(): void {
    if (global.gc) {
      console.log('🗑️  Running garbage collection...');
      global.gc();
      
      // Check memory after GC
      setTimeout(() => {
        const memUsage = process.memoryUsage();
        const memoryPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        console.log(`📊 Memory after GC: ${Math.round(memoryPercentage)}% (${Math.round(memUsage.heapUsed / 1024 / 1024)}MB)`);
      }, 1000);
    } else {
      console.log('💡 To enable garbage collection, start with: node --expose-gc');
    }
  }

  /**
   * Get memory usage summary
   */
  getMemorySummary(): {
    usage: NodeJS.MemoryUsage;
    percentage: number;
    recommendations: string[];
  } {
    const memUsage = process.memoryUsage();
    const memoryPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    const recommendations: string[] = [];
    
    if (memoryPercentage > 80) {
      recommendations.push('Disable development monitoring');
      recommendations.push('Restart development server');
      recommendations.push('Reduce monitoring intervals');
    }
    
    if (memoryPercentage > 60) {
      recommendations.push('Clear old metrics more frequently');
      recommendations.push('Reduce data retention period');
    }

    return {
      usage: memUsage,
      percentage: memoryPercentage,
      recommendations,
    };
  }

  /**
   * Emergency memory cleanup
   */
  emergencyCleanup(): void {
    console.log('🚨 Running emergency memory cleanup...');
    
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
    
    // Clear any global caches if they exist
    // This would be implemented based on your specific caching mechanisms
    
    console.log('✅ Emergency cleanup completed');
  }
}

// Export singleton instance
export const memoryOptimizer = MemoryOptimizer.getInstance();

// Auto-start monitoring in development
if (process.env.NODE_ENV === 'development') {
  memoryOptimizer.startMonitoring(60000); // Check every minute
}