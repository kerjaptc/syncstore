/**
 * Master Catalog Population Script with proper UUID
 * Populates the master catalog from imported raw data into the database
 */

import { MasterCatalogPopulator } from '../src/lib/services/master-catalog-populator';
import { randomUUID } from 'crypto';

async function main() {
  console.log('🚀 Starting master catalog population with proper UUID...');
  
  try {
    // Generate a proper UUID for organization
    const organizationId = randomUUID();
    console.log(`📋 Generated Organization ID: ${organizationId}`);

    // Configuration
    const options = {
      organizationId,
      batchSize: 50,
      skipExisting: false, // Set to true to skip existing products
      dryRun: false, // Real database changes
      platforms: ['shopee', 'tiktokshop'] as const, // Platforms to process
    };

    console.log('📋 Population Configuration:');
    console.log(`  Organization ID: ${options.organizationId}`);
    console.log(`  Batch Size: ${options.batchSize}`);
    console.log(`  Skip Existing: ${options.skipExisting}`);
    console.log(`  Dry Run: ${options.dryRun}`);
    console.log(`  Platforms: ${options.platforms.join(', ')}`);

    // Create populator instance
    const populator = new MasterCatalogPopulator('./data/raw-imports', options.organizationId);

    // Run population
    console.log('\n🔄 Starting master catalog population...');
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

    // Calculate success rate
    const successRate = result.totalProcessed > 0 
      ? (result.successfulProducts / result.totalProcessed * 100).toFixed(1)
      : '0';

    console.log(`\n📈 Success Rate: ${successRate}%`);

    // Generate detailed report
    console.log('\n📋 Generating detailed report...');
    const report = await populator.generateReport(result.importBatchId);
    console.log('\n' + report);

    if (parseFloat(successRate) >= 90) {
      console.log('\n✅ Master catalog population COMPLETED successfully!');
      console.log('🎉 Ready for validation and Phase 2 synchronization features!');
    } else if (parseFloat(successRate) >= 70) {
      console.log('\n⚠️  Master catalog population COMPLETED with warnings');
      console.log('📝 Review errors and warnings before proceeding to Phase 2');
    } else {
      console.log('\n❌ Master catalog population FAILED');
      console.log('🔧 Please review and fix errors before proceeding');
    }

    console.log(`\n💾 Organization ID for future reference: ${organizationId}`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Master catalog population failed:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
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

export { main };