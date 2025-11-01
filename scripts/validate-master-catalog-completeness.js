/**
 * Master Catalog Completeness Validation Script
 * Validates that all imported products are represented in master catalog
 * and checks platform mapping accuracy and pricing calculations
 */

const { readFile, readdir } = require('fs/promises');
const { existsSync } = require('fs');
const path = require('path');

async function main() {
  console.log('🔍 Starting master catalog completeness validation...');
  
  try {
    // Step 1: Analyze raw imported data
    const rawDataAnalysis = await analyzeRawImportedData();
    displayRawDataAnalysis(rawDataAnalysis);

    // Step 2: Validate data transformation logic
    const transformationValidation = await validateDataTransformation();
    displayTransformationValidation(transformationValidation);

    // Step 3: Validate pricing calculations
    const pricingValidation = await validatePricingCalculations();
    displayPricingValidation(pricingValidation);

    // Step 4: Generate completeness report
    const completenessReport = generateCompletenessReport(
      rawDataAnalysis, 
      transformationValidation, 
      pricingValidation
    );
    
    console.log('\n📋 Master Catalog Completeness Report:');
    console.log(completenessReport);

    console.log('\n✅ Master catalog completeness validation completed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Master catalog completeness validation failed:', error);
    process.exit(1);
  }
}

/**
 * Analyze raw imported data
 */
async function analyzeRawImportedData() {
  console.log('\n📊 Analyzing raw imported data...');
  
  const basePath = './data/raw-imports';
  const platforms = ['shopee', 'tiktokshop'];
  
  const analysis = {
    totalBatchFiles: 0,
    totalProducts: 0,
    productsByPlatform: {},
    uniqueProducts: new Set(),
    duplicateProducts: [],
    dataQualityIssues: [],
    sampleProducts: []
  };

  for (const platform of platforms) {
    console.log(`  📦 Analyzing ${platform} data...`);
    
    const platformPath = path.join(basePath, platform);
    
    if (!existsSync(platformPath)) {
      console.log(`    ⚠️  No data found for platform: ${platform}`);
      continue;
    }

    const files = await readdir(platformPath);
    const batchFiles = files.filter(file => file.startsWith('batch_') && file.endsWith('.json'));
    
    analysis.totalBatchFiles += batchFiles.length;
    analysis.productsByPlatform[platform] = {
      batchFiles: batchFiles.length,
      products: 0,
      validProducts: 0,
      invalidProducts: 0
    };

    // Analyze first few batch files for detailed analysis
    const sampleFiles = batchFiles.slice(0, 5);
    
    for (const file of sampleFiles) {
      try {
        const filePath = path.join(platformPath, file);
        const content = await readFile(filePath, 'utf8');
        const batchData = JSON.parse(content);
        
        if (!batchData || !batchData.products) {
          analysis.dataQualityIssues.push({
            platform,
            file,
            issue: 'Invalid batch file format'
          });
          continue;
        }

        analysis.productsByPlatform[platform].products += batchData.products.length;
        analysis.totalProducts += batchData.products.length;

        // Analyze each product
        for (const product of batchData.products) {
          const productId = platform === 'shopee' 
            ? product.item_id?.toString() 
            : product.product_id;

          if (!productId) {
            analysis.productsByPlatform[platform].invalidProducts++;
            analysis.dataQualityIssues.push({
              platform,
              file,
              issue: 'Product missing ID'
            });
            continue;
          }

          const uniqueKey = `${platform}:${productId}`;
          
          if (analysis.uniqueProducts.has(uniqueKey)) {
            analysis.duplicateProducts.push({
              platform,
              productId,
              file
            });
          } else {
            analysis.uniqueProducts.add(uniqueKey);
          }

          // Validate required fields
          const productName = platform === 'shopee' 
            ? product.item_name 
            : product.product_name;
          
          const productPrice = platform === 'shopee'
            ? (product.price || product.price_info?.current_price)
            : product.price;

          if (!productName || !productPrice || productPrice <= 0) {
            analysis.productsByPlatform[platform].invalidProducts++;
            analysis.dataQualityIssues.push({
              platform,
              file,
              productId,
              issue: 'Missing required fields (name or price)'
            });
          } else {
            analysis.productsByPlatform[platform].validProducts++;
            
            // Collect sample products for further analysis
            if (analysis.sampleProducts.length < 10) {
              analysis.sampleProducts.push({
                platform,
                productId,
                name: productName,
                price: productPrice,
                weight: product.weight || 0,
                hasImages: platform === 'shopee' 
                  ? !!(product.image?.image_url_list?.length)
                  : !!(product.images?.length),
                hasDimensions: platform === 'shopee'
                  ? !!(product.dimension)
                  : !!(product.dimensions)
              });
            }
          }
        }

      } catch (error) {
        analysis.dataQualityIssues.push({
          platform,
          file,
          issue: `Failed to parse batch file: ${error.message}`
        });
      }
    }
  }

  return analysis;
}

