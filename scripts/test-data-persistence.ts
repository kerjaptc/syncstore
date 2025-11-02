#!/usr/bin/env tsx

/**
 * Data Persistence Test Script for SyncStore Phase 4
 * 
 * This script tests the data persistence layer to ensure:
 * - Database connection works
 * - Data persists across operations
 * - CRUD operations function correctly
 * - Performance is acceptable
 * 
 * Usage:
 *   npm run test:persistence
 *   tsx scripts/test-data-persistence.ts
 */

import { checkDatabaseHealth, testDataPersistence, getProductCount } from '@/lib/db/products';

interface TestResult {
  testName: string;
  success: boolean;
  message: string;
  duration: number;
  details?: any;
}

/**
 * Log with timestamp and level
 */
function log(message: string, level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' = 'INFO'): void {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const emoji = {
    INFO: '📋',
    WARN: '⚠️',
    ERROR: '❌',
    SUCCESS: '✅'
  }[level];
  
  console.log(`[${timestamp}] [${level}] ${emoji} ${message}`);
}

/**
 * Run database health check test
 */
async function testDatabaseHealth(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    log('Testing database connection health...');
    
    const healthResult = await checkDatabaseHealth();
    const duration = Date.now() - startTime;
    
    if (healthResult.healthy) {
      return {
        testName: 'Database Health Check',
        success: true,
        message: `Database is healthy (${healthResult.responseTime}ms response time)`,
        duration,
        details: healthResult
      };
    } else {
      return {
        testName: 'Database Health Check',
        success: false,
        message: `Database is unhealthy: ${healthResult.error}`,
        duration,
        details: healthResult
      };
    }
  } catch (error) {
    return {
      testName: 'Database Health Check',
      success: false,
      message: `Health check failed: ${error}`,
      duration: Date.now() - startTime,
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

/**
 * Run data persistence test
 */
async function testDataPersistenceLayer(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    log('Testing data persistence (CRUD operations)...');
    
    const persistenceResult = await testDataPersistence();
    const duration = Date.now() - startTime;
    
    return {
      testName: 'Data Persistence',
      success: persistenceResult.success,
      message: persistenceResult.message,
      duration,
      details: persistenceResult.details
    };
  } catch (error) {
    return {
      testName: 'Data Persistence',
      success: false,
      message: `Persistence test failed: ${error}`,
      duration: Date.now() - startTime,
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

/**
 * Test product count functionality
 */
async function testProductCount(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    log('Testing product count functionality...');
    
    const count = await getProductCount();
    const duration = Date.now() - startTime;
    
    return {
      testName: 'Product Count',
      success: true,
      message: `Successfully retrieved product count: ${count} products`,
      duration,
      details: { count }
    };
  } catch (error) {
    return {
      testName: 'Product Count',
      success: false,
      message: `Product count test failed: ${error}`,
      duration: Date.now() - startTime,
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

/**
 * Performance benchmark test
 */
async function testPerformance(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    log('Running performance benchmark...');
    
    // Test multiple health checks
    const healthChecks = await Promise.all([
      checkDatabaseHealth(),
      checkDatabaseHealth(),
      checkDatabaseHealth()
    ]);
    
    const avgResponseTime = healthChecks.reduce((sum, check) => sum + check.responseTime, 0) / healthChecks.length;
    const duration = Date.now() - startTime;
    
    const performanceGood = avgResponseTime < 500; // Less than 500ms is good
    
    return {
      testName: 'Performance Benchmark',
      success: performanceGood,
      message: performanceGood 
        ? `Performance is good (avg ${avgResponseTime.toFixed(2)}ms)`
        : `Performance is slow (avg ${avgResponseTime.toFixed(2)}ms)`,
      duration,
      details: {
        averageResponseTime: avgResponseTime,
        individualTimes: healthChecks.map(h => h.responseTime),
        threshold: 500
      }
    };
  } catch (error) {
    return {
      testName: 'Performance Benchmark',
      success: false,
      message: `Performance test failed: ${error}`,
      duration: Date.now() - startTime,
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

/**
 * Main test runner
 */
async function runAllTests(): Promise<void> {
  log('🧪 Starting Data Persistence Layer Tests...');
  log('');
  
  const tests = [
    testDatabaseHealth,
    testDataPersistenceLayer,
    testProductCount,
    testPerformance
  ];
  
  const results: TestResult[] = [];
  let totalDuration = 0;
  
  for (const test of tests) {
    const result = await test();
    results.push(result);
    totalDuration += result.duration;
    
    if (result.success) {
      log(`${result.testName}: ${result.message}`, 'SUCCESS');
    } else {
      log(`${result.testName}: ${result.message}`, 'ERROR');
    }
    
    log(`  Duration: ${result.duration}ms`);
    log('');
  }
  
  // Summary
  const passedTests = results.filter(r => r.success).length;
  const totalTests = results.length;
  const allPassed = passedTests === totalTests;
  
  log('📊 Test Summary:');
  log(`  Total Tests: ${totalTests}`);
  log(`  Passed: ${passedTests}`);
  log(`  Failed: ${totalTests - passedTests}`);
  log(`  Total Duration: ${totalDuration}ms`);
  log('');
  
  if (allPassed) {
    log('🎉 All tests passed! Data persistence layer is working correctly.', 'SUCCESS');
  } else {
    log('💥 Some tests failed. Please check the errors above.', 'ERROR');
    
    // Show failed test details
    const failedTests = results.filter(r => !r.success);
    log('');
    log('Failed Test Details:');
    failedTests.forEach(test => {
      log(`  ${test.testName}: ${test.message}`, 'ERROR');
      if (test.details) {
        log(`    Details: ${JSON.stringify(test.details, null, 2)}`);
      }
    });
  }
  
  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

/**
 * Main execution
 */
async function main() {
  try {
    await runAllTests();
  } catch (error) {
    log(`💥 Fatal error during testing: ${error}`, 'ERROR');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { runAllTests };