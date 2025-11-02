#!/usr/bin/env tsx

/**
 * Simple Data Persistence Test for SyncStore Phase 4
 * Tests basic CRUD operations and data persistence
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

/**
 * Log with timestamp
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
 * Test database health
 */
async function testDatabaseHealth(): Promise<boolean> {
  try {
    log('Testing database connection health...');
    const startTime = Date.now();
    
    const result = await sql`SELECT 1 as test, NOW() as timestamp`;
    const responseTime = Date.now() - startTime;
    
    if (result.length > 0) {
      log(`Database is healthy (${responseTime}ms response time)`, 'SUCCESS');
      return true;
    } else {
      log('Database health check failed - no response', 'ERROR');
      return false;
    }
  } catch (error) {
    log(`Database health check failed: ${error}`, 'ERROR');
    return false;
  }
}

/**
 * Test data persistence
 */
async function testDataPersistence(): Promise<boolean> {
  try {
    log('Testing data persistence (CRUD operations)...');
    
    // Get organization
    const orgs = await sql`SELECT id FROM organizations LIMIT 1`;
    if (orgs.length === 0) {
      log('No organization found', 'ERROR');
      return false;
    }
    const organizationId = orgs[0].id;
    
    // Test 1: Count existing products
    const beforeCount = await sql`SELECT COUNT(*) as count FROM products WHERE organization_id = ${organizationId}`;
    log(`Products before test: ${beforeCount[0].count}`);
    
    // Test 2: Create a test product
    const testProductId = crypto.randomUUID();
    const testSku = `TEST-PERSIST-${Date.now()}`;
    
    await sql`
      INSERT INTO products (
        id, organization_id, sku, name, description, category, brand,
        cost_price, weight, dimensions, images, attributes, is_active,
        created_at, updated_at
      ) VALUES (
        ${testProductId}, ${organizationId}, ${testSku}, 'Test Persistence Product',
        'This product tests data persistence', 'Test', 'TestBrand',
        '10.00', '100.0',
        '{"length": 10, "width": 5, "height": 2}',
        ARRAY['https://example.com/test.jpg'],
        '{"test": true}',
        true, NOW(), NOW()
      )
    `;
    
    log('✓ Test product created successfully');
    
    // Test 3: Retrieve the product
    const retrievedProduct = await sql`
      SELECT * FROM products WHERE id = ${testProductId}
    `;
    
    if (retrievedProduct.length === 0) {
      log('Product not found after creation', 'ERROR');
      return false;
    }
    
    log('✓ Test product retrieved successfully');
    
    // Test 4: Update the product
    await sql`
      UPDATE products 
      SET name = 'Updated Test Product', updated_at = NOW()
      WHERE id = ${testProductId}
    `;
    
    const updatedProduct = await sql`
      SELECT name FROM products WHERE id = ${testProductId}
    `;
    
    if (updatedProduct[0].name !== 'Updated Test Product') {
      log('Product update failed', 'ERROR');
      return false;
    }
    
    log('✓ Test product updated successfully');
    
    // Test 5: Count products after creation
    const afterCount = await sql`SELECT COUNT(*) as count FROM products WHERE organization_id = ${organizationId}`;
    
    if (parseInt(afterCount[0].count) !== parseInt(beforeCount[0].count) + 1) {
      log('Product count mismatch', 'ERROR');
      return false;
    }
    
    log('✓ Product count is correct');
    
    // Test 6: Clean up
    await sql`DELETE FROM products WHERE id = ${testProductId}`;
    
    const finalCount = await sql`SELECT COUNT(*) as count FROM products WHERE organization_id = ${organizationId}`;
    
    if (parseInt(finalCount[0].count) !== parseInt(beforeCount[0].count)) {
      log('Product cleanup failed', 'ERROR');
      return false;
    }
    
    log('✓ Test product cleaned up successfully');
    
    log('Data persistence test passed successfully', 'SUCCESS');
    return true;
    
  } catch (error) {
    log(`Data persistence test failed: ${error}`, 'ERROR');
    return false;
  }
}

/**
 * Test product count functionality
 */
async function testProductCount(): Promise<boolean> {
  try {
    log('Testing product count functionality...');
    
    const orgs = await sql`SELECT id FROM organizations LIMIT 1`;
    if (orgs.length === 0) {
      log('No organization found', 'ERROR');
      return false;
    }
    const organizationId = orgs[0].id;
    
    const result = await sql`SELECT COUNT(*) as count FROM products WHERE organization_id = ${organizationId}`;
    const count = parseInt(result[0].count);
    
    log(`Successfully retrieved product count: ${count} products`, 'SUCCESS');
    
    if (count >= 10) {
      log('✓ Database has sufficient products for testing', 'SUCCESS');
      return true;
    } else {
      log('⚠️  Database has fewer than 10 products', 'WARN');
      return true; // Still pass, just a warning
    }
    
  } catch (error) {
    log(`Product count test failed: ${error}`, 'ERROR');
    return false;
  }
}

/**
 * Test data persistence across reload (simulate)
 */
async function testDataPersistenceAcrossReload(): Promise<boolean> {
  try {
    log('Testing data persistence across reload...');
    
    // Simulate "reload" by creating new connection
    const sql2 = postgres(DATABASE_URL!, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 10,
    });
    
    const orgs = await sql2`SELECT id FROM organizations LIMIT 1`;
    if (orgs.length === 0) {
      log('No organization found after reload', 'ERROR');
      await sql2.end();
      return false;
    }
    
    const products = await sql2`SELECT COUNT(*) as count FROM products WHERE organization_id = ${orgs[0].id}`;
    const count = parseInt(products[0].count);
    
    await sql2.end();
    
    if (count > 0) {
      log(`✓ Data persists across reload: ${count} products found`, 'SUCCESS');
      return true;
    } else {
      log('No products found after reload', 'ERROR');
      return false;
    }
    
  } catch (error) {
    log(`Data persistence across reload test failed: ${error}`, 'ERROR');
    return false;
  }
}

/**
 * Main test runner
 */
async function runAllTests(): Promise<void> {
  const startTime = Date.now();
  
  log('🧪 Starting Simple Data Persistence Tests...');
  log('');
  
  const tests = [
    { name: 'Database Health Check', fn: testDatabaseHealth },
    { name: 'Data Persistence (CRUD)', fn: testDataPersistence },
    { name: 'Product Count', fn: testProductCount },
    { name: 'Data Persistence Across Reload', fn: testDataPersistenceAcrossReload }
  ];
  
  let passedTests = 0;
  const totalTests = tests.length;
  
  for (const test of tests) {
    const testStartTime = Date.now();
    const result = await test.fn();
    const testDuration = Date.now() - testStartTime;
    
    if (result) {
      passedTests++;
      log(`${test.name}: PASSED (${testDuration}ms)`, 'SUCCESS');
    } else {
      log(`${test.name}: FAILED (${testDuration}ms)`, 'ERROR');
    }
    log('');
  }
  
  const totalDuration = Date.now() - startTime;
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
  }
  
  await sql.end();
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
    await sql.end();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { runAllTests };