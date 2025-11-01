import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';

// Import DataAnalyzer dynamically to avoid module issues
const { DataAnalyzer } = await import('../analytics/data-analyzer');

// Mock fs modules
vi.mock('fs/promises');
vi.mock('fs');

describe('DataAnalyzer', () => {
  let analyzer: InstanceType<typeof DataAnalyzer>;
  let mockShopeeProducts: any[];
  let mockTikTokProducts: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    analyzer = new DataAnalyzer('./test/shopee', './test/tiktok');

    // Mock Shopee products
    mockShopeeProducts = [
      {
        item_id: 'shopee_1',
        item_name: 'Racing Frame 5 Inch Carbon Fiber',
        price: 150000,
        images: ['img1.jpg', 'img2.jpg'],
        weight: 0.5,
        category_id: 'frames'
      },
      {
        item_id: 'shopee_2',
        item_name: 'FPV Camera 1200TVL',
        price: 75000,
        images: ['cam1.jpg'],
        weight: 0.1,
        category_id: 'cameras'
      },
      {
        item_id: 'shopee_3',
        item_name: 'Propeller 9 Inch High Performance',
        price: 25000,
        images: ['prop1.jpg', 'prop2.jpg', 'prop3.jpg'],
        weight: 0.05,
        category_id: 'propellers'
      }
    ];

    // Mock TikTok products
    mockTikTokProducts = [
      {
        product_id: 'tiktok_1',
        product_name: 'Racing Frame 5 Inch Carbon',
        price: 155000,
        images: [{ url: 'img1.jpg' }, { url: 'img2.jpg' }],
        weight: 0.5,
        category_id: 'frames',
        include_tokopedia: true
      },
      {
        product_id: 'tiktok_2',
        product_name: 'FPV Camera 1200TVL HD',
        price: 78000,
        images: [{ url: 'cam1.jpg' }],
        weight: 0.1,
        category_id: 'cameras',
        include_tokopedia: false
      },
      {
        product_id: 'tiktok_4',
        product_name: 'ESC 4in1 35A',
        price: 120000,
        images: [{ url: 'esc1.jpg' }],
        weight: 0.2,
        category_id: 'esc',
        include_tokopedia: true
      }
    ];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loadShopeeProducts', () => {
    it('should load Shopee products from storage', async () => {
      (existsSync as any).mockReturnValue(true);
      (readdir as any).mockResolvedValue(['product_1.json', 'product_2.json', 'other.txt']);
      (readFile as any)
        .mockResolvedValueOnce(JSON.stringify({ data: mockShopeeProducts[0] }))
        .mockResolvedValueOnce(JSON.stringify({ data: mockShopeeProducts[1] }));

      const products = await analyzer.loadShopeeProducts();

      expect(products).toHaveLength(2);
      expect(products[0].item_id).toBe('shopee_1');
      expect(products[1].item_id).toBe('shopee_2');
    });

    it('should handle missing directory gracefully', async () => {
      (existsSync as any).mockReturnValue(false);

      const products = await analyzer.loadShopeeProducts();

      expect(products).toHaveLength(0);
    });

    it('should handle file read errors gracefully', async () => {
      (existsSync as any).mockReturnValue(true);
      (readdir as any).mockResolvedValue(['product_1.json', 'product_2.json']);
      (readFile as any)
        .mockResolvedValueOnce(JSON.stringify({ data: mockShopeeProducts[0] }))
        .mockRejectedValueOnce(new Error('File read error'));

      const products = await analyzer.loadShopeeProducts();

      expect(products).toHaveLength(1);
      expect(products[0].item_id).toBe('shopee_1');
    });
  });

  describe('loadTikTokProducts', () => {
    it('should load TikTok products from storage', async () => {
      (existsSync as any).mockReturnValue(true);
      (readdir as any).mockResolvedValue(['product_1.json', 'product_2.json']);
      (readFile as any)
        .mockResolvedValueOnce(JSON.stringify({ data: mockTikTokProducts[0] }))
        .mockResolvedValueOnce(JSON.stringify({ data: mockTikTokProducts[1] }));

      const products = await analyzer.loadTikTokProducts();

      expect(products).toHaveLength(2);
      expect(products[0].product_id).toBe('tiktok_1');
      expect(products[1].product_id).toBe('tiktok_2');
    });

    it('should handle missing directory gracefully', async () => {
      (existsSync as any).mockReturnValue(false);

      const products = await analyzer.loadTikTokProducts();

      expect(products).toHaveLength(0);
    });
  });

  describe('calculateProductOverlap', () => {
    beforeEach(() => {
      // Mock the load methods
      vi.spyOn(analyzer, 'loadShopeeProducts').mockResolvedValue(mockShopeeProducts);
      vi.spyOn(analyzer, 'loadTikTokProducts').mockResolvedValue(mockTikTokProducts);
    });

    it('should calculate product overlap correctly', async () => {
      const overlap = await analyzer.calculateProductOverlap();

      expect(overlap.totalShopeeProducts).toBe(3);
      expect(overlap.totalTikTokProducts).toBe(3);
      expect(overlap.commonProducts).toBeGreaterThan(0);
      expect(overlap.overlapPercentage).toBeGreaterThan(0);
      expect(Array.isArray(overlap.shopeeOnlyProducts)).toBe(true);
      expect(Array.isArray(overlap.tiktokOnlyProducts)).toBe(true);
      expect(Array.isArray(overlap.similarProducts)).toBe(true);
    });

    it('should identify similar products correctly', async () => {
      const overlap = await analyzer.calculateProductOverlap();

      // Should find at least 2 similar products (Racing Frame and FPV Camera)
      expect(overlap.similarProducts.length).toBeGreaterThanOrEqual(2);
      
      const racingFrameMatch = overlap.similarProducts.find(
        match => match.shopeeProduct.item_name.includes('Racing Frame')
      );
      expect(racingFrameMatch).toBeDefined();
      expect(racingFrameMatch?.similarityScore).toBeGreaterThan(0.7);
    });

    it('should handle empty product lists', async () => {
      vi.spyOn(analyzer, 'loadShopeeProducts').mockResolvedValue([]);
      vi.spyOn(analyzer, 'loadTikTokProducts').mockResolvedValue([]);

      const overlap = await analyzer.calculateProductOverlap();

      expect(overlap.totalShopeeProducts).toBe(0);
      expect(overlap.totalTikTokProducts).toBe(0);
      expect(overlap.commonProducts).toBe(0);
      expect(overlap.overlapPercentage).toBe(0);
    });
  });

  describe('analyzeFieldMappings', () => {
    beforeEach(() => {
      vi.spyOn(analyzer, 'loadShopeeProducts').mockResolvedValue(mockShopeeProducts);
      vi.spyOn(analyzer, 'loadTikTokProducts').mockResolvedValue(mockTikTokProducts);
    });

    it('should analyze field mappings correctly', async () => {
      const fieldMapping = await analyzer.analyzeFieldMappings();

      expect(fieldMapping.commonFields).toBeDefined();
      expect(fieldMapping.shopeeOnlyFields).toBeDefined();
      expect(fieldMapping.tiktokOnlyFields).toBeDefined();
      expect(fieldMapping.fieldOverlapPercentage).toBeGreaterThan(0);

      // Should find common fields like price, weight, category_id
      const priceField = fieldMapping.commonFields.find(f => f.fieldName === 'price');
      expect(priceField).toBeDefined();
      expect(priceField?.dataType).toBe('number');
    });

    it('should identify platform-specific fields', async () => {
      const fieldMapping = await analyzer.analyzeFieldMappings();

      // Should identify item_id as Shopee-only and product_id as TikTok-only
      const shopeeItemId = fieldMapping.shopeeOnlyFields.find(f => f.fieldName === 'item_id');
      const tiktokProductId = fieldMapping.tiktokOnlyFields.find(f => f.fieldName === 'product_id');

      expect(shopeeItemId || tiktokProductId).toBeDefined(); // At least one should be platform-specific
    });

    it('should calculate field overlap percentage', async () => {
      const fieldMapping = await analyzer.analyzeFieldMappings();

      expect(fieldMapping.fieldOverlapPercentage).toBeGreaterThanOrEqual(0);
      expect(fieldMapping.fieldOverlapPercentage).toBeLessThanOrEqual(100);
    });
  });

  describe('analyzeDataQuality', () => {
    beforeEach(() => {
      vi.spyOn(analyzer, 'loadShopeeProducts').mockResolvedValue(mockShopeeProducts);
      vi.spyOn(analyzer, 'loadTikTokProducts').mockResolvedValue(mockTikTokProducts);
    });

    it('should analyze data quality correctly', async () => {
      const quality = await analyzer.analyzeDataQuality();

      expect(quality.shopeeQuality).toBeDefined();
      expect(quality.tiktokQuality).toBeDefined();
      expect(quality.overallQuality).toBeDefined();

      expect(quality.shopeeQuality.totalProducts).toBe(3);
      expect(quality.tiktokQuality.totalProducts).toBe(3);
      expect(quality.overallQuality.totalProducts).toBe(6);
    });

    it('should calculate quality scores', async () => {
      const quality = await analyzer.analyzeDataQuality();

      expect(quality.shopeeQuality.qualityScore).toBeGreaterThan(0);
      expect(quality.tiktokQuality.qualityScore).toBeGreaterThan(0);
      expect(quality.overallQuality.qualityScore).toBeGreaterThan(0);
    });

    it('should track Tokopedia enabled products', async () => {
      const quality = await analyzer.analyzeDataQuality();

      expect(quality.tiktokQuality.tokopediaEnabledCount).toBe(2); // 2 products have include_tokopedia: true
    });

    it('should identify data quality issues', async () => {
      // Mock products with quality issues
      const badShopeeProducts = [
        { item_id: 'bad_1', item_name: '', price: 0, images: [] }, // Missing title, invalid price, no images
        { item_id: 'bad_2', item_name: 'Good Product', price: 100, images: ['img1.jpg'] } // Good product
      ];

      vi.spyOn(analyzer, 'loadShopeeProducts').mockResolvedValue(badShopeeProducts);
      vi.spyOn(analyzer, 'loadTikTokProducts').mockResolvedValue([]);

      const quality = await analyzer.analyzeDataQuality();

      expect(quality.shopeeQuality.missingRequiredFields).toBeGreaterThan(0);
      expect(quality.shopeeQuality.invalidPrices).toBeGreaterThan(0);
      expect(quality.shopeeQuality.missingImages).toBeGreaterThan(0);
      expect(quality.shopeeQuality.qualityScore).toBeLessThan(100);
    });
  });

  describe('generateComparisonReport', () => {
    beforeEach(() => {
      vi.spyOn(analyzer, 'loadShopeeProducts').mockResolvedValue(mockShopeeProducts);
      vi.spyOn(analyzer, 'loadTikTokProducts').mockResolvedValue(mockTikTokProducts);
    });

    it('should generate comprehensive comparison report', async () => {
      const report = await analyzer.generateComparisonReport();

      expect(report.summary).toBeDefined();
      expect(report.productOverlap).toBeDefined();
      expect(report.fieldMapping).toBeDefined();
      expect(report.dataQuality).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.nextSteps).toBeDefined();

      expect(report.summary.analysisDate).toBeInstanceOf(Date);
      expect(report.summary.analysisVersion).toBe('1.0.0');
    });

    it('should provide recommendations based on analysis', async () => {
      const report = await analyzer.generateComparisonReport();

      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(Array.isArray(report.nextSteps)).toBe(true);
      expect(report.nextSteps.length).toBeGreaterThan(0);
    });

    it('should include next steps for schema design', async () => {
      const report = await analyzer.generateComparisonReport();

      const schemaStep = report.nextSteps.find(step => 
        step.includes('master product schema')
      );
      expect(schemaStep).toBeDefined();
    });
  });

  describe('String similarity calculation', () => {
    it('should calculate string similarity correctly', async () => {
      // Access private method through any cast for testing
      const similarity1 = (analyzer as any).calculateStringSimilarity('hello world', 'hello world');
      expect(similarity1).toBe(1);

      const similarity2 = (analyzer as any).calculateStringSimilarity('hello world', 'hello');
      expect(similarity2).toBeGreaterThan(0);
      expect(similarity2).toBeLessThan(1);

      const similarity3 = (analyzer as any).calculateStringSimilarity('completely different', 'hello world');
      expect(similarity3).toBeLessThan(0.5);
    });
  });

  describe('Product similarity calculation', () => {
    it('should calculate product similarity correctly', async () => {
      const shopeeProduct = mockShopeeProducts[0]; // Racing Frame
      const tiktokProduct = mockTikTokProducts[0]; // Racing Frame

      const similarity = (analyzer as any).calculateProductSimilarity(shopeeProduct, tiktokProduct);

      expect(similarity.score).toBeGreaterThan(0.7); // Should be high similarity
      expect(similarity.matchingFields).toContain('title');
      expect(similarity.matchingFields).toContain('category');
    });

    it('should identify low similarity for different products', async () => {
      const shopeeProduct = mockShopeeProducts[0]; // Racing Frame
      const tiktokProduct = mockTikTokProducts[2]; // ESC

      const similarity = (analyzer as any).calculateProductSimilarity(shopeeProduct, tiktokProduct);

      expect(similarity.score).toBeLessThan(0.5); // Should be low similarity
    });
  });

  describe('Data type detection', () => {
    it('should detect data types correctly', async () => {
      const getDataType = (analyzer as any).getDataType.bind(analyzer);

      expect(getDataType('string')).toBe('string');
      expect(getDataType(123)).toBe('integer');
      expect(getDataType(123.45)).toBe('number');
      expect(getDataType(true)).toBe('boolean');
      expect(getDataType([])).toBe('array');
      expect(getDataType({})).toBe('object');
      expect(getDataType(null)).toBe('null');
      expect(getDataType(undefined)).toBe('null');
    });
  });
});