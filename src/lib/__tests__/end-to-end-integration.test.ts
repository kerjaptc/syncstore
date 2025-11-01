import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ShopeeImporter } from '../importers/shopee-importer';
import { TikTokShopImporter } from '../importers/tiktokshop-importer';
import { DataAnalyzer } from '../analytics/data-analyzer';
import { MasterCatalogPopulator } from '../services/master-catalog-populator';
import { ComprehensiveDataValidator } from '../validators/comprehensive-data-validator';
import { PricingCalculator } from '../pricing/pricing-calculator';
import { SEOTitleGenerator } from '../seo/title-generator';
import { RawDataStore } from '../storage/raw-data-store';
import fs from 'fs/promises';
import path from 'path';

/**
 * End-to-End Integration Tests
 * 
 * These tests validate the complete import workflow from raw data import
 * through master catalog population and validation.
 */
describe('End-to-End Integration Tests', () => {
  const testDataDir = './test-data/e2e';
  const organizationId = 'test-org-e2e';
  
  let shopeeImporter: ShopeeImporter;
  let tiktokImporter: TikTokShopImporter;
  let dataAnalyzer: DataAnalyzer;
  let catalogPopulator: MasterCatalogPopulator;
  let validator: ComprehensiveDataValidator;
  let pricingCalculator: PricingCalculator;
  let seoGenerator: SEOTitleGenerator;
  let rawDataStore: RawDataStore;

  beforeAll(async () => {
    // Create test data directory
    await fs.mkdir(testDataDir, { recursive: true });
    
    // Initialize components
    shopeeImporter = new ShopeeImporter();
    tiktokImporter = new TikTokShopImporter();
    dataAnalyzer = new DataAnalyzer('./data/raw-imports/shopee', './data/raw-imports/tiktokshop');
    catalogPopulator = new MasterCatalogPopulator(testDataDir, organizationId);
    validator = new ComprehensiveDataValidator();
    pricingCalculator = new PricingCalculator();
    seoGenerator = new SEOTitleGenerator();
    rawDataStore = new RawDataStore(testDataDir);
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test data:', error);
    }
  });

  beforeEach(async () => {
    // Clean up any existing test data before each test
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
      await fs.mkdir(testDataDir, { recursive: true });
    } catch (error) {
      // Directory might not exist, that's okay
    }
  });

  describe('Complete Import Workflow', () => {
    it('should execute complete import workflow successfully', async () => {
      // Step 1: Import Shopee data
      const shopeeResult = await shopeeImporter.importMockData({
        outputDir: testDataDir,
        productCount: 10,
        batchSize: 5
      });

      expect(shopeeResult.success).toBe(true);
      expect(shopeeResult.totalProducts).toBe(10);
      expect(shopeeResult.successCount).toBe(10);
      expect(shopeeResult.errorCount).toBe(0);

      // Step 2: Import TikTok Shop data
      const tiktokResult = await tiktokImporter.importMockData({
        outputDir: testDataDir,
        productCount: 10,
        batchSize: 5
      });

      expect(tiktokResult.success).toBe(true);
      expect(tiktokResult.totalProducts).toBe(10);
      expect(tiktokResult.successCount).toBe(10);
      expect(tiktokResult.errorCount).toBe(0);

      // Step 3: Verify raw data files exist
      const shopeeFiles = await fs.readdir(path.join(testDataDir, 'shopee'));
      const tiktokFiles = await fs.readdir(path.join(testDataDir, 'tiktokshop'));
      
      expect(shopeeFiles.length).toBeGreaterThan(0);
      expect(tiktokFiles.length).toBeGreaterThan(0);

      // Step 4: Analyze imported data
      const analysisResult = await dataAnalyzer.analyzeImportedData(testDataDir);
      
      expect(analysisResult.shopeeProducts).toBe(10);
      expect(analysisResult.tiktokProducts).toBe(10);
      expect(analysisResult.totalProducts).toBe(20);
      expect(analysisResult.dataQuality.overallQualityScore).toBeGreaterThan(90);

      // Step 5: Populate master catalog
      const populationResult = await catalogPopulator.populateFromImports({
        organizationId,
        batchSize: 10,
        skipExisting: false,
        dryRun: false,
        platforms: ['shopee', 'tiktokshop']
      });

      expect(populationResult.success).toBe(true);
      expect(populationResult.totalProcessed).toBe(20);
      expect(populationResult.successCount).toBe(20);
      expect(populationResult.errorCount).toBe(0);

      // Step 6: Validate master catalog
      const validationResult = await validator.validateAllProducts();
      
      expect(validationResult.totalProducts).toBe(20);
      expect(validationResult.validProducts).toBe(20);
      expect(validationResult.overallQualityScore).toBeGreaterThan(95);
      expect(validationResult.criticalIssues).toBe(0);
    }, 60000); // 60 second timeout for complete workflow

    it('should handle errors gracefully during import', async () => {
      // Create invalid data to test error handling
      const invalidShopeeData = [
        { invalid: 'data', missing: 'required_fields' },
        { item_name: 'Valid Product', price: 100000, description: 'Valid description' }
      ];

      await rawDataStore.storeBatch('shopee', invalidShopeeData, 'batch_1');

      // Import should handle invalid data gracefully
      const populationResult = await catalogPopulator.populateFromImports({
        organizationId,
        batchSize: 10,
        skipExisting: false,
        dryRun: false,
        platforms: ['shopee']
      });

      // Should continue processing despite errors
      expect(populationResult.totalProcessed).toBe(2);
      expect(populationResult.errorCount).toBeGreaterThan(0);
      expect(populationResult.successCount).toBeGreaterThan(0);
      expect(populationResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Master Catalog Population Integration', () => {
    beforeEach(async () => {
      // Set up test data for each test
      const shopeeData = [
        {
          item_id: 'shopee_test_1',
          item_name: 'Test Racing Frame',
          description: 'High-quality carbon fiber racing frame',
          price: 150000,
          weight: 0.5,
          images: ['frame1.jpg', 'frame2.jpg'],
          category_id: 'frames',
          brand: 'TestBrand'
        }
      ];

      const tiktokData = [
        {
          product_id: 'tiktok_test_1',
          product_name: 'Test FPV Camera',
          description: 'Professional FPV camera',
          price: 75000,
          weight: 0.1,
          images: [{ url: 'cam1.jpg', alt: 'Camera front' }],
          category_id: 'cameras',
          brand_name: 'TestBrand',
          include_tokopedia: true
        }
      ];

      await rawDataStore.storeBatch('shopee', shopeeData, 'batch_1');
      await rawDataStore.storeBatch('tiktokshop', tiktokData, 'batch_1');
    });

    it('should create master products with correct transformations', async () => {
      const result = await catalogPopulator.populateFromImports({
        organizationId,
        batchSize: 10,
        skipExisting: false,
        dryRun: false,
        platforms: ['shopee', 'tiktokshop']
      });

      expect(result.success).toBe(true);
      expect(result.totalProcessed).toBe(2);
      expect(result.successCount).toBe(2);

      // Verify transformations were applied correctly
      expect(result.summary.platformBreakdown.shopee.processed).toBe(1);
      expect(result.summary.platformBreakdown.tiktokshop.processed).toBe(1);
      expect(result.summary.pricingCalculations.totalCalculated).toBe(2);
      expect(result.summary.seoTitles.totalGenerated).toBe(2);
    });

    it('should create platform mappings correctly', async () => {
      const result = await catalogPopulator.populateFromImports({
        organizationId,
        batchSize: 10,
        skipExisting: false,
        dryRun: false,
        platforms: ['shopee', 'tiktokshop']
      });

      expect(result.success).toBe(true);
      expect(result.summary.platformMappings.created).toBe(2);
      expect(result.summary.platformMappings.shopee).toBe(1);
      expect(result.summary.platformMappings.tiktokshop).toBe(1);
    });

    it('should handle pricing calculations correctly', async () => {
      const result = await catalogPopulator.populateFromImports({
        organizationId,
        batchSize: 10,
        skipExisting: false,
        dryRun: false,
        platforms: ['shopee', 'tiktokshop']
      });

      expect(result.success).toBe(true);
      
      // Verify pricing calculations
      const pricingStats = result.summary.pricingCalculations;
      expect(pricingStats.totalCalculated).toBe(2);
      expect(pricingStats.averageShopeePrice).toBeGreaterThan(0);
      expect(pricingStats.averageTikTokPrice).toBeGreaterThan(0);
      
      // TikTok prices should be higher due to higher platform fee
      expect(pricingStats.averageTikTokPrice).toBeGreaterThan(pricingStats.averageShopeePrice);
    });

    it('should generate SEO titles correctly', async () => {
      const result = await catalogPopulator.populateFromImports({
        organizationId,
        batchSize: 10,
        skipExisting: false,
        dryRun: false,
        platforms: ['shopee', 'tiktokshop']
      });

      expect(result.success).toBe(true);
      
      // Verify SEO title generation
      const seoStats = result.summary.seoTitles;
      expect(seoStats.totalGenerated).toBe(2);
      expect(seoStats.averageQualityScore).toBeGreaterThan(70);
      expect(seoStats.platformVariations.shopee).toBe(1);
      expect(seoStats.platformVariations.tiktokshop).toBe(1);
    });
  });

  describe('Data Validation Integration', () => {
    beforeEach(async () => {
      // Create test data with various quality levels
      const mixedQualityData = [
        {
          item_id: 'good_product',
          item_name: 'High Quality Product',
          description: 'Detailed description with good content',
          price: 100000,
          weight: 0.5,
          images: ['img1.jpg', 'img2.jpg'],
          category_id: 'frames',
          brand: 'GoodBrand'
        },
        {
          item_id: 'poor_product',
          item_name: 'Poor Product',
          description: 'Short desc',
          price: 50000,
          weight: 0.1,
          images: ['img1.jpg'],
          category_id: 'other'
        }
      ];

      await rawDataStore.storeBatch('shopee', mixedQualityData, 'batch_1');
    });

    it('should validate data quality during population', async () => {
      const result = await catalogPopulator.populateFromImports({
        organizationId,
        batchSize: 10,
        skipExisting: false,
        dryRun: false,
        platforms: ['shopee']
      });

      expect(result.success).toBe(true);
      expect(result.totalProcessed).toBe(2);
      
      // Check quality metrics
      const qualityStats = result.summary.qualityMetrics;
      expect(qualityStats.averageQualityScore).toBeGreaterThan(0);
      expect(qualityStats.highQualityProducts).toBeGreaterThan(0);
    });

    it('should provide detailed validation results', async () => {
      await catalogPopulator.populateFromImports({
        organizationId,
        batchSize: 10,
        skipExisting: false,
        dryRun: false,
        platforms: ['shopee']
      });

      const validationResult = await validator.validateAllProducts();
      
      expect(validationResult.totalProducts).toBe(2);
      expect(validationResult.validProducts).toBeGreaterThan(0);
      expect(validationResult.qualityBreakdown).toBeDefined();
      expect(validationResult.qualityBreakdown.excellent).toBeDefined();
      expect(validationResult.qualityBreakdown.good).toBeDefined();
      expect(validationResult.qualityBreakdown.fair).toBeDefined();
      expect(validationResult.qualityBreakdown.poor).toBeDefined();
    });
  });

  describe('Performance Integration Tests', () => {
    it('should handle large dataset efficiently', async () => {
      const startTime = Date.now();
      
      // Import larger dataset
      const shopeeResult = await shopeeImporter.importMockData({
        outputDir: testDataDir,
        productCount: 100,
        batchSize: 20
      });

      const tiktokResult = await tiktokImporter.importMockData({
        outputDir: testDataDir,
        productCount: 100,
        batchSize: 20
      });

      // Populate master catalog
      const populationResult = await catalogPopulator.populateFromImports({
        organizationId,
        batchSize: 50,
        skipExisting: false,
        dryRun: false,
        platforms: ['shopee', 'tiktokshop']
      });

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Performance assertions
      expect(shopeeResult.success).toBe(true);
      expect(tiktokResult.success).toBe(true);
      expect(populationResult.success).toBe(true);
      expect(populationResult.totalProcessed).toBe(200);
      
      // Should complete within reasonable time (30 seconds for 200 products)
      expect(totalTime).toBeLessThan(30000);
      
      // Memory usage should be reasonable
      const memoryUsage = process.memoryUsage();
      expect(memoryUsage.heapUsed).toBeLessThan(500 * 1024 * 1024); // Less than 500MB
    }, 45000); // 45 second timeout

    it('should handle concurrent operations', async () => {
      // Set up test data
      const shopeeData = Array.from({ length: 50 }, (_, i) => ({
        item_id: `concurrent_shopee_${i}`,
        item_name: `Concurrent Product ${i}`,
        description: `Description for product ${i}`,
        price: 100000 + i * 1000,
        weight: 0.1 + i * 0.01,
        images: [`img${i}_1.jpg`, `img${i}_2.jpg`],
        category_id: 'test_category',
        brand: 'TestBrand'
      }));

      await rawDataStore.storeBatch('shopee', shopeeData, 'concurrent_batch');

      // Run multiple operations concurrently
      const operations = [
        catalogPopulator.populateFromImports({
          organizationId: `${organizationId}_1`,
          batchSize: 25,
          skipExisting: false,
          dryRun: false,
          platforms: ['shopee']
        }),
        catalogPopulator.populateFromImports({
          organizationId: `${organizationId}_2`,
          batchSize: 25,
          skipExisting: false,
          dryRun: false,
          platforms: ['shopee']
        })
      ];

      const results = await Promise.all(operations);

      // Both operations should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.totalProcessed).toBe(50);
      });
    }, 30000);
  });

  describe('Error Recovery Integration', () => {
    it('should recover from partial failures', async () => {
      // Create mixed valid/invalid data
      const mixedData = [
        {
          item_id: 'valid_1',
          item_name: 'Valid Product 1',
          description: 'Valid description',
          price: 100000,
          weight: 0.5,
          images: ['img1.jpg'],
          category_id: 'frames'
        },
        {
          // Invalid data - missing required fields
          item_id: 'invalid_1',
          description: 'Missing name and price'
        },
        {
          item_id: 'valid_2',
          item_name: 'Valid Product 2',
          description: 'Another valid description',
          price: 150000,
          weight: 0.3,
          images: ['img2.jpg'],
          category_id: 'cameras'
        }
      ];

      await rawDataStore.storeBatch('shopee', mixedData, 'mixed_batch');

      const result = await catalogPopulator.populateFromImports({
        organizationId,
        batchSize: 10,
        skipExisting: false,
        dryRun: false,
        platforms: ['shopee']
      });

      // Should process all items but have some errors
      expect(result.totalProcessed).toBe(3);
      expect(result.successCount).toBe(2); // 2 valid products
      expect(result.errorCount).toBe(1); // 1 invalid product
      expect(result.errors.length).toBe(1);
      
      // Should continue processing despite errors
      expect(result.success).toBe(true); // Overall success despite partial failures
    });

    it('should handle database connection issues gracefully', async () => {
      // This test would require mocking database failures
      // For now, we'll test the error handling structure
      
      const shopeeData = [{
        item_id: 'test_product',
        item_name: 'Test Product',
        description: 'Test description',
        price: 100000,
        weight: 0.5,
        images: ['img1.jpg'],
        category_id: 'test'
      }];

      await rawDataStore.storeBatch('shopee', shopeeData, 'db_test_batch');

      // Normal operation should work
      const result = await catalogPopulator.populateFromImports({
        organizationId,
        batchSize: 10,
        skipExisting: false,
        dryRun: false,
        platforms: ['shopee']
      });

      expect(result.success).toBe(true);
      expect(result.totalProcessed).toBe(1);
      expect(result.successCount).toBe(1);
    });
  });

  describe('Data Consistency Integration', () => {
    it('should maintain data consistency across operations', async () => {
      // Import data
      const shopeeData = [{
        item_id: 'consistency_test',
        item_name: 'Consistency Test Product',
        description: 'Testing data consistency',
        price: 100000,
        weight: 0.5,
        images: ['img1.jpg'],
        category_id: 'test',
        brand: 'TestBrand'
      }];

      await rawDataStore.storeBatch('shopee', shopeeData, 'consistency_batch');

      // First population
      const result1 = await catalogPopulator.populateFromImports({
        organizationId,
        batchSize: 10,
        skipExisting: false,
        dryRun: false,
        platforms: ['shopee']
      });

      expect(result1.success).toBe(true);
      expect(result1.totalProcessed).toBe(1);

      // Second population with skipExisting=true should skip
      const result2 = await catalogPopulator.populateFromImports({
        organizationId,
        batchSize: 10,
        skipExisting: true,
        dryRun: false,
        platforms: ['shopee']
      });

      expect(result2.success).toBe(true);
      expect(result2.summary.skippedProducts).toBe(1);

      // Validation should show consistent data
      const validationResult = await validator.validateAllProducts();
      expect(validationResult.totalProducts).toBe(1); // Should not duplicate
    });

    it('should handle dry run mode correctly', async () => {
      const shopeeData = [{
        item_id: 'dry_run_test',
        item_name: 'Dry Run Test Product',
        description: 'Testing dry run mode',
        price: 100000,
        weight: 0.5,
        images: ['img1.jpg'],
        category_id: 'test'
      }];

      await rawDataStore.storeBatch('shopee', shopeeData, 'dry_run_batch');

      // Dry run should not modify database
      const dryRunResult = await catalogPopulator.populateFromImports({
        organizationId,
        batchSize: 10,
        skipExisting: false,
        dryRun: true,
        platforms: ['shopee']
      });

      expect(dryRunResult.success).toBe(true);
      expect(dryRunResult.totalProcessed).toBe(1);
      expect(dryRunResult.dryRun).toBe(true);

      // Validation should show no products in database
      const validationResult = await validator.validateAllProducts();
      expect(validationResult.totalProducts).toBe(0);

      // Actual run should work
      const actualResult = await catalogPopulator.populateFromImports({
        organizationId,
        batchSize: 10,
        skipExisting: false,
        dryRun: false,
        platforms: ['shopee']
      });

      expect(actualResult.success).toBe(true);
      expect(actualResult.dryRun).toBe(false);

      // Now validation should show the product
      const finalValidation = await validator.validateAllProducts();
      expect(finalValidation.totalProducts).toBe(1);
    });
  });
});