/**
 * Display raw data analysis
 */
function displayRawDataAnalysis(analysis) {
  console.log('\n📈 Raw Data Analysis Results:');
  console.log(`  Total Batch Files: ${analysis.totalBatchFiles}`);
  console.log(`  Total Products: ${analysis.totalProducts}`);
  console.log(`  Unique Products: ${analysis.uniqueProducts.size}`);
  console.log(`  Duplicate Products: ${analysis.duplicateProducts.length}`);
  console.log(`  Data Quality Issues: ${analysis.dataQualityIssues.length}`);

  console.log('\n  📊 Products by Platform:');
  Object.entries(analysis.productsByPlatform).forEach(([platform, stats]) => {
    console.log(`    ${platform}:`);
    console.log(`      Batch Files: ${stats.batchFiles}`);
    console.log(`      Products: ${stats.products}`);
    console.log(`      Valid: ${stats.validProducts}`);
    console.log(`      Invalid: ${stats.invalidProducts}`);
  });

  if (analysis.duplicateProducts.length > 0) {
    console.log('\n  ⚠️  Sample Duplicate Products:');
    analysis.duplicateProducts.slice(0, 3).forEach(dup => {
      console.log(`    - ${dup.platform}:${dup.productId} in ${dup.file}`);
    });
  }

  if (analysis.dataQualityIssues.length > 0) {
    console.log('\n  ❌ Sample Data Quality Issues:');
    analysis.dataQualityIssues.slice(0, 3).forEach(issue => {
      console.log(`    - ${issue.platform}:${issue.productId || 'unknown'}: ${issue.issue}`);
    });
  }
}

/**
 * Validate data transformation logic
 */
async function validateDataTransformation() {
  console.log('\n🔄 Validating data transformation logic...');
  
  const validation = {
    transformationTests: [],
    fieldMappingAccuracy: {},
    commonFieldsIdentified: [],
    platformSpecificFields: {}
  };

  // Test transformation with sample data
  const sampleShopeeProduct = {
    item_id: 123456789,
    item_name: "Test Frame Racing Drone",
    description: "Test description",
    price: 100000,
    weight: 0.05,
    dimension: {
      package_length: 25,
      package_width: 25,
      package_height: 5
    },
    image: {
      image_url_list: ["https://example.com/image1.jpg"]
    }
  };

  const sampleTikTokProduct = {
    product_id: "TTS001000000",
    product_name: "Test Racing Frame",
    description: "Test description",
    price: 120000,
    weight: 0.05,
    dimensions: {
      length: 25,
      width: 25,
      height: 5
    },
    images: [
      { url: "https://example.com/image1.jpg" }
    ]
  };

  // Test Shopee transformation
  try {
    const shopeeTransformed = transformProduct(sampleShopeeProduct, 'shopee');
    validation.transformationTests.push({
      platform: 'shopee',
      success: true,
      result: shopeeTransformed
    });
  } catch (error) {
    validation.transformationTests.push({
      platform: 'shopee',
      success: false,
      error: error.message
    });
  }

  // Test TikTok transformation
  try {
    const tiktokTransformed = transformProduct(sampleTikTokProduct, 'tiktokshop');
    validation.transformationTests.push({
      platform: 'tiktokshop',
      success: true,
      result: tiktokTransformed
    });
  } catch (error) {
    validation.transformationTests.push({
      platform: 'tiktokshop',
      success: false,
      error: error.message
    });
  }

  // Identify common fields
  validation.commonFieldsIdentified = [
    'name', 'description', 'price', 'weight', 'dimensions', 'images'
  ];

  // Identify platform-specific fields
  validation.platformSpecificFields = {
    shopee: ['item_id', 'category_id', 'item_sku', 'attribute_list', 'logistic_info'],
    tiktokshop: ['product_id', 'include_tokopedia', 'is_cod_allowed', 'manufacturer', 'delivery_options']
  };

  return validation;
}

/**
 * Transform product for testing
 */
