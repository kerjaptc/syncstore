#!/usr/bin/env node

/**
 * Memory Usage Checker
 * Run this script to check current memory usage and get optimization tips
 */

const { memoryOptimizer } = require('../src/lib/monitoring/memory-optimizer');

console.log('🔍 Checking memory usage...\n');

// Get current memory summary
const summary = memoryOptimizer.getMemorySummary();

console.log('📊 MEMORY USAGE REPORT');
console.log('='.repeat(50));
console.log(`Heap Used: ${Math.round(summary.usage.heapUsed / 1024 / 1024)} MB`);
console.log(`Heap Total: ${Math.round(summary.usage.heapTotal / 1024 / 1024)} MB`);
console.log(`RSS: ${Math.round(summary.usage.rss / 1024 / 1024)} MB`);
console.log(`External: ${Math.round(summary.usage.external / 1024 / 1024)} MB`);
console.log(`Memory Percentage: ${Math.round(summary.percentage)}%`);

// Status indicator
if (summary.percentage > 90) {
  console.log('\n🚨 STATUS: CRITICAL - Immediate action required!');
} else if (summary.percentage > 70) {
  console.log('\n⚠️  STATUS: HIGH - Optimization recommended');
} else if (summary.percentage > 50) {
  console.log('\n⚡ STATUS: MODERATE - Monitor closely');
} else {
  console.log('\n✅ STATUS: GOOD - Memory usage is healthy');
}

// Recommendations
if (summary.recommendations.length > 0) {
  console.log('\n🔧 RECOMMENDATIONS:');
  summary.recommendations.forEach((rec, index) => {
    console.log(`${index + 1}. ${rec}`);
  });
}

// Quick fixes
console.log('\n🚀 QUICK FIXES:');
console.log('1. Restart development server: npm run dev');
console.log('2. Disable monitoring: export DISABLE_MONITORING=true');
console.log('3. Run with GC exposed: node --expose-gc');
console.log('4. Force garbage collection (if --expose-gc): global.gc()');

// Environment-specific tips
if (process.env.NODE_ENV === 'development') {
  console.log('\n💡 DEVELOPMENT MODE TIPS:');
  console.log('- Monitoring is automatically optimized for development');
  console.log('- Intervals are increased to reduce CPU/memory usage');
  console.log('- Data retention is reduced to 10 minutes');
  console.log('- Set DISABLE_MONITORING=true to disable completely');
}

console.log('\n' + '='.repeat(50));
console.log('Run this script anytime: node scripts/check-memory.js');