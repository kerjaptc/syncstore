#!/usr/bin/env node

/**
 * Generate TikTok Shop Mock Data for Validation
 * Creates batch files similar to Shopee format for data overlap validation
 */

const fs = require('fs').promises;
const path = require('path');

// Mock TikTok Shop product data generator
function generateTikTokProduct(index, isTokopedia = false) {
  const productTypes = [
    'Racing Frame 5 Inch Carbon',
    'Propeller 9 Inch High Performance', 
    'FPV Camera 1200TVL',
    'ESC 4in1 35A',
    'Flight Controller F4',
    'VTX 5.8GHz 800mW',
    'Receiver ELRS 2.4GHz',
    'Motor 2207 2750KV',
    'Battery 4S 1500mAh',
    'Antenna Pagoda 5.8GHz'
  ];

  const materials = ['Carbon Fiber', 'Aluminum', 'Plastic', 'Titanium'];
  const sizes = ['3 Inch', '4 Inch', '5 Inch', '6 Inch', '7 Inch', '9 Inch'];

  const productType = productTypes[index % productTypes.length];
  const material = materials[index % materials.length];
  const size = sizes[index % sizes.length];

  return {
    product_id: `TTS${String(index + 1000000).padStart(9, '0')}`,
    product_name: `${productType} - ${material} ${size} untuk FPV Racing`,
    description: `Premium quality drone part manufactured with precision engineering. Perfect for racing and freestyle applications. Pre-order 5 hari kerja. Garansi 30 hari. Kualitas terjamin.`,
    category_id: `CAT${String((index % 5) + 1).padStart(6, '0')}`,
    brand: 'Motekar FPV',
    price: Math.floor(Math.random() * 500000) + 50000, // 50k - 550k IDR
    images: [
      {
        url: `https://p16-oec-va.tiktokcdn.com/tos-maliva-i-o3syd03w52-us/product-${index + 1}-main.jpg`,
        thumb_urls: [
          `https://p16-oec-va.tiktokcdn.com/tos-maliva-i-o3syd03w52-us/product-${index + 1}-thumb.jpg`
        ]
      },
      {
        url: `https://p16-oec-va.tiktokcdn.com/tos-maliva-i-o3syd03w52-us/product-${index + 1}-side.jpg`,
        thumb_urls: [
          `https://p16-oec-va.tiktokcdn.com/tos-maliva-i-o3syd03w52-us/product-${index + 1}-side-thumb.jpg`
        ]
      }
    ],
    weight: 0.05,
    dimensions: {
      length: 25,
      width: 25,
      height: 5
    },
    status: 'ACTIVE',
    created_time: Date.now() - Math.random() * 86400000 * 30, // Random time in last 30 days
    updated_time: Date.now() - Math.random() * 86400000 * 7,  // Random time in last 7 days
    include_tokopedia: isTokopedia,
    delivery_options: [
      {
        delivery_option_id: 'standard',
        delivery_option_name: 'Standard Delivery',
        is_available: true
      }
    ],
    is_cod_allowed: true,
    manufacturer: 'Motekar Manufacturing',
    category_chains: [
      {
        id: 'electronics',
        name: 'Electronics',
        parent_id: null
      },
      {
        id: 'drone_parts',
        name: 'Drone Parts',
        parent_id: 'electronics'
      }
    ],
    sales_attributes: [
      {
        attribute_name: 'Material',
        attribute_value: material
      },
      {
        attribute_name: 'Size',
        attribute_value: size
      },
      {
        attribute_name: 'Weight',
        attribute_value: '50g'
      }
    ],
    skus: [
      {
        id: `SKU-TTS-${String(index + 1).padStart(6, '0')}-RED`,
        seller_sku: `FRAME-${size.replace(' ', '')}-RED-TTS`,
        price: {
          amount: Math.floor(Math.random() * 500000) + 50000,
          currency: 'IDR'
        },
        inventory: [
          {
            warehouse_id: 'WH001',
            available_stock: Math.floor(Math.random() * 50) + 1,
            reserved_stock: Math.floor(Math.random() * 5)
          }
        ],
        sales_attributes: [
          {
            attribute_name: 'Color',
            attribute_value: 'Red'
          }
        ]
      },
      {
        id: `SKU-TTS-${String(index + 1).padStart(6, '0')}-BLUE`,
        seller_sku: `FRAME-${size.replace(' ', '')}-BLUE-TTS`,
        price: {
          amount: Math.floor(Math.random() * 500000) + 50000,
          currency: 'IDR'
        },
        inventory: [
          {
            warehouse_id: 'WH001',
            available_stock: Math.floor(Math.random() * 50) + 1,
            reserved_stock: Math.floor(Math.random() * 5)
          }
        ],
        sales_attributes: [
          {
            attribute_name: 'Color',
            attribute_value: 'Blue'
          }
        ]
      }
    ]
  };
}

async function generateTikTokShopBatchFiles() {
  console.log('🔄 Generating TikTok Shop mock data for validation...');
  
  const outputDir = path.join('data', 'raw-imports', 'tiktokshop');
  
  // Ensure directory exists
  await fs.mkdir(outputDir, { recursive: true });
  
  const totalProducts = 500;
  const batchSize = 50;
  const tokopediaProducts = 150; // 30% of products have Tokopedia integration
  
  let productIndex = 0;
  
  for (let batchIndex = 0; batchIndex < Math.ceil(totalProducts / batchSize); batchIndex++) {
    const batchId = `batch_${Date.now() + batchIndex}_${batchIndex * batchSize}`;
    const currentBatchSize = Math.min(batchSize, totalProducts - productIndex);
    
    const products = [];
    
    for (let i = 0; i < currentBatchSize; i++) {
      const isTokopedia = productIndex < tokopediaProducts;
      const product = generateTikTokProduct(productIndex, isTokopedia);
      products.push(product);
      productIndex++;
    }
    
    const batchData = {
      batchId,
      platform: 'tiktokshop',
      products,
      metadata: {
        importedAt: new Date().toISOString(),
        source: 'tiktokshop_api_batch',
        version: '1.0',
        organizationId: 'mock-org',
        storeId: 'mock-store'
      },
      stats: {
        totalProducts: products.length,
        productsWithVariants: products.filter(p => p.skus && p.skus.length > 1).length,
        tokopediaEnabledProducts: products.filter(p => p.include_tokopedia).length
      }
    };
    
    const filename = `${batchId}_${Date.now()}.json`;
    const filepath = path.join(outputDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(batchData, null, 2), 'utf8');
    
    console.log(`📦 Generated batch ${batchIndex + 1}/${Math.ceil(totalProducts / batchSize)}: ${products.length} products (${products.filter(p => p.include_tokopedia).length} Tokopedia)`);
  }
  
  console.log(`✅ Generated ${totalProducts} TikTok Shop products in ${Math.ceil(totalProducts / batchSize)} batch files`);
  console.log(`📱 Tokopedia integration: ${tokopediaProducts} products (${Math.round((tokopediaProducts / totalProducts) * 100)}%)`);
  console.log(`📁 Files saved to: ${outputDir}`);
}

// Run the generator
generateTikTokShopBatchFiles().catch(console.error);