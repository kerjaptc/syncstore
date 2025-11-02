/**
 * API Endpoints Integration Test
 * Tests all Phase 4 API endpoints with real data
 * 
 * Run: npx tsx scripts/test-api-endpoints.ts
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

/**
 * Log test results with formatting
 */
function logTest(name: string, passed: boolean, duration: number, error?: string, details?: any): void {
  const status = passed ? '✓' : '✗';
  const color = passed ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';
  
  console.log(`${color}${status}${reset} ${name} (${duration}ms)`);
  
  if (error) {
    console.log(`  Error: ${error}`);
  }
  
  if (details) {
    console.log(`  Details:`, JSON.stringify(details, null, 2));
  }
  
  results.push({ name, passed, duration, error, details });
}

/**
 * Make API request with error handling
 */
async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: any; error?: string; status: number }> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    const duration = Date.now() - startTime;
    const data = await response.json();
    
    return {
      success: response.ok,
      data,
      status: response.status,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 0,
    };
  }
}

/**
 * Test: GET /api/products returns real data
 */
async function testProductsEndpoint(): Promise<void> {
  console.log('\n📦 Testing Products API...\n');
  
  const startTime = Date.now();
  const response = await apiRequest('/api/products/phase4');
  const duration = Date.now() - startTime;
  
  const passed = 
    response.success &&
    response.data?.success === true &&
    Array.isArray(response.data?.data) &&
    response.data.data.length > 0;
  
  logTest(
    'GET /api/products returns real data',
    passed,
    duration,
    passed ? undefined : 'No products returned or invalid response',
    { 
      productCount: response.data?.data?.length || 0,
      hasPagination: !!response.data?.pagination
    }
  );
  
  // Test pagination
  if (passed) {
    const page2Response = await apiRequest('/api/products/phase4?page=2&limit=5');
    const page2Duration = Date.now() - startTime;
    
    const paginationPassed = 
      page2Response.success &&
      page2Response.data?.pagination?.page === 2;
    
    logTest(
      'GET /api/products pagination works',
      paginationPassed,
      page2Duration,
      paginationPassed ? undefined : 'Pagination not working correctly',
      { page: page2Response.data?.pagination?.page }
    );
  }
  
  // Test search
  if (passed && response.data.data.length > 0) {
    const firstProduct = response.data.data[0];
    const searchTerm = firstProduct.name.substring(0, 5);
    
    const searchResponse = await apiRequest(`/api/products/phase4?search=${encodeURIComponent(searchTerm)}`);
    const searchDuration = Date.now() - startTime;
    
    const searchPassed = 
      searchResponse.success &&
      Array.isArray(searchResponse.data?.data) &&
      searchResponse.data.data.length > 0;
    
    logTest(
      'GET /api/products search filter works',
      searchPassed,
      searchDuration,
      searchPassed ? undefined : 'Search not returning results',
      { searchTerm, resultCount: searchResponse.data?.data?.length || 0 }
    );
  }
}

/**
 * Test: GET /api/inventory returns real-time stock
 */
async function testInventoryEndpoint(): Promise<void> {
  console.log('\n📊 Testing Inventory API...\n');
  
  const startTime = Date.now();
  const response = await apiRequest('/api/inventory/phase4');
  const duration = Date.now() - startTime;
  
  const passed = 
    response.success &&
    response.data?.success === true &&
    Array.isArray(response.data?.data);
  
  logTest(
    'GET /api/inventory returns data',
    passed,
    duration,
    passed ? undefined : 'Inventory endpoint failed',
    { 
      itemCount: response.data?.data?.length || 0,
      hasPagination: !!response.data?.pagination
    }
  );
  
  // Test inventory summary
  const summaryResponse = await apiRequest('/api/inventory/phase4', { method: 'POST' });
  const summaryDuration = Date.now() - startTime;
  
  const summaryPassed = 
    summaryResponse.success &&
    summaryResponse.data?.success === true &&
    summaryResponse.data?.data?.totalItems !== undefined;
  
  logTest(
    'POST /api/inventory (summary) returns statistics',
    summaryPassed,
    summaryDuration,
    summaryPassed ? undefined : 'Inventory summary failed',
    summaryResponse.data?.data
  );
}

/**
 * Test: Sync API endpoints
 */
