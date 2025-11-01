import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ShopeeImporter } from '../importers/shopee-importer';
import { TikTokImporter } from '../importers/tiktokshop-importer';
import { MasterCatalogPopulator } from '../services/master-catalog-populator';
import { ComprehensiveDataValidator } from '../validators/comprehensive-data-validator';
import { RawDataStore } from '../storage/raw-data-store';
import fs from 'fs/promises';

/**
 * Performance Integration Tests
 * 
 * These tests validate system performance with large datasets
 * and ensure the system can handle production-scale workloads.
 */
describe('Performance Integration Tests', () => {
  const testDataDir = './test-data/performance';
  const organizationId = 'perf-test-org';
  
  let shopeeImporter: ShopeeImporter;
  let tiktokImporter: TikTokImporter;
  let catalogPopulator: MasterCatalogPopulator;
  let validator: ComprehensiveDataValidator;
  let rawDataStore: RawDataStore;

  beforeAll(async () => {
    await fs.mkdir(testDataDir, { recursive: true });
    
    shopeeImporter = new ShopeeImporter();
    tiktokImporter = new TikTokImporter();
    catalogPopulator = new MasterCatalogPopulator(testDataDir, organizationId);
    validator = new ComprehensiveDataValidator();
    rawDataStore = new RawDataStore(testDataDir);
  });

  afterAll(async () => {
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup performance test data:', error);
    }
  });

  beforeEach(async () => {
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
      await fs.mkdir(testDataDir, { recursive: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  describe('Large Dataset Performance', () => {
    it('should handle 1000 products efficiently', async () => {
      const startTime = Date.now();
      const productCount = 1000;
      
      // Track memory usage
      const initialMemory = process.memoryUsage();
      
      // Import large dataset
      const shopeeResult = await shopeeImporter.importMockData({
        outputDir: testDataDir,
        productCount,
        batchSize: 100
      });

      const importTime = Date.now();
      
      // Populate master catalog
      const populationResult = await catalogPopulator.populateFromImports({
        organizationId,
        batchSize: 100,
        skipExisting: false,
        dryRun: false,
        platforms: ['shopee']
      });

      const populationTime = Date.now();
      
      // Validate results
      const validationResult = await validator.validateAllProducts();
      
      const endTime = Date.now();
      const finalMemory = process.memoryUsage();

      // Performance assertions
      expect(shopeeResult.success).toBe(true);
      expect(shopeeResult.totalProducts).toBe(productCount);
      expect(populationResult.success).toBe(true);
      expect(populationResult.totalProcessed).toBe(productCount);
      expect(validationResult.totalProducts).toBe(productCount);

      // Timing assertions (should complete within reasonable time)
      const importDuration = importTime - startTime;
      const populationDuration = populationTime - importTime;
      const validationDuration = endTime - populationTime;
      const totalDuration = endTime - startTime;

      console.log(`Performance metrics for ${productCount} products:`);
      console.log(`  Import time: ${importDuration}ms`);
      console.log(`  Population time: ${populationDuration}ms`);
      console.log(`  Validation time: ${validationDuration}ms`);
      console.log(`  Total time: ${totalDuration}ms`);
      console.log(`  Memory increase: ${(finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024}MB`);

      // Performance targets
      expect(totalDuration).toBeLessThan(60000); // Less than 60 seconds
      expect(importDuration).toBeLessThan(20000); // Less than 20 seconds for import
      expect(populationDuration).toBeLessThan(30000); // Less than 30 seconds for population
      expect(validationDuration).toBeLessThan(10000); // Less than 10 seconds for validation

      // Memory usage should be reasonable (less than 1GB increase)
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      expect(memoryIncrease).toBeLessThan(1024);
    }, 120000); // 2 minute timeout

    it('should handle mixed platform datasets efficiently', async () => {
      const startTime = Date.now();
      const productCountPerPlatform = 500;
      
      // Import from both platforms
      const [shopeeResult, tiktokResult] = await Promise.all([
        shopeeImporter.importMockData({
          outputDir: testDataDir,
          productCount: productCountPerPlatform,
          batchSize: 50
        }),
        tiktokImporter.importMockData({
          outputDir: testDataDir,
          productCount: productCountPerPlatform,
          batchSize: 50
        })
      ]);

      const importTime = Date.now();

      // Populate master catalog with both platforms
      const populationResult = await catalogPopulator.populateFromImports({
        organizationId,
        batchSize: 100,
        skipExisting: false,
        dryRun: false,
        platforms: ['shopee', 'tiktokshop']
      });

      const endTime = Date.now();

      // Verify results
      expect(shopeeResult.success).toBe(true);
      expect(tiktokResult.success).toBe(true);
      expect(populationResult.success).toBe(true);
      expect(populationResult.totalProcessed).toBe(productCountPerPlatform * 2);

      const importDuration = importTime - startTime;
      const populationDuration = endTime - importTime;
      const totalDuration = endTime - startTime;

      console.log(`Mixed platform performance (${productCountPerPlatform * 2} products):`);
      console.log(`  Concurrent import time: ${importDuration}ms`);
      console.log(`  Population time: ${populationDuration}ms`);
      console.log(`  Total time: ${totalDuration}ms`);

      // Should benefit from concurrent imports
      expect(totalDuration).toBeLessThan(90000); // Less than 90 seconds
      expect(populationDuration).toBeLessThan(60000); // Less than 60 seconds for population
    }, 150000); // 2.5 minute timeout
  });

  describe('Batch Processing Performance', () => {
    it('should optimize batch sizes for performance', async () => {
      const productCount = 200;
      const batchSizes = [10, 50, 100];
      const results: Array<{ batchSize: number; duration: number; success: boolean }> = [];

      for (const batchSize of batchSizes) {
        // Clean up before each test
        await fs.rm(testDataDir, { recursive: true, force: true });
        await fs.mkdir(testDataDir, { recursive: true });

        // Import test data
        await shopeeImporter.importMockData({
          outputDir: testDataDir,
          productCount,
          batchSize: 50
        });

        const startTime = Date.now();

        // Test population with different batch sizes
        const result = await catalogPopulator.populateFromImports({
          organizationId: `${organizationId}_batch_${batchSize}`,
          batchSize,
          skipExisting: false,
          dryRun: false,
          platforms: ['shopee']
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        results.push({
          batchSize,
          duration,
          success: result.success
        });

        expect(result.success).toBe(true);
        expect(result.totalProcessed).toBe(productCount);
      }

      // Log performance comparison
      console.log('Batch size performance comparison:');
      results.forEach(({ batchSize, duration, success }) => {
        console.log(`  Batch size ${batchSize}: ${duration}ms (${success ? 'success' : 'failed'})`);
      });

      // All batch sizes should work
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Larger batch sizes should generally be faster (within reason)
      const smallBatchTime = results.find(r => r.batchSize === 10)?.duration || 0;
      const largeBatchTime = results.find(r => r.batchSize === 100)?.duration || 0;
      
      // Large batches should not be significantly slower than small batches
      expect(largeBatchTime).toBeLessThan(smallBatchTime * 2);
    }, 180000); // 3 minute timeout
  });

  describe('Memory Usage Performance', () => {
    it('should maintain stable memory usage during large operations', async () => {
      const productCount = 500;
      const memorySnapshots: Array<{ stage: string; heapUsed: number; external: number }> = [];

      // Initial memory
      memorySnapshots.push({
        stage: 'initial',
        ...process.memoryUsage()
      });

      // Import data
      await shopeeImporter.importMockData({
        outputDir: testDataDir,
        productCount,
        batchSize: 100
      });

      memorySnapshots.push({
        stage: 'after_import',
        ...process.memoryUsage()
      });

      // Populate catalog
      const result = await catalogPopulator.populateFromImports({
        organizationId,
        batchSize: 50,
        skipExisting: false,
        dryRun: false,
        platforms: ['shopee']
      });

      memorySnapshots.push({
        stage: 'after_population',
        ...process.memoryUsage()
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      memorySnapshots.push({
        stage: 'after_gc',
        ...process.memoryUsage()
      });

      // Validate results
      expect(result.success).toBe(true);
      expect(result.totalProcessed).toBe(productCount);

      // Log memory usage
      console.log('Memory usage progression:');
      memorySnapshots.forEach(({ stage, heapUsed, external }) => {
        console.log(`  ${stage}: ${(heapUsed / 1024 / 1024).toFixed(2)}MB heap, ${(external / 1024 / 1024).toFixed(2)}MB external`);
      });

      // Memory should not grow excessively
      const initialHeap = memorySnapshots[0].heapUsed;
      const finalHeap = memorySnapshots[memorySnapshots.length - 1].heapUsed;
      const memoryIncrease = (finalHeap - initialHeap) / 1024 / 1024;

      expect(memoryIncrease).toBeLessThan(500); // Less than 500MB increase
    }, 120000);

    it('should handle memory pressure gracefully', async () => {
      // Create a large dataset to test memory pressure
      const largeProductCount = 1500;
      
      const startMemory = process.memoryUsage();
      
      // Import large dataset
      const result = await shopeeImporter.importMockData({
        outputDir: testDataDir,
        productCount: largeProductCount,
        batchSize: 200
      });

      expect(result.success).toBe(true);

      // Process in smaller batches to manage memory
      const populationResult = await catalogPopulator.populateFromImports({
        organizationId,
        batchSize: 100, // Smaller batch size for memory management
        skipExisting: false,
        dryRun: false,
        platforms: ['shopee']
      });

      const endMemory = process.memoryUsage();

      expect(populationResult.success).toBe(true);
      expect(populationResult.totalProcessed).toBe(largeProductCount);

      // Memory increase should be reasonable even with large dataset
      const memoryIncrease = (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024;
      console.log(`Memory increase for ${largeProductCount} products: ${memoryIncrease.toFixed(2)}MB`);
      
      expect(memoryIncrease).toBeLessThan(1000); // Less than 1GB increase
    }, 180000);
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent population operations', async () => {
      const productCount = 300;
      const concurrentOperations = 3;

      // Set up test data for each operation
      const setupPromises = Array.from({ length: concurrentOperations }, async (_, index) => {
        const orgId = `${organizationId}_concurrent_${index}`;
        const dataDir = `${testDataDir}_${index}`;
        
        await fs.mkdir(dataDir, { recursive: true });
        
        const importer = new ShopeeImporter();
        await importer.importMockData({
          outputDir: dataDir,
          productCount,
          batchSize: 50
        });

        return { orgId, dataDir };
      });

      const setups = await Promise.all(setupPromises);

      const startTime = Date.now();

      // Run concurrent population operations
      const populationPromises = setups.map(({ orgId, dataDir }) => {
        const populator = new MasterCatalogPopulator(dataDir, orgId);
        return populator.populateFromImports({
          organizationId: orgId,
          batchSize: 50,
          skipExisting: false,
          dryRun: false,
          platforms: ['shopee']
        });
      });

      const results = await Promise.all(populationPromises);
      const endTime = Date.now();

      // Verify all operations succeeded
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.totalProcessed).toBe(productCount);
      });

      const totalDuration = endTime - startTime;
      console.log(`Concurrent operations (${concurrentOperations} x ${productCount} products): ${totalDuration}ms`);

      // Should complete within reasonable time
      expect(totalDuration).toBeLessThan(120000); // Less than 2 minutes

      // Cleanup concurrent test directories
      await Promise.all(setups.map(({ dataDir }) => 
        fs.rm(dataDir, { recursive: true, force: true }).catch(() => {})
      ));
    }, 180000);

    it('should handle concurrent validation operations', async () => {
      const productCount = 200;

      // Set up test data
      await shopeeImporter.importMockData({
        outputDir: testDataDir,
        productCount,
        batchSize: 50
      });

      await catalogPopulator.populateFromImports({
        organizationId,
        batchSize: 50,
        skipExisting: false,
        dryRun: false,
        platforms: ['shopee']
      });

      const startTime = Date.now();

      // Run multiple concurrent validations
      const validationPromises = Array.from({ length: 3 }, () => 
        validator.validateAllProducts()
      );

      const validationResults = await Promise.all(validationPromises);
      const endTime = Date.now();

      // All validations should return consistent results
      validationResults.forEach(result => {
        expect(result.totalProducts).toBe(productCount);
        expect(result.validProducts).toBeGreaterThan(0);
      });

      const duration = endTime - startTime;
      console.log(`Concurrent validation operations: ${duration}ms`);

      // Should complete efficiently
      expect(duration).toBeLessThan(30000); // Less than 30 seconds
    }, 60000);
  });

  describe('Database Performance', () => {
    it('should maintain query performance with large datasets', async () => {
      const productCount = 800;

      // Import and populate large dataset
      await shopeeImporter.importMockData({
        outputDir: testDataDir,
        productCount,
        batchSize: 100
      });

      const populationResult = await catalogPopulator.populateFromImports({
        organizationId,
        batchSize: 100,
        skipExisting: false,
        dryRun: false,
        platforms: ['shopee']
      });

      expect(populationResult.success).toBe(true);

      // Test query performance
      const queryStartTime = Date.now();
      const validationResult = await validator.validateAllProducts();
      const queryEndTime = Date.now();

      const queryDuration = queryEndTime - queryStartTime;

      expect(validationResult.totalProducts).toBe(productCount);
      
      console.log(`Database query performance (${productCount} products): ${queryDuration}ms`);

      // Query should be fast even with large dataset
      expect(queryDuration).toBeLessThan(5000); // Less than 5 seconds
    }, 120000);

    it('should handle batch inserts efficiently', async () => {
      const batchSizes = [25, 50, 100, 200];
      const productCount = 400;
      const results: Array<{ batchSize: number; duration: number; throughput: number }> = [];

      for (const batchSize of batchSizes) {
        // Clean up and prepare
        await fs.rm(testDataDir, { recursive: true, force: true });
        await fs.mkdir(testDataDir, { recursive: true });

        await shopeeImporter.importMockData({
          outputDir: testDataDir,
          productCount,
          batchSize: 50
        });

        const startTime = Date.now();

        const result = await catalogPopulator.populateFromImports({
          organizationId: `${organizationId}_batch_${batchSize}`,
          batchSize,
          skipExisting: false,
          dryRun: false,
          platforms: ['shopee']
        });

        const endTime = Date.now();
        const duration = endTime - startTime;
        const throughput = productCount / (duration / 1000); // products per second

        results.push({ batchSize, duration, throughput });

        expect(result.success).toBe(true);
        expect(result.totalProcessed).toBe(productCount);
      }

      // Log batch performance comparison
      console.log('Batch insert performance:');
      results.forEach(({ batchSize, duration, throughput }) => {
        console.log(`  Batch size ${batchSize}: ${duration}ms (${throughput.toFixed(2)} products/sec)`);
      });

      // All batch sizes should achieve reasonable throughput
      results.forEach(({ throughput }) => {
        expect(throughput).toBeGreaterThan(1); // At least 1 product per second
      });
    }, 300000); // 5 minute timeout
  });
});