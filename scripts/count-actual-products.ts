#!/usr/bin/env tsx

/**
 * Script untuk menghitung jumlah produk yang sebenarnya ada di data import
 */

import fs from 'fs/promises';
import path from 'path';

interface BatchFile {
  batchId: string;
  platform: string;
  products: any[];
}

async function countProductsInDirectory(dirPath: string): Promise<number> {
  let totalProducts = 0;
  
  try {
    const files = await fs.readdir(dirPath);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    console.log(`📁 Checking directory: ${dirPath}`);
    console.log(`📄 Found ${jsonFiles.length} batch files`);
    
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(dirPath, file);
        const content = await fs.readFile(filePath, 'utf8');
        const batchData: BatchFile = JSON.parse(content);
        
        if (batchData.products && Array.isArray(batchData.products)) {
          totalProducts += batchData.products.length;
          console.log(`  📦 ${file}: ${batchData.products.length} products`);
        }
      } catch (error) {
        console.warn(`⚠️  Error reading ${file}:`, error);
      }
    }
    
    return totalProducts;
  } catch (error) {
    console.error(`❌ Error reading directory ${dirPath}:`, error);
    return 0;
  }
}

async function main() {
  console.log('🔍 Menghitung Jumlah Produk yang Sebenarnya di Data Import');
  console.log('='.repeat(60));
  
  const dataDir = './data/raw-imports';
  
  // Check if data directory exists
  try {
    await fs.access(dataDir);
  } catch {
    console.log('❌ Data directory tidak ditemukan:', dataDir);
    console.log('💡 Ini berarti belum ada data yang di-import secara nyata');
    return;
  }
  
  // Count Shopee products
  const shopeeDir = path.join(dataDir, 'shopee');
  let shopeeCount = 0;
  
  try {
    shopeeCount = await countProductsInDirectory(shopeeDir);
    console.log(`\n✅ Total Shopee Products: ${shopeeCount}`);
  } catch (error) {
    console.log('⚠️  Shopee directory tidak ditemukan atau kosong');
  }
  
  // Count TikTok Shop products
  const tiktokDir = path.join(dataDir, 'tiktokshop');
  let tiktokCount = 0;
  
  try {
    tiktokCount = await countProductsInDirectory(tiktokDir);
    console.log(`✅ Total TikTok Shop Products: ${tiktokCount}`);
  } catch (error) {
    console.log('⚠️  TikTok Shop directory tidak ditemukan atau kosong');
  }
  
  // Summary
  const totalCount = shopeeCount + tiktokCount;
  
  console.log('\n📊 RINGKASAN HASIL');
  console.log('='.repeat(30));
  console.log(`🛒 Shopee Products: ${shopeeCount.toLocaleString()}`);
  console.log(`🎵 TikTok Shop Products: ${tiktokCount.toLocaleString()}`);
  console.log(`📦 Total Products: ${totalCount.toLocaleString()}`);
  
  console.log('\n💡 PENJELASAN');
  console.log('='.repeat(30));
  
  if (totalCount > 0) {
    console.log('✅ Data ini adalah MOCK DATA (data simulasi) yang dibuat untuk testing');
    console.log('✅ Bukan data real dari API Shopee/TikTok Shop yang sesungguhnya');
    console.log('✅ Data mock ini dibuat oleh sistem untuk menguji fungsionalitas');
    console.log('✅ Dalam implementasi nyata, data akan diambil dari API platform yang sebenarnya');
  } else {
    console.log('ℹ️  Belum ada data yang di-import');
    console.log('ℹ️  Untuk menjalankan import mock data, gunakan:');
    console.log('   npx tsx scripts/run-shopee-import.js');
    console.log('   npx tsx scripts/run-tiktokshop-import.js');
  }
  
  console.log('\n🔍 CARA MENGECEK DATA');
  console.log('='.repeat(30));
  console.log('1. Lihat file batch di: ./data/raw-imports/');
  console.log('2. Setiap file JSON berisi array products');
  console.log('3. Data memiliki struktur yang mirip dengan API asli');
  console.log('4. Tapi isinya adalah data simulasi, bukan data real');
  
  // Show sample data structure
  if (totalCount > 0) {
    console.log('\n📋 CONTOH STRUKTUR DATA');
    console.log('='.repeat(30));
    
    try {
      const shopeeFiles = await fs.readdir(shopeeDir);
      if (shopeeFiles.length > 0) {
        const sampleFile = path.join(shopeeDir, shopeeFiles[0]);
        const sampleContent = await fs.readFile(sampleFile, 'utf8');
        const sampleData = JSON.parse(sampleContent);
        
        if (sampleData.products && sampleData.products.length > 0) {
          const sampleProduct = sampleData.products[0];
          console.log('Shopee Product Sample:');
          console.log(`  - ID: ${sampleProduct.item_id}`);
          console.log(`  - Name: ${sampleProduct.item_name}`);
          console.log(`  - Price: IDR ${sampleProduct.price?.toLocaleString() || 'N/A'}`);
          console.log(`  - Category: ${sampleProduct.category_id}`);
        }
      }
    } catch (error) {
      console.log('⚠️  Tidak bisa menampilkan sample data');
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}