async function testSyncEndpoints(): Promise<void> {
  console.log('\n🔄 Testing Sync API...\n');
  
  // First, get products to sync
  const productsResponse = await apiRequest('/api/products/phase4?limit=3');
  
  if (!productsResponse.success || !productsResponse.data?.data?.length) {
    logTest(
      'Sync API tests',
      false,
      0,
      'Cannot test sync API: no products available'
    );
    return;
  }
  
  const productIds = productsResponse.data.data.slice(0, 2).map((p: any) => p.id);
  
  // Test: Start sync
  const startTime = Date.now();
  const startResponse = await apiRequest('/api/sync/phase4', {
    method: 'POST',
    body: JSON.stringify({
      type: 'partial',
      productIds,
      platforms: ['shopee', 'tiktokshop'],
      options: {
        updatePrices: true,
        updateStock: true,
        dryRun: false
      }
    }),
  });
  const startDuration = Date.now() - startTime;
  
  const startPassed = 
    startResponse.success &&
    startResponse.data?.success === true &&
    startResponse.data?.data?.syncJobId;
  
  logTest(
    'POST /api/sync/start creates sync operation',
    startPassed,
    startDuration,
    startPassed ? undefined : 'Failed to start sync',
    { syncJobId: startResponse.data?.data?.syncJobId }
  );
  
  if (!startPassed) {
    return;
  }
  
  const syncJobId = startResponse.data.data.syncJobId;
  
  // Wait a bit for sync to process
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test: Get sync status
  const statusResponse = await apiRequest(`/api/sync/phase4?sync_id=${syncJobId}`);
  const statusDuration = Date.now() - startTime;
  
  const statusPassed = 
    statusResponse.success &&
    statusResponse.data?.success === true &&
    statusResponse.data?.data?.id === syncJobId;
  
  logTest(
    'GET /api/sync/status returns accurate progress',
    statusPassed,
    statusDuration,
    statusPassed ? undefined : 'Failed to get sync status',
    {
      status: statusResponse.data?.data?.status,
      progress: statusResponse.data?.data?.progress
    }
  );
  
  // Test: Verify logs are included in status response
  const logsIncluded = 
    statusPassed &&
    statusResponse.data?.data?.logsCount !== undefined;
  
  logTest(
    'Sync status includes logs count',
    logsIncluded,
    statusDuration,
    logsIncluded ? undefined : 'Logs count not included in status',
    { logsCount: statusResponse.data?.data?.logsCount || 0 }
  );
  
  // Skip "get all sync jobs" test for Phase 4 (not implemented yet)
  
  // Wait for sync to complete or timeout
  let attempts = 0;
  const maxAttempts = 10;
  let finalStatus = statusResponse.data?.data?.status;
  
  while (attempts < maxAttempts && finalStatus !== 'completed' && finalStatus !== 'completed_with_errors' && finalStatus !== 'failed') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const checkResponse = await apiRequest(`/api/sync/phase4?sync_id=${syncJobId}`);
    if (checkResponse.success && checkResponse.data?.data?.status) {
      finalStatus = checkResponse.data.data.status;
    }
    
    attempts++;
  }
  
  // Test: Cancel sync (if still running)
  if (finalStatus === 'running' || finalStatus === 'queued') {
    const cancelResponse = await apiRequest(`/api/sync/phase4?sync_id=${syncJobId}`, {
      method: 'DELETE',
    });
    const cancelDuration = Date.now() - startTime;
    
    const cancelPassed = 
      cancelResponse.success &&
      cancelResponse.data?.success === true;
    
    logTest(
      'DELETE /api/sync/phase4 (cancel) stops operation',
      cancelPassed,
      cancelDuration,
      cancelPassed ? undefined : 'Failed to cancel sync'
    );
  }
}

/**
 * Test: Error responses
 */
async function testErrorResponses(): Promise<void> {
  console.log('\n⚠️  Testing Error Handling...\n');
  
  // Test 404 for invalid sync job
  const startTime = Date.now();
  const invalidSyncResponse = await apiRequest('/api/sync/phase4?sync_id=invalid-id');
  const duration = Date.now() - startTime;
  
  const passed404 = 
    !invalidSyncResponse.success &&
    invalidSyncResponse.status === 404;
  
  logTest(
    'API returns 404 for not found resources',
    passed404,
    duration,
    passed404 ? undefined : 'Expected 404 status code'
  );
  
  // Test 400 for bad request
  const badRequestResponse = await apiRequest('/api/sync/phase4', {
    method: 'POST',
    body: JSON.stringify({ invalid: 'data' }),
  });
  const badRequestDuration = Date.now() - startTime;
  
  const passed400 = 
    !badRequestResponse.success &&
    (badRequestResponse.status === 400 || badRequestResponse.status === 500);
  
  logTest(
    'API returns 400/500 for invalid requests',
    passed400,
    badRequestDuration,
    passed400 ? undefined : 'Expected 400 or 500 status code'
  );
}

/**
 * Print summary
 */
function printSummary(): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60) + '\n');
  
  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  const successRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0.0';
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✓ Passed: ${passedTests}`);
  console.log(`✗ Failed: ${failedTests}`);
  console.log(`Success Rate: ${successRate}%`);
  
  const avgDuration = totalTests > 0 
    ? (results.reduce((sum, r) => sum + r.duration, 0) / totalTests).toFixed(0)
    : '0';
  
  console.log(`Average Duration: ${avgDuration}ms`);
  
  if (failedTests > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}`);
      if (r.error) {
        console.log(`    Error: ${r.error}`);
      }
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Exit with error code if tests failed
  if (failedTests > 0) {
    process.exit(1);
  }
}

/**
 * Main test runner
 */
async function runTests(): Promise<void> {
  console.log('🚀 Starting API Endpoints Integration Tests...');
  console.log(`API Base URL: ${API_BASE_URL}\n`);
  
  try {
    await testProductsEndpoint();
    await testInventoryEndpoint();
    await testSyncEndpoints();
    await testErrorResponses();
    
    printSummary();
  } catch (error) {
    console.error('\n❌ Test suite failed with error:', error);
    process.exit(1);
  }
}

// Run tests
runTests();