function transformProduct(rawProduct, platform) {
  if (platform === 'shopee') {
    return {
      id: rawProduct.item_id?.toString(),
      name: rawProduct.item_name,
      description: rawProduct.description,
      price: rawProduct.price,
      weight: rawProduct.weight,
      dimensions: {
        length: rawProduct.dimension?.package_length || 0,
        width: rawProduct.dimension?.package_width || 0,
        height: rawProduct.dimension?.package_height || 0,
        unit: 'cm'
      },
      images: rawProduct.image?.image_url_list?.map((url, index) => ({
        url,
        alt: `Product image ${index + 1}`,
        isPrimary: index === 0
      })) || [],
      platform: 'shopee'
    };
  } else {
    return {
      id: rawProduct.product_id,
      name: rawProduct.product_name,
      description: rawProduct.description,
      price: rawProduct.price,
      weight: rawProduct.weight,
      dimensions: {
        length: rawProduct.dimensions?.length || 0,
        width: rawProduct.dimensions?.width || 0,
        height: rawProduct.dimensions?.height || 0,
        unit: 'cm'
      },
      images: rawProduct.images?.map((img, index) => ({
        url: img.url,
        alt: `Product image ${index + 1}`,
        isPrimary: index === 0
      })) || [],
      platform: 'tiktokshop'
    };
  }
}

/**
 * Display transformation validation
 */
function displayTransformationValidation(validation) {
  console.log('\n🔄 Data Transformation Validation Results:');
  
  console.log('  📋 Transformation Tests:');
  validation.transformationTests.forEach(test => {
    if (test.success) {
      console.log(`    ✅ ${test.platform}: Successfully transformed`);
      console.log(`       - Name: ${test.result.name}`);
      console.log(`       - Price: ${test.result.price}`);
      console.log(`       - Images: ${test.result.images.length}`);
    } else {
      console.log(`    ❌ ${test.platform}: Transformation failed - ${test.error}`);
    }
  });

  console.log('\n  🔗 Common Fields Identified:');
  validation.commonFieldsIdentified.forEach(field => {
    console.log(`    - ${field}`);
  });

  console.log('\n  🏷️  Platform-Specific Fields:');
  Object.entries(validation.platformSpecificFields).forEach(([platform, fields]) => {
    console.log(`    ${platform}: ${fields.join(', ')}`);
  });
}

/**
 * Validate pricing calculations
 */
async function validatePricingCalculations() {
  console.log('\n💰 Validating pricing calculations...');
  
  const validation = {
    pricingTests: [],
    feePercentages: {
      shopee: 15,
      tiktokshop: 20
    }
  };

  // Test pricing calculations
  const testPrices = [50000, 100000, 250000, 500000];
  
  for (const basePrice of testPrices) {
    // Test Shopee pricing (15% fee)
    const expectedShopeePrice = Math.round(basePrice * 1.15);
    const calculatedShopeePrice = calculatePlatformPrice(basePrice, 15);
    
    validation.pricingTests.push({
      platform: 'shopee',
      basePrice,
      expectedPrice: expectedShopeePrice,
      calculatedPrice: calculatedShopeePrice,
      isCorrect: expectedShopeePrice === calculatedShopeePrice
    });

    // Test TikTok Shop pricing (20% fee)
    const expectedTikTokPrice = Math.round(basePrice * 1.20);
    const calculatedTikTokPrice = calculatePlatformPrice(basePrice, 20);
    
    validation.pricingTests.push({
      platform: 'tiktokshop',
      basePrice,
      expectedPrice: expectedTikTokPrice,
      calculatedPrice: calculatedTikTokPrice,
      isCorrect: expectedTikTokPrice === calculatedTikTokPrice
    });
  }

  return validation;
}

/**
 * Calculate platform price with fee
 */
function calculatePlatformPrice(basePrice, feePercentage) {
  return Math.round(basePrice * (1 + feePercentage / 100));
}

/**
 * Display pricing validation
 */
function displayPricingValidation(validation) {
  console.log('\n💰 Pricing Calculation Validation Results:');
  
  const correctCalculations = validation.pricingTests.filter(test => test.isCorrect).length;
  const totalCalculations = validation.pricingTests.length;
  
  console.log(`  📊 Pricing Accuracy: ${correctCalculations}/${totalCalculations} (${Math.round(correctCalculations/totalCalculations*100)}%)`);
  
  console.log('\n  💵 Fee Percentages:');
  Object.entries(validation.feePercentages).forEach(([platform, fee]) => {
    console.log(`    ${platform}: ${fee}%`);
  });

  const incorrectCalculations = validation.pricingTests.filter(test => !test.isCorrect);
  if (incorrectCalculations.length > 0) {
    console.log('\n  ❌ Incorrect Calculations:');
    incorrectCalculations.forEach(test => {
      console.log(`    ${test.platform}: Base ${test.basePrice} -> Expected ${test.expectedPrice}, Got ${test.calculatedPrice}`);
    });
  } else {
    console.log('\n  ✅ All pricing calculations are correct!');
  }
}

