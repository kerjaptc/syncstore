/**
 * Test script for TikTok Shop validation and storage functionality
 * Demonstrates the new TikTok-specific validation logic and Tokopedia flag tracking
 */

const { tiktokShopValidator } = require('../src/lib/validators/tiktokshop-validator.ts');
const { tiktokShopDataStore } = require('../src/lib/storage/tiktokshop-data-store.ts');

async function testTikTokShopValidationAndStorage() {
  console.log('🧪 Testing TikTok Shop Validation and Storage');
  console.log('==============================================\n');

  try {
    // Initialize data store
    await tiktokShopDataStore.initialize();

    // Sample TikTok Shop product data
    const sampleProducts = [
      {
        product_id: 'TTS-TEST-001',
        product_name: 'Racing Frame 5 Inch Carbon - Premium Quality',
        description: 'High-quality carbon fiber racing frame for FPV drones. Perfect for racing and freestyle flying with excellent durability.',
        brand_name: 'Test Brand FPV',
        category_id: 'electronics-456',
        product_status: 'ACTIVE',
        create_time: Date.now(),
        update_time: Date.now(),
        images: [
          {
            id: 'img-001',
            url: 'https://example.com/frame-main.jpg',
            thumb_urls: ['https://example.com/frame-thumb.jpg'],
          },
          {
            id: 'img-002',
            url: 'https://example.com/frame-side.jpg',
            thumb_urls: ['https://example.com/frame-side-thumb.jpg'],
          },
          {
            id: 'img-003',
            url: 'https://example.com/frame-detail.jpg',
            thumb_urls: ['https://example.com/frame-detail-thumb.jpg'],
          },
        ],
        package_weight: 0.05,
        package_dimensions: {
          length: 25,
          width: 25,
          height: 5,
        },
        delivery_options: [
          {
            delivery_option_id: 'jnt_express',
            delivery_option_name: 'J&T Express',
            is_available: true,
          },
        ],
        is_cod_allowed: true,
        include_tokopedia: true, // Tokopedia integration enabled
      },
      {
        product_id: 'TTS-TEST-002',
        product_name: 'Propeller 9 Inch High Performance',
        description: 'Premium propellers for high-performance FPV racing drones.',
        brand_name: 'Test Brand FPV',
        category_id: 'electronics-456',
        product_status: 'ACTIVE',
        create_time: Date.now(),
        update_time: Date.now(),
        images: [
          {
            id: 'img-004',
            url: 'https://example.com/prop-main.jpg',
            thumb_urls: ['https://example.com/prop-thumb.jpg'],
          },
        ],
        package_weight: 0.02,
        is_cod_allowed: true,
        include_tokopedia: false, // Tokopedia integration disabled
      },
      {
        product_id: 'TTS-TEST-003',
        product_name: 'Invalid Product', // This will have validation issues
        // Missing required fields
        product_status: 'DRAFT',
        create_time: Date.now(),
        update_time: Date.now(),
        images: [], // No images
        include_tokopedia: true,
      },
    ];

    console.log('📊 Validating sample products...\n');

    // Validate products individually
    for (const product of sampleProducts) {
      console.log(`Validating product: ${product.product_id}`);
      
      const validationResult = tiktokShopValidator.validateProduct(product);
      
      console.log(`  ✅ Valid: ${validationResult.isValid}`);
      console.log(`  🏪 Tokopedia: ${validationResult.tokopediaFlag ? 'Enabled' : 'Disabled'}`);
      
      if (validationResult.errors.length > 0) {
        console.log(`  ❌ Errors: ${validationResult.errors.length}`);
        validationResult.errors.forEach(error => {
          console.log(`    - ${error}`);
        });
      }
      
      if (validationResult.warnings.length > 0) {
        console.log(`  ⚠️  Warnings: ${validationResult.warnings.length}`);
        validationResult.warnings.forEach(warning => {
          console.log(`    - ${warning}`);
        });
      }

      // Store valid products
      if (validationResult.isValid) {
        try {
          await tiktokShopDataStore.storeProduct(
            product.product_id,
            validationResult.data,
            { sessionId: 'test-session-001' }
          );
          console.log(`  💾 Stored successfully`);
        } catch (error) {
          console.log(`  ❌ Storage failed: ${error.message}`);
        }
      }
      
      console.log('');
    }

    // Batch validation test
    console.log('🔄 Testing batch validation...\n');
    
    const batchResult = await tiktokShopValidator.validateBatch(
      sampleProducts,
      (progress) => {
        console.log(`  Progress: ${progress.percentage}% (${progress.current}/${progress.total})`);
      }
    );

    console.log('\n📈 Batch validation results:');
    console.log(`  Total: ${batchResult.summary.total}`);
    console.log(`  Valid: ${batchResult.summary.valid}`);
    console.log(`  Invalid: ${batchResult.summary.invalid}`);
    console.log(`  With Warnings: ${batchResult.summary.warnings}`);
    console.log(`  Tokopedia Enabled: ${batchResult.summary.tokopediaEnabled}`);

    // Store batch data
    await tiktokShopDataStore.storeBatch(
      'test-batch-001',
      sampleProducts,
      { sessionId: 'test-session-001' }
    );

    // Get validation statistics
    console.log('\n📊 Validation Statistics:');
    const validatorStats = tiktokShopValidator.getStats();
    console.log(`  Total Validated: ${validatorStats.totalValidated}`);
    console.log(`  Valid Count: ${validatorStats.validCount}`);
    console.log(`  Invalid Count: ${validatorStats.invalidCount}`);
    console.log(`  Warning Count: ${validatorStats.warningCount}`);
    console.log(`  Tokopedia Enabled: ${validatorStats.tokopediaEnabledCount}`);
    console.log(`  Avg Validation Time: ${Math.round(validatorStats.validationDuration / validatorStats.totalValidated)}ms`);

    // Get storage statistics
    console.log('\n💾 Storage Statistics:');
    const storageStats = await tiktokShopDataStore.getStats();
    console.log(`  Total Entries: ${storageStats.totalEntries}`);
    console.log(`  Tokopedia Enabled: ${storageStats.tokopediaEnabledCount}`);
    console.log(`  Tokopedia Disabled: ${storageStats.tokopediaDisabledCount}`);
    console.log(`  Total Size: ${(storageStats.totalSizeBytes / 1024).toFixed(2)} KB`);

    // Get Tokopedia-enabled products
    const tokopediaProducts = await tiktokShopDataStore.getTokopediaEnabledProducts();
    console.log(`\n🏪 Tokopedia-enabled products: ${tokopediaProducts.length}`);
    tokopediaProducts.forEach(product => {
      console.log(`  - ${product.id} (${product.data.product_name})`);
    });

    // Generate reports
    console.log('\n📋 Validation Report:');
    console.log(tiktokShopValidator.generateReport());

    console.log('\n📋 Storage Report:');
    console.log(await tiktokShopDataStore.generateReport());

    // Save progress logs
    await tiktokShopDataStore.saveProgressLogs('test-session-001');

    console.log('\n✅ TikTok Shop validation and storage test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testTikTokShopValidationAndStorage();
}

module.exports = { testTikTokShopValidationAndStorage };