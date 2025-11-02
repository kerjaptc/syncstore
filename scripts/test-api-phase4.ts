#!/usr/bin/env tsx

/**
 * API Integration Tests for Phase 4
 * 
 * Tests all API endpoints with real data
 * 
 * Usage:
 *   npm run test:api-phase4
 *   tsx scripts/test-api-phase4.ts
 */

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

function log(message: string, level: 'INFO' | 'SUCCESS' | 'ERROR' | 'WARN' = 'INFO'): void {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const prefix = level === 'SUCCESS' ? '✅' : level === 'ERROR' ? '❌' : level === 'WARN' ? '⚠️' : '📋';
  console.log(`[${timestamp}] [${level}] ${prefix} ${message}`);
}

async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = `${baseUrl}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  const data = await response.json();
  return { ...data, statusCode: response.status };
}

async function testProductsAPI(): Promise<void> {
  log('Testing GET /api/products-phase4...');
  
  const startTime = Date.now();
  let passed = false;
  let error: string | undefined;
  
  try {
    const response = await apiRequest('/api/products-phase4');
    const duration = Date.now() - startTime;
    
    // Check response structure
    if (!response.success) {
      throw new Error(`API returned success: false - ${response.error?.message || 'Unknown error'}`);
    }
    
    if (!Array.isArray(response.data)) {
      throw new Error('Response data is not an array');
    }
    
    if (response.data.length < 10) {
      throw new Error(`Expected at least 10 products, got ${response.data.length}`);
    }
    
    // Check product structure
    const firstProduct = response.data[0];
    const requiredFields = ['id', 'sku', 'name', 'price', 'stock'];
    for (const field of requiredFields) {
      if (!(field in firstProduct)) {
        throw new Error(`Product missing required field: ${field}`);
      }
    }
    
    // Check pagination metadata
    if (!response.meta?.pagination) {
      throw new Error('Response missing pagination metadata');
    }
    
    passed = true;
    log(`✓ Products API returned ${response.data.length} products`, 'SUCCESS');
    log(`✓ Response time: ${duration}ms`, duration > 1000 ? 'WARN' : 'SUCCESS');
    
    // Test pagination
    const page2Response = await apiRequest('/api/products-phase4?page=2&limit=5');
    if (page2Response.success && page2Response.meta.pagination.page === 2) {
      log('✓ Pagination works correctly', 'SUCCESS');
    }
    
    // Test search
    const searchTerm = firstProduct.name.substring(0, 5);
    const searchResponse = await apiRequest(`/api/products-phase4?search=${encodeURIComponent(searchTerm)}`);
    if (searchResponse.success && searchResponse.data.length > 0) {
      log(`✓ Search works correctly (found ${searchResponse.data.length} results for "${searchTerm}")`, 'SUCCESS');
    }
    
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    log(`✗ Products API test failed: ${error}`, 'ERROR');
  }
  
  results.push({
    name: 'GET /api/products-phase4',
    passed,
    duration: Date.now() - startTime,
    error,
  });
}

async function testInventoryAPI(): Promise<void> {
  log('Testing GET /api/inventory-phase4...');
  
  const startTime = Date.now();
  let passed = false;
  let error: string | undefined;
  
  try {
    const response = await apiRequest('/api/inventory-phase4');
    const duration = Date.now() - startTime;
    
    if (!response.success) {
      throw new Error(`API returned success: false - ${response.error?.message || 'Unknown error'}`);
    }
    
    if (!Array.isArray(response.data)) {
      throw new Error('Response data is not an array');
    }
    
    if (response.data.length === 0) {
      throw new Error('No inventory items found');
    }
    
    // Check inventory structure
    const firstItem = response.data[0];
    const requiredFields = ['id', 'productName', 'stock', 'available'];
    for (const field of requiredFields) {
      if (!(field in firstItem)) {
        throw new Error(`Inventory item missing required field: ${field}`);
      }
    }
    
    // Check summary
    if (!response.summary) {
      throw new Error('Response missing summary');
    }
    
    passed = true;
    log(`✓ Inventory API returned ${response.data.length} items`, 'SUCCESS');
    log(`✓ Summary: ${response.summary.totalItems} total, ${response.summary.lowStockItems} low stock`, 'SUCCESS');
    log(`✓ Response time: ${duration}ms`, duration > 1000 ? 'WARN' : 'SUCCESS');
    
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    log(`✗ Inventory API test failed: ${error}`, 'ERROR');
  }
  
  results.push({
    name: 'GET /api/inventory-phase4',
    passed,
    duration: Date.now() - startTime,
    error,
  });
}

async function testSyncAPI(): Promise<void> {
  log('Testing Sync API endpoints...');
  
  const startTime = Date.now();
  let passed = false;
  let error: string | undefined;
  
  try {
    // First, get products to sync
    const productsResponse = await apiRequest('/api/products-phase4?limit=3');
    if (!productsResponse.success || !productsResponse.data?.length) {
      throw new Error('Could not get products for sync test');
    }
    
    const productIds = productsResponse.data.slice(0, 3).map((p: any) => p.id);
    log(`Testing sync with ${productIds.length} products...`);
    
    // Test: Start sync
    const startResponse = await apiRequest('/api/sync-phase4/start', {
      method: 'POST',
      body: JSON.stringify({
        productIds,
        platforms: ['shopee', 'tiktok'],
      }),
    });
    
    if (!startResponse.success) {
      throw new Error(`Failed to start sync: ${startResponse.error?.message || 'Unknown error'}`);
    }
    
    const syncId = startResponse.data.syncId;
    if (!syncId) {
      throw new Error('Sync ID not returned');
    }
    
    log(`✓ Sync started with ID: ${syncId}`, 'SUCCESS');
    
    // Test: Get sync status
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
    
    const statusResponse = await apiRequest(`/api/sync-phase4/status?sync_id=${syncId}`);
    if (!statusResponse.success) {
      throw new Error(`Failed to get sync status: ${statusResponse.error?.message || 'Unknown error'}`);
    }
    
    log(`✓ Sync status: ${statusResponse.data.status} (${statusResponse.data.progress.percentage}%)`, 'SUCCESS');
    
    // Test: Get sync logs
    const logsResponse = await apiRequest(`/api/sync-phase4/logs?sync_id=${syncId}`);
    if (!logsResponse.success) {
      throw new Error(`Failed to get sync logs: ${logsResponse.error?.message || 'Unknown error'}`);
    }
    
    log(`✓ Sync logs retrieved: ${logsResponse.data.logs.length} entries`, 'SUCCESS');
    
    // Wait for sync to complete or timeout
    let finalStatus = statusResponse.data.status;
    let attempts = 0;
    while (['queued', 'running'].includes(finalStatus) && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const checkResponse = await apiRequest(`/api/sync-phase4/status?sync_id=${syncId}`);
      if (checkResponse.success) {
        finalStatus = checkResponse.data.status;
        log(`  Progress: ${checkResponse.data.progress.percentage}%`);
      }
      attempts++;
    }
    
    log(`✓ Sync completed with status: ${finalStatus}`, 'SUCCESS');
    
    // Test: Cancel sync (if still running)
    if (finalStatus === 'running') {
      const cancelResponse = await apiRequest('/api/sync-phase4/cancel', {
        method: 'POST',
        body: JSON.stringify({ sync_id: syncId }),
      });
      
      if (cancelResponse.success) {
        log('✓ Sync cancelled successfully', 'SUCCESS');
      }
    }
    
    passed = true;
    
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    log(`✗ Sync API test failed: ${error}`, 'ERROR');
  }
  
  results.push({
    name: 'Sync API endpoints',
    passed,
    duration: Date.now() - startTime,
    error,
  });
}

async function testErrorHandling(): Promise<void> {
  log('Testing error handling...');
  
  const startTime = Date.now();
  let passed = false;
  let error: string | undefined;
  
  try {
    // Test 404 for invalid sync ID
    const invalidSyncResponse = await apiRequest('/api/sync-phase4/status?sync_id=invalid-id');
    if (invalidSyncResponse.statusCode !== 404) {
      throw new Error(`Expected 404 for invalid sync ID, got ${invalidSyncResponse.statusCode}`);
    }
    log('✓ Returns 404 for invalid sync ID', 'SUCCESS');
    
    // Test 400 for missing parameters
    const missingParamResponse = await apiRequest('/api/sync-phase4/status');
    if (missingParamResponse.statusCode !== 400) {
      throw new Error(`Expected 400 for missing parameter, got ${missingParamResponse.statusCode}`);
    }
    log('✓ Returns 400 for missing parameters', 'SUCCESS');
    
    // Test 400 for invalid sync start
    const badSyncResponse = await apiRequest('/api/sync-phase4/start', {
      method: 'POST',
      body: JSON.stringify({ invalid: 'data' }),
    });
    if (badSyncResponse.statusCode !== 400) {
      throw new Error(`Expected 400 for invalid sync data, got ${badSyncResponse.statusCode}`);
    }
    log('✓ Returns 400 for invalid request data', 'SUCCESS');
    
    passed = true;
    
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    log(`✗ Error handling test failed: ${error}`, 'ERROR');
  }
  
  results.push({
    name: 'Error handling',
    passed,
    duration: Date.now() - startTime,
    error,
  });
}

async function main() {
  log('🧪 Starting API Integration Tests for Phase 4...');
  log('');
  
  await testProductsAPI();
  log('');
  
  await testInventoryAPI();
  log('');
  
  await testSyncAPI();
  log('');
  
  await testErrorHandling();
  log('');
  
  // Summary
  log('📊 Test Summary:');
  log(`   Total Tests: ${results.length}`);
  log(`   Passed: ${results.filter(r => r.passed).length}`);
  log(`   Failed: ${results.filter(r => !r.passed).length}`);
  log(`   Total Duration: ${results.reduce((sum, r) => sum + r.duration, 0)}ms`);
  log('');
  
  if (results.every(r => r.passed)) {
    log('🎉 All tests passed!', 'SUCCESS');
    process.exit(0);
  } else {
    log('❌ Some tests failed:', 'ERROR');
    results.filter(r => !r.passed).forEach(r => {
      log(`   - ${r.name}: ${r.error}`, 'ERROR');
    });
    process.exit(1);
  }
}

main().catch(error => {
  log(`Fatal error: ${error}`, 'ERROR');
  process.exit(1);
});
