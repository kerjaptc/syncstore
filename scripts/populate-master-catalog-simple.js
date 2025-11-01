/**
 * Simple Master Catalog Population Script
 * Populates the master catalog from imported raw data using direct database operations
 */

const { readFile, readdir } = require('fs/promises');
const { existsSync } = require('fs');
const path = require('path');

// Simple database connection (we'll use a basic approach)
async function populateMasterCatalog() {
  console.log('🚀 Starting master catalog population...');
  
  try {
    const basePath = './data/raw-imports';
    const platforms = ['shopee', 'tiktokshop'];
    
    let totalProcessed = 0;
    let successfulProducts = 0;
    let failedProducts = 0;
    
    for (const platform of platforms) {
      console.log(`\n📦 Processing ${platform} data...`);
      
      const platformPath = path.join(basePath, platform);
      
      if (!existsSync(platformPath)) {
        console.log(`⚠️  No data found for platform: ${platform}`);
        continue;
      }

      // Get all batch files for this platform
      const files = await readdir(platformPath);
      const batchFiles = files.filter(file => file.startsWith('batch_') && file.endsWith('.json'));

      console.log(`📁 Found ${batchFiles.length} batch files for ${platform}`);

      // Process first few batch files as a test
      const testFiles = batchFiles.slice(0, 3); // Process only first 3 files for testing
      
      for (const file of testFiles) {
        try {
          const filePath = path.join(platformPath, file);
          const content = await readFile(filePath, 'utf8');
          const batchData = JSON.parse(content);
          
          if (!batchData || !batchData.products) {
            console.log(`⚠️  Invalid batch file format: ${file}`);
            continue;
          }

          console.log(`📄 Processing batch file: ${file} (${batchData.products.length} products)`);

          // Process products in this batch
          for (const rawProduct of batchData.products) {
            totalProcessed++;
            
            try {
              // Extract basic product information
              const productInfo = extractProductInfo(rawProduct, platform);
              
              if (productInfo) {
                console.log(`  ✅ Processed: ${productInfo.name} (${productInfo.id})`);
                successfulProducts++;
              } else {
                console.log(`  ❌ Failed to extract product info`);
                failedProducts++;
              }
              
            } catch (error) {
              console.log(`  ❌ Error processing product: ${error.message}`);
              failedProducts++;
            }
          }

        } catch (error) {
          console.log(`❌ Failed to process batch file ${file}: ${error.message}`);
        }
      }
    }

    // Display results
    console.log('\n📊 Population Results:');
    console.log(`Total Processed: ${totalProcessed}`);
    console.log(`Successful: ${successfulProducts}`);
    console.log(`Failed: ${failedProducts}`);

    console.log('\n✅ Master catalog population test completed!');
    console.log('📝 Note: This was a test run. To actually populate the database, implement the database insertion logic.');

  } catch (error) {
    console.error('❌ Master catalog population failed:', error);
    process.exit(1);
  }
}

/**
 * Extract product information from raw data
 */
function extractProductInfo(rawProduct, platform) {
  try {
    if (platform === 'shopee') {
      return {
        id: rawProduct.item_id?.toString(),
        name: rawProduct.item_name || 'Unnamed Product',
        description: rawProduct.description || 'No description',
        price: extractShopeePrice(rawProduct),
        weight: rawProduct.weight || 0,
        dimensions: extractShopeeDimensions(rawProduct),
        images: extractShopeeImages(rawProduct),
        platform: 'shopee'
      };
    } else if (platform === 'tiktokshop') {
      return {
        id: rawProduct.product_id,
        name: rawProduct.product_name || 'Unnamed Product',
        description: rawProduct.description || 'No description',
        price: rawProduct.price || 0,
        weight: rawProduct.weight || 0,
        dimensions: extractTikTokDimensions(rawProduct),
        images: extractTikTokImages(rawProduct),
        platform: 'tiktokshop'
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error extracting product info: ${error.message}`);
    return null;
  }
}

/**
 * Extract Shopee-specific data
 */
function extractShopeePrice(rawProduct) {
  if (rawProduct.price) return rawProduct.price;
  if (rawProduct.price_info?.current_price) return rawProduct.price_info.current_price;
  return 0;
}

function extractShopeeDimensions(rawProduct) {
  const dim = rawProduct.dimension || {};
  return {
    length: dim.package_length || 0,
    width: dim.package_width || 0,
    height: dim.package_height || 0,
    unit: 'cm'
  };
}

function extractShopeeImages(rawProduct) {
  const images = [];
  
  if (rawProduct.image?.image_url_list) {
    rawProduct.image.image_url_list.forEach((url, index) => {
      images.push({
        url,
        alt: `Product image ${index + 1}`,
        isPrimary: index === 0
      });
    });
  }

  return images.length > 0 ? images : [{
    url: 'https://via.placeholder.com/300x300?text=No+Image',
    alt: 'No image available',
    isPrimary: true
  }];
}

/**
 * Extract TikTok Shop-specific data
 */
function extractTikTokDimensions(rawProduct) {
  const dim = rawProduct.dimensions || {};
  return {
    length: dim.length || 0,
    width: dim.width || 0,
    height: dim.height || 0,
    unit: 'cm'
  };
}

function extractTikTokImages(rawProduct) {
  const images = [];
  
  if (rawProduct.images && Array.isArray(rawProduct.images)) {
    rawProduct.images.forEach((img, index) => {
      images.push({
        url: img.url,
        alt: `Product image ${index + 1}`,
        isPrimary: index === 0
      });
    });
  }

  return images.length > 0 ? images : [{
    url: 'https://via.placeholder.com/300x300?text=No+Image',
    alt: 'No image available',
    isPrimary: true
  }];
}

// Run the script
if (require.main === module) {
  populateMasterCatalog();
}

module.exports = { populateMasterCatalog };