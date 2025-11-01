/**
 * Master Catalog Population Script
 * Populates the master catalog from imported raw data
 */

const { MasterCatalogPopulator } = require('../src/lib/services/master-catalog-populator');

async function main() {
  console.log('🚀 Starting master catalog population...');
  
  try {
    // Configuration
    const options = {
      organizationId: 'default-org-id', // Default organization ID
      batchSize: 50,
      skipExisting: false, // Set to true to skip existing products
      dryRun: false, // Set to true for testing without database changes
      platforms: ['shopee', 'tiktokshop'], // Platforms to process
    };

    // Create populator instance
    const populator = new MasterCatalogPopulator('./data/raw-imports', options.organizationId);

    // Run population
    const result = await populator.populateFromImports(options);

    // Display results
    console.log('\n📊 Population Results:');
    console.log(`Total Processed: ${result.totalProcessed}`);
    console.log(`Successful: ${result.successfulProducts}`);
    console.log(`Failed: ${result.failedProducts}`);
    console.log(`Skipped: ${result.skippedProducts}`);

    if (result.errors.length > 0) {
      console.log(`\n❌ Errors (${result.errors.length}):`);
      result.errors.slice(0, 5).forEach(error => {
        console.log(`  - ${error.platform}:${error.productId}: ${error.error}`);
      });
      if (result.errors.length > 5) {
        console.log(`  ... and ${result.errors.length - 5} more errors`);
      }
    }

    if (result.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${result.warnings.length}):`);
      result.warnings.slice(0, 3).forEach(warning => {
        console.log(`  - ${warning.platform}:${warning.productId}: ${warning.warning}`);
      });
      if (result.warnings.length > 3) {
        console.log(`  ... and ${result.warnings.length - 3} more warnings`);
      }
    }

    // Generate detailed report
    console.log('\n📋 Generating detailed report...');
    const report = await populator.generateReport(result.importBatchId);
    console.log('\n' + report);

    console.log('\n✅ Master catalog population completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Master catalog population failed:', error);
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