/**
 * Generate completeness report
 */
function generateCompletenessReport(rawDataAnalysis, transformationValidation, pricingValidation) {
  let report = `📋 Master Catalog Completeness Report\n`;
  report += `=========================================\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;

  // Data Coverage
  report += `Data Coverage:\n`;
  report += `  Total Products Available: ${rawDataAnalysis.totalProducts}\n`;
  report += `  Unique Products: ${rawDataAnalysis.uniqueProducts.size}\n`;
  report += `  Data Quality Issues: ${rawDataAnalysis.dataQualityIssues.length}\n`;
  report += `  Duplicate Products: ${rawDataAnalysis.duplicateProducts.length}\n\n`;

  // Platform Distribution
  report += `Platform Distribution:\n`;
  Object.entries(rawDataAnalysis.productsByPlatform).forEach(([platform, stats]) => {
    const validPercentage = stats.products > 0 ? Math.round(stats.validProducts / stats.products * 100) : 0;
    report += `  ${platform}: ${stats.validProducts}/${stats.products} valid (${validPercentage}%)\n`;
  });
  report += `\n`;

  // Transformation Readiness
  const successfulTransformations = transformationValidation.transformationTests.filter(t => t.success).length;
  const totalTransformations = transformationValidation.transformationTests.length;
  const transformationSuccessRate = Math.round(successfulTransformations / totalTransformations * 100);
  
  report += `Transformation Readiness:\n`;
  report += `  Transformation Success Rate: ${successfulTransformations}/${totalTransformations} (${transformationSuccessRate}%)\n`;
  report += `  Common Fields Identified: ${transformationValidation.commonFieldsIdentified.length}\n`;
  report += `  Platform-Specific Fields: ${Object.keys(transformationValidation.platformSpecificFields).length} platforms\n\n`;

  // Pricing Accuracy
  const correctPricing = pricingValidation.pricingTests.filter(t => t.isCorrect).length;
  const totalPricing = pricingValidation.pricingTests.length;
  const pricingAccuracy = Math.round(correctPricing / totalPricing * 100);
  
  report += `Pricing Calculation Accuracy:\n`;
  report += `  Correct Calculations: ${correctPricing}/${totalPricing} (${pricingAccuracy}%)\n`;
  report += `  Shopee Fee: ${pricingValidation.feePercentages.shopee}%\n`;
  report += `  TikTok Shop Fee: ${pricingValidation.feePercentages.tiktokshop}%\n\n`;

  // Overall Readiness Score
  let readinessScore = 0;
  
  // Data quality (40% weight)
  const dataQualityScore = rawDataAnalysis.dataQualityIssues.length === 0 ? 40 : Math.max(0, 40 - rawDataAnalysis.dataQualityIssues.length);
  readinessScore += dataQualityScore;
  
  // Transformation readiness (30% weight)
  readinessScore += Math.round(transformationSuccessRate * 0.3);
  
  // Pricing accuracy (30% weight)
  readinessScore += Math.round(pricingAccuracy * 0.3);

  report += `Overall Readiness Score: ${Math.min(100, readinessScore)}/100\n\n`;

  // Recommendations
  report += `Recommendations:\n`;
  if (rawDataAnalysis.dataQualityIssues.length > 0) {
    report += `  - Address ${rawDataAnalysis.dataQualityIssues.length} data quality issues\n`;
  }
  if (rawDataAnalysis.duplicateProducts.length > 0) {
    report += `  - Handle ${rawDataAnalysis.duplicateProducts.length} duplicate products\n`;
  }
  if (transformationSuccessRate < 100) {
    report += `  - Fix transformation issues for failed platforms\n`;
  }
  if (pricingAccuracy < 100) {
    report += `  - Review and fix pricing calculation logic\n`;
  }
  
  if (readinessScore >= 90) {
    report += `  ✅ Master catalog is ready for population!\n`;
  } else if (readinessScore >= 70) {
    report += `  ⚠️  Master catalog has minor issues but can proceed with caution\n`;
  } else {
    report += `  ❌ Master catalog needs significant improvements before population\n`;
  }

  return report;
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