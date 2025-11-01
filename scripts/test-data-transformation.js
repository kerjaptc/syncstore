/**
 * Test Data Transformation Script
 * Tests the data transformation logic from raw imports to master schema
 */

const { MasterCatalogPopulator } = require('../src/lib/services/master-catalog-populator');

async function main() {
  console.log('🧪 Testing data transformation logic...');
  
  try {
    // Configuration for testing
    const options = {
      organizationId: 'test-org-id',
      batchSize: 10, // Small batch for testing
      skipExisting: false,
      dryRun: true, // Test mode - no database changes
      platforms: ['shopee', 'tiktokshop'],
    };

    console.log('📋 Test Configuration:');
    console.log(`  Organization ID: ${options.organizationId}`);
    console.log(`  Batch Size: ${options.batchSize}`);
    console.log(`  Dry Run: ${options.dryRun}`);
    console.log(`  Platforms: ${options.platforms.join(', ')}`);

    // Create populator instance
    const populator = new MasterCatalogPopulator('./data/raw-imports', options.organizationId);

    // Run transformation test
    console.log('\n🔄 Running transformation test...');
    const result = await populator.populateFromImports(options);

    // Display results
    console.log('\n📊 Transformation Test Results:');
    console.log(`Total Processed: ${result.totalProcessed}`);
    console.log(`Successful: ${result.successfulProducts}`);
    console.log(`Failed: ${result.failedProducts}`);
    console.log(`Skipped: ${result.skippedProducts}`);

    // Show sample errors if any
    if (result.errors.length > 0) {
      console.log(`\n❌ Sample Errors (${result.errors.length} total):`);
      result.errors.slice(0, 3).forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.platform}:${error.productId}: ${error.error}`);
      });
    }

    // Show sample warnings if any
    if (result.warnings.length > 0) {
      console.log(`\n⚠️  Sample Warnings (${result.warnings.length} total):`);
      result.warnings.slice(0, 3).forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning.platform}:${warning.productId}: ${warning.warning}`);
      });
    }

    // Calculate success rate
    const successRate = result.totalProcessed > 0 
      ? (result.successfulProducts / result.totalProcessed * 100).toFixed(1)
      : '0';

    console.log(`\n📈 Success Rate: ${successRate}%`);

    if (parseFloat(successRate) >= 90) {
      console.log('✅ Transformation test PASSED - High success rate achieved!');
    } else if (parseFloat(successRate) >= 70) {
      console.log('⚠️  Transformation test PARTIAL - Acceptable success rate');
    } else {
      console.log('❌ Transformation test FAILED - Low success rate');
    }

    console.log('\n🧪 Data transformation test completed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Data transformation test failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };