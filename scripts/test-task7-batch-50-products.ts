/**
 * Test Script for Task 7.3: Scale to 50 products
 * Tests batch synchronization with 50 products and monitors performance
 */

import { db } from '../src/lib/db';
import { masterProducts } from '../src/lib/db/master-catalog-schema';
import { desc, limit, eq } from 'drizzle-orm';
import { testBatchSync10Products, type BatchTestResult } from './test-task7-batch-10-products';

interface ScaleTestResult extends BatchTestResult {
  performance_metrics: {
    throughput_per_minute: number;
    concurrent_jobs_avg: number;
    queue_efficiency: number;
    error_rate: number;
    retry_rate: number;
  };
  scalability_assessment: {
    performance_degradation: number;
    resource_utilization: string;
    bottlenecks_identified: string[];
    scaling_recommendations: string[];
  };
}

async function testBatchSync50Products(): Promise<ScaleTestResult> {
  console.log('🧪 Task 7.3: Testing batch sync with 50 products\n');

  try {
    // Step 1: Select 50 products from master catalog
    console.log('1️⃣ Selecting 50 products from master catalog...');
    
    const products = await db
      .select({
        id: masterProducts.id,
        masterSku: masterProducts.masterSku,
        name: masterProducts.name,
        basePrice: masterProducts.basePrice,
        status: masterProducts.status,
      })
      .from(masterProducts)
      .where(eq(masterProducts.status, 'active'))
      .orderBy(desc(masterProducts.createdAt))
      .limit(50);

    if (products.length < 50) {
      throw new Error(`Only ${products.length} active products found, need at least 50`);
    }

    console.log(`   ✅ Selected ${products.length} products for scale test`);
    console.log(`   📊 Price range: ${Math.min(...products.map(p => parseFloat(p.basePrice)))} - ${Math.max(...products.map(p => parseFloat(p.basePrice)))}`);
    console.log('');

    // Step 2: Start batch sync with performance monitoring
    console.log('2️⃣ Starting large batch sync with performance monitoring...');
    const startTime = Date.now();
    
    const batchResponse = await fetch('http://localhost:3000/api/sync/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token', // Mock auth for testing
      },
      body: JSON.stringify({
        product_ids: products.map(p => p.id),
        platform: 'both', // Test both Shopee and TikTok
      }),
    });

    if (!batchResponse.ok) {
      throw new Error(`Batch sync API failed: ${batchResponse.status} ${batchResponse.statusText}`);
    }

    const batchData = await batchResponse.json();
    if (!batchData.success) {
      throw new Error(`Batch sync failed: ${batchData.error?.message || 'Unknown error'}`);
    }

    const batch_id = batchData.batch_id;
    console.log(`   ✅ Large batch sync started: ${batch_id}`);
    console.log(`   📋 Total jobs: ${batchData.total_jobs}`);
    console.log(`   ⏱️  Estimated duration: ${batchData.estimated_duration_minutes} minutes`);
    console.log('');

    // Step 3: Enhanced monitoring with performance metrics
    console.log('3️⃣ Monitoring batch progress with performance metrics...');
    let batchStatus: any = null;
    let pollCount = 0;
    const maxPolls = 120; // Maximum 10 minutes of polling (5s intervals)
    const performanceData: any[] = [];

    while (pollCount < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      pollCount++;

      try {
        // Get batch status
        const statusResponse = await fetch(`http://localhost:3000/api/sync/batch/status?batch_id=${batch_id}`);
        
        // Get queue stats
        const queueResponse = await fetch('http://localhost:3000/api/sync/queue/stats');
        
        if (statusResponse.ok && queueResponse.ok) {
          const statusData = await statusResponse.json();
          const queueData = await queueResponse.json();
          
          if (statusData.success && queueData.success) {
            batchStatus = statusData.data;
            const queueStats = queueData.data.queue_stats;
            
            // Collect performance data
            performanceData.push({
              timestamp: Date.now(),
              progress: batchStatus.progress_percentage,
              completed: batchStatus.completed,
              failed: batchStatus.failed,
              in_progress: batchStatus.in_progress,
              queued: batchStatus.pending,
              queue_active: queueStats.active,
              queue_waiting: queueStats.waiting,
              queue_total: queueStats.total,
            });
            
            console.log(`   📊 Progress: ${batchStatus.progress_percentage}% (${batchStatus.completed + batchStatus.failed}/${batchStatus.total_jobs})`);
            console.log(`   ✅ Completed: ${batchStatus.completed}, ❌ Failed: ${batchStatus.failed}, 🔄 Active: ${queueStats.active}, ⏳ Waiting: ${queueStats.waiting}`);
            
            if (batchStatus.is_complete) {
              console.log(`   🎉 Large batch completed with status: ${batchStatus.status}`);
              break;
            }
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Status check failed: ${error}`);
      }
    }

    if (pollCount >= maxPolls) {
      throw new Error('Large batch sync timeout - exceeded maximum polling time');
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    // Step 4: Calculate basic results
    console.log('\n4️⃣ Calculating scale test results...');
    
    const success_count = batchStatus.completed;
    const failure_count = batchStatus.failed;
    const success_rate = Math.round((success_count / batchStatus.total_jobs) * 100);
    const average_sync_time = totalDuration / batchStatus.total_jobs;
    
    console.log(`   ✅ Success count: ${success_count}`);
    console.log(`   ❌ Failure count: ${failure_count}`);
    console.log(`   📈 Success rate: ${success_rate}%`);
    console.log(`   ⏱️  Average sync time: ${Math.round(average_sync_time)}ms per product`);
    console.log(`   🕐 Total duration: ${Math.round(totalDuration / 1000)}s`);

    // Step 5: Calculate performance metrics
    console.log('\n5️⃣ Analyzing performance metrics...');
    
    const throughput_per_minute = (success_count / (totalDuration / 60000));
    const concurrent_jobs_avg = performanceData.reduce((sum, data) => sum + data.queue_active, 0) / performanceData.length;
    const queue_efficiency = Math.round((success_count / batchStatus.total_jobs) * 100);
    const error_rate = Math.round((failure_count / batchStatus.total_jobs) * 100);
    const retry_rate = 0; // Would need to calculate from retry logs
    
    console.log(`   🚀 Throughput: ${throughput_per_minute.toFixed(2)} products/minute`);
    console.log(`   🔄 Avg concurrent jobs: ${concurrent_jobs_avg.toFixed(1)}`);
    console.log(`   ⚡ Queue efficiency: ${queue_efficiency}%`);
    console.log(`   ❌ Error rate: ${error_rate}%`);

    // Step 6: Scalability assessment
    console.log('\n6️⃣ Performing scalability assessment...');
    
    // Compare with 10-product baseline (if available)
    const performance_degradation = 0; // Would calculate if we had baseline
    const resource_utilization = concurrent_jobs_avg > 4 ? 'HIGH' : concurrent_jobs_avg > 2 ? 'MEDIUM' : 'LOW';
    
    const bottlenecks_identified: string[] = [];
    if (concurrent_jobs_avg < 3) bottlenecks_identified.push('Low concurrency utilization');
    if (error_rate > 5) bottlenecks_identified.push('High error rate');
    if (throughput_per_minute < 10) bottlenecks_identified.push('Low throughput');
    
    const scaling_recommendations: string[] = [];
    if (concurrent_jobs_avg < 3) scaling_recommendations.push('Increase worker concurrency');
    if (error_rate > 2) scaling_recommendations.push('Improve error handling');
    if (throughput_per_minute < 15) scaling_recommendations.push('Optimize sync operations');

    console.log(`   📉 Performance degradation: ${performance_degradation}%`);
    console.log(`   💾 Resource utilization: ${resource_utilization}`);
    console.log(`   🔍 Bottlenecks: ${bottlenecks_identified.length > 0 ? bottlenecks_identified.join(', ') : 'None identified'}`);

    // Step 7: Collect error information
    const errors: string[] = [];
    if (batchStatus.error_summary && batchStatus.error_summary.total_errors > 0) {
      Object.entries(batchStatus.error_summary.error_types).forEach(([errorType, count]) => {
        errors.push(`${errorType}: ${count} occurrences`);
      });
    }

    const result: ScaleTestResult = {
      batch_id,
      total_products: batchStatus.total_jobs,
      success_count,
      failure_count,
      success_rate,
      average_sync_time: Math.round(average_sync_time),
      total_duration: Math.round(totalDuration / 1000),
      errors,
      performance_metrics: {
        throughput_per_minute: Math.round(throughput_per_minute * 100) / 100,
        concurrent_jobs_avg: Math.round(concurrent_jobs_avg * 10) / 10,
        queue_efficiency,
        error_rate,
        retry_rate,
      },
      scalability_assessment: {
        performance_degradation,
        resource_utilization,
        bottlenecks_identified,
        scaling_recommendations,
      },
    };

    // Step 8: Display comprehensive results
    console.log('\n🎯 SCALE TEST RESULTS (50 PRODUCTS):');
    console.log('='.repeat(60));
    console.log(`Batch ID: ${result.batch_id}`);
    console.log(`Total Products: ${result.total_products}`);
    console.log(`Success Count: ${result.success_count}`);
    console.log(`Failure Count: ${result.failure_count}`);
    console.log(`Success Rate: ${result.success_rate}%`);
    console.log(`Total Duration: ${result.total_duration}s`);
    console.log('');
    console.log('📊 PERFORMANCE METRICS:');
    console.log(`   Throughput: ${result.performance_metrics.throughput_per_minute} products/min`);
    console.log(`   Avg Concurrent Jobs: ${result.performance_metrics.concurrent_jobs_avg}`);
    console.log(`   Queue Efficiency: ${result.performance_metrics.queue_efficiency}%`);
    console.log(`   Error Rate: ${result.performance_metrics.error_rate}%`);
    console.log('');
    console.log('🔍 SCALABILITY ASSESSMENT:');
    console.log(`   Resource Utilization: ${result.scalability_assessment.resource_utilization}`);
    console.log(`   Bottlenecks: ${result.scalability_assessment.bottlenecks_identified.length > 0 ? result.scalability_assessment.bottlenecks_identified.join(', ') : 'None'}`);
    console.log(`   Recommendations: ${result.scalability_assessment.scaling_recommendations.length > 0 ? result.scalability_assessment.scaling_recommendations.join(', ') : 'None'}`);

    if (result.errors.length > 0) {
      console.log('\n⚠️  ERRORS:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    // Step 9: Verify success criteria for scale test
    console.log('\n📋 SCALE TEST SUCCESS CRITERIA:');
    const targetSuccessRate = 100; // 100% success rate required
    const maxAvgSyncTime = 30000; // 30 seconds max per product
    const minThroughput = 10; // 10 products per minute minimum
    
    const successRatePass = result.success_rate >= targetSuccessRate;
    const syncTimePass = result.average_sync_time <= maxAvgSyncTime;
    const throughputPass = result.performance_metrics.throughput_per_minute >= minThroughput;
    
    console.log(`✅ Success Rate >= ${targetSuccessRate}%: ${successRatePass ? 'PASS' : 'FAIL'} (${result.success_rate}%)`);
    console.log(`✅ Avg Sync Time <= ${maxAvgSyncTime}ms: ${syncTimePass ? 'PASS' : 'FAIL'} (${result.average_sync_time}ms)`);
    console.log(`✅ Throughput >= ${minThroughput}/min: ${throughputPass ? 'PASS' : 'FAIL'} (${result.performance_metrics.throughput_per_minute}/min)`);
    
    const overallPass = successRatePass && syncTimePass && throughputPass;
    console.log(`\n🎯 OVERALL SCALE TEST: ${overallPass ? '✅ PASS' : '❌ FAIL'}`);

    if (overallPass) {
      console.log('\n🎉 Task 7.3: Scale to 50 products - SUCCESS!');
      console.log('System demonstrates good scalability and performance');
    } else {
      console.log('\n⚠️  Task 7.3: Scale to 50 products - PERFORMANCE ISSUES');
      console.log('Review bottlenecks and optimize before production deployment');
    }

    return result;

  } catch (error) {
    console.error('❌ Scale test failed:', error);
    throw error;
  }
}

// Export for use in other scripts
export { testBatchSync50Products, type ScaleTestResult };

// Run if called directly
if (require.main === module) {
  testBatchSync50Products()
    .then(() => {
      console.log('\n✅ Scale test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Scale test failed:', error);
      process.exit(1);
    });
}