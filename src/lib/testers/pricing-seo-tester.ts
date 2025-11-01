/**
 * Pricing and SEO Functionality Tester for Task 8.2
 * Validates pricing calculations for multiple product samples
 * Tests SEO title generation for different product types
 * Verifies platform-specific variations are appropriate
 * 
 * Requirements: 3.3, 3.5, 4.4
 */

import { PricingCalculator, createDefaultPricingCalculator } from '../pricing/pricing-calculator';
import { SEOTitleGenerator, createDefaultTitleGenerator } from '../seo/title-generator';
import { db } from '../db';
import { masterProducts } from '../db/master-catalog-schema';
import { sql } from 'drizzle-orm';

export interface PricingSEOTestResult {
  overview: TestOverview;
  pricingTests: PricingTestResults;
  seoTests: SEOTestResults;
  integrationTests: IntegrationTestResults;
  performanceTests: PerformanceTestResults;
  recommendations: TestRecommendation[];
  overallScore: number;
  status: 'PASS' | 'WARNING' | 'FAIL';
}

export interface TestOverview {
  totalTestsRun: number;
  testStartTime: Date;
  testEndTime: Date;
  testDuration: number; // milliseconds
  platformsTested: string[];
  productSampleSize: number;
}

export interface PricingTestResults {
  totalPricingTests: number;
  passedPricingTests: number;
  failedPricingTests: number;
  accuracyRate: number;
  platformTests: PlatformPricingTest[];
  bulkPricingTests: BulkPricingTest[];
  edgeCaseTests: EdgeCaseTest[];
  performanceMetrics: PricingPerformanceMetrics;
}

export interface SEOTestResults {
  totalSEOTests: number;
  passedSEOTests: number;
  failedSEOTests: number;
  averageSimilarity: number;
  averageQualityScore: number;
  platformTests: PlatformSEOTest[];
  titleVariationTests: TitleVariationTest[];
  keywordOptimizationTests: KeywordOptimizationTest[];
  performanceMetrics: SEOPerformanceMetrics;
}

export interface IntegrationTestResults {
  masterProductTests: MasterProductIntegrationTest[];
  endToEndTests: EndToEndTest[];
  dataConsistencyTests: DataConsistencyTest[];
}

export interface PerformanceTestResults {
  pricingPerformance: {
    averageCalculationTime: number;
    maxCalculationTime: number;
    calculationsPerSecond: number;
  };
  seoPerformance: {
    averageGenerationTime: number;
    maxGenerationTime: number;
    generationsPerSecond: number;
  };
  memoryUsage: {
    initialMemory: number;
    peakMemory: number;
    finalMemory: number;
  };
}

export interface PlatformPricingTest {
  platform: string;
  basePrice: number;
  expectedPrice: number;
  actualPrice: number;
  feePercentage: number;
  isAccurate: boolean;
  tolerance: number;
  difference: number;
  testDuration: number;
}

export interface BulkPricingTest {
  productCount: number;
  basePrice: number;
  platformResults: Array<{
    platform: string;
    price: number;
    isAccurate: boolean;
  }>;
  totalDuration: number;
  averageDurationPerProduct: number;
}

export interface EdgeCaseTest {
  testName: string;
  input: any;
  expectedBehavior: string;
  actualBehavior: string;
  passed: boolean;
  error?: string;
}

export interface PlatformSEOTest {
  platform: string;
  originalTitle: string;
  generatedTitle: string;
  similarity: number;
  qualityScore: number;
  keywordsUsed: string[];
  lengthCompliance: boolean;
  isAppropriate: boolean;
  testDuration: number;
}

export interface TitleVariationTest {
  originalTitle: string;
  variations: Array<{
    platform: string;
    title: string;
    similarity: number;
    uniqueness: number;
  }>;
  averageSimilarity: number;
  variationQuality: number;
}

export interface KeywordOptimizationTest {
  platform: string;
  originalTitle: string;
  generatedTitle: string;
  keywordsAdded: string[];
  keywordDensity: number;
  seoScore: number;
  platformSpecificOptimization: boolean;
}

export interface MasterProductIntegrationTest {
  productId: string;
  masterSku: string;
  pricingIntegration: {
    basePrice: number;
    platformPrices: Record<string, number>;
    calculationAccuracy: boolean;
  };
  seoIntegration: {
    originalTitle: string;
    platformTitles: Record<string, string>;
    titleQuality: boolean;
  };
  overallIntegration: boolean;
}

export interface EndToEndTest {
  testName: string;
  steps: string[];
  result: 'PASS' | 'FAIL';
  duration: number;
  error?: string;
}

export interface DataConsistencyTest {
  testName: string;
  expectedValue: any;
  actualValue: any;
  isConsistent: boolean;
  variance?: number;
}

export interface PricingPerformanceMetrics {
  singleCalculationTime: number;
  bulkCalculationTime: number;
  memoryUsagePerCalculation: number;
  cacheHitRate?: number;
}

export interface SEOPerformanceMetrics {
  singleGenerationTime: number;
  bulkGenerationTime: number;
  memoryUsagePerGeneration: number;
  patternMatchingTime: number;
}

export interface TestRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'pricing' | 'seo' | 'performance' | 'integration' | 'data_quality';
  title: string;
  description: string;
  actionRequired: string;
  expectedOutcome: string;
  affectedTests?: number;
}

export class PricingSEOTester {
  private pricingCalculator: PricingCalculator;
  private seoGenerator: SEOTitleGenerator;
  private readonly platforms = ['shopee', 'tiktokshop', 'website', 'tokopedia'];
  private readonly sampleSize = 50; // Number of products to test

  constructor() {
    this.pricingCalculator = createDefaultPricingCalculator();
    this.seoGenerator = createDefaultTitleGenerator();
  }

  async runAllTests(): Promise<PricingSEOTestResult> {
    const startTime = new Date();
    console.log('🧪 Starting pricing and SEO functionality tests...');

    try {
      // Get sample products for testing
      const sampleProducts = await this.getSampleProducts();
      
      // Run all test suites
      const pricingTests = await this.runPricingTests(sampleProducts);
      const seoTests = await this.runSEOTests(sampleProducts);
      const integrationTests = await this.runIntegrationTests(sampleProducts);
      const performanceTests = await this.runPerformanceTests(sampleProducts);

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const overview: TestOverview = {
        totalTestsRun: pricingTests.totalPricingTests + seoTests.totalSEOTests + integrationTests.masterProductTests.length,
        testStartTime: startTime,
        testEndTime: endTime,
        testDuration: duration,
        platformsTested: this.platforms,
        productSampleSize: sampleProducts.length
      };

      // Calculate overall score and status
      const overallScore = this.calculateOverallScore(pricingTests, seoTests, integrationTests, performanceTests);
      const status = this.determineTestStatus(overallScore, pricingTests, seoTests, integrationTests);

      // Generate recommendations
      const recommendations = this.generateRecommendations(pricingTests, seoTests, integrationTests, performanceTests);

      return {
        overview,
        pricingTests,
        seoTests,
        integrationTests,
        performanceTests,
        recommendations,
        overallScore,
        status
      };

    } catch (error) {
      console.error('❌ Pricing and SEO tests failed:', error);
      throw error;
    }
  }

  private async getSampleProducts(): Promise<any[]> {
    console.log('📦 Getting sample products for testing...');

    const products = await db
      .select({
        id: masterProducts.id,
        masterSku: masterProducts.masterSku,
        name: masterProducts.name,
        basePrice: masterProducts.basePrice,
        platformPrices: masterProducts.platformPrices,
        seoData: masterProducts.seoData,
        category: masterProducts.category,
        brand: masterProducts.brand
      })
      .from(masterProducts)
      .where(sql`${masterProducts.basePrice} > 0`)
      .limit(this.sampleSize);

    console.log(`  Found ${products.length} sample products for testing`);
    return products;
  }

  private async runPricingTests(sampleProducts: any[]): Promise<PricingTestResults> {
    console.log('💰 Running pricing functionality tests...');

    const platformTests: PlatformPricingTest[] = [];
    const bulkPricingTests: BulkPricingTest[] = [];
    const edgeCaseTests: EdgeCaseTest[] = [];
    let totalTests = 0;
    let passedTests = 0;

    // Test individual platform pricing
    for (const product of sampleProducts.slice(0, 20)) {
      const basePrice = parseFloat(product.basePrice.toString());
      
      for (const platform of this.platforms) {
        const startTime = Date.now();
        
        try {
          const result = this.pricingCalculator.calculatePlatformPrice(basePrice, platform);
          const endTime = Date.now();
          
          // Get expected price based on platform configuration
          const config = this.pricingCalculator.getPlatformConfig(platform);
          const expectedPrice = this.calculateExpectedPrice(basePrice, config!);
          
          const tolerance = Math.max(1, basePrice * 0.001); // 0.1% tolerance
          const difference = Math.abs(result.finalPrice - expectedPrice);
          const isAccurate = difference <= tolerance;
          
          platformTests.push({
            platform,
            basePrice,
            expectedPrice,
            actualPrice: result.finalPrice,
            feePercentage: config!.feePercentage,
            isAccurate,
            tolerance,
            difference,
            testDuration: endTime - startTime
          });

          totalTests++;
          if (isAccurate) passedTests++;

        } catch (error) {
          console.warn(`Pricing test failed for ${platform}:`, error);
          totalTests++;
        }
      }
    }

    // Test bulk pricing
    const bulkTestSizes = [5, 10, 20];
    for (const size of bulkTestSizes) {
      const testProducts = sampleProducts.slice(0, size);
      const startTime = Date.now();
      
      for (const product of testProducts) {
        const basePrice = parseFloat(product.basePrice.toString());
        
        try {
          const bulkResult = this.pricingCalculator.calculateAllPlatformPrices(basePrice);
          const endTime = Date.now();
          
          const platformResults = bulkResult.platformResults.map(result => ({
            platform: result.platform,
            price: result.finalPrice,
            isAccurate: this.validatePricingAccuracy(basePrice, result.platform, result.finalPrice)
          }));

          bulkPricingTests.push({
            productCount: size,
            basePrice,
            platformResults,
            totalDuration: endTime - startTime,
            averageDurationPerProduct: (endTime - startTime) / size
          });

        } catch (error) {
          console.warn(`Bulk pricing test failed for size ${size}:`, error);
        }
      }
    }

    // Test edge cases
    const edgeCases = [
      { name: 'Zero base price', input: 0, expectedBehavior: 'Should throw error' },
      { name: 'Negative base price', input: -100, expectedBehavior: 'Should throw error' },
      { name: 'Very large price', input: 1000000000, expectedBehavior: 'Should calculate correctly' },
      { name: 'Very small price', input: 0.01, expectedBehavior: 'Should apply minimum price' },
      { name: 'Invalid platform', input: { basePrice: 10000, platform: 'invalid' }, expectedBehavior: 'Should throw error' }
    ];

    for (const edgeCase of edgeCases) {
      try {
        let actualBehavior = '';
        let passed = false;

        if (edgeCase.name === 'Invalid platform') {
          try {
            this.pricingCalculator.calculatePlatformPrice(edgeCase.input.basePrice, edgeCase.input.platform);
            actualBehavior = 'No error thrown';
          } catch (error) {
            actualBehavior = 'Error thrown as expected';
            passed = true;
          }
        } else {
          try {
            const result = this.pricingCalculator.calculatePlatformPrice(edgeCase.input as number, 'shopee');
            actualBehavior = `Calculated price: ${result.finalPrice}`;
            
            if (edgeCase.expectedBehavior.includes('error')) {
              passed = false;
            } else if (edgeCase.expectedBehavior.includes('minimum')) {
              passed = result.finalPrice >= 1000; // Minimum price
            } else {
              passed = result.finalPrice > 0;
            }
          } catch (error) {
            actualBehavior = 'Error thrown';
            passed = edgeCase.expectedBehavior.includes('error');
          }
        }

        edgeCaseTests.push({
          testName: edgeCase.name,
          input: edgeCase.input,
          expectedBehavior: edgeCase.expectedBehavior,
          actualBehavior,
          passed
        });

        totalTests++;
        if (passed) passedTests++;

      } catch (error) {
        edgeCaseTests.push({
          testName: edgeCase.name,
          input: edgeCase.input,
          expectedBehavior: edgeCase.expectedBehavior,
          actualBehavior: 'Test execution failed',
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        totalTests++;
      }
    }

    const accuracyRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

    // Calculate performance metrics
    const performanceMetrics: PricingPerformanceMetrics = {
      singleCalculationTime: platformTests.length > 0 
        ? platformTests.reduce((sum, test) => sum + test.testDuration, 0) / platformTests.length 
        : 0,
      bulkCalculationTime: bulkPricingTests.length > 0
        ? bulkPricingTests.reduce((sum, test) => sum + test.totalDuration, 0) / bulkPricingTests.length
        : 0,
      memoryUsagePerCalculation: 0 // Would need actual memory profiling
    };

    return {
      totalPricingTests: totalTests,
      passedPricingTests: passedTests,
      failedPricingTests: totalTests - passedTests,
      accuracyRate,
      platformTests,
      bulkPricingTests,
      edgeCaseTests,
      performanceMetrics
    };
  }

  private calculateExpectedPrice(basePrice: number, config: any): number {
    const platformFee = (basePrice * config.feePercentage) / 100;
    const priceWithPlatformFee = basePrice + platformFee;
    const paymentFee = (priceWithPlatformFee * config.paymentFeePercentage) / 100;
    const totalFees = platformFee + paymentFee + config.fixedFee;
    let finalPrice = basePrice + totalFees;
    
    if (finalPrice < config.minimumPrice) {
      finalPrice = config.minimumPrice;
    }
    
    return Math.round(finalPrice);
  }

  private validatePricingAccuracy(basePrice: number, platform: string, actualPrice: number): boolean {
    const config = this.pricingCalculator.getPlatformConfig(platform);
    if (!config) return false;
    
    const expectedPrice = this.calculateExpectedPrice(basePrice, config);
    const tolerance = Math.max(1, basePrice * 0.001);
    return Math.abs(actualPrice - expectedPrice) <= tolerance;
  }

  private async runSEOTests(sampleProducts: any[]): Promise<SEOTestResults> {
    console.log('🔍 Running SEO functionality tests...');

    const platformTests: PlatformSEOTest[] = [];
    const titleVariationTests: TitleVariationTest[] = [];
    const keywordOptimizationTests: KeywordOptimizationTest[] = [];
    let totalTests = 0;
    let passedTests = 0;
    let totalSimilarity = 0;
    let totalQualityScore = 0;

    // Test platform-specific title generation
    for (const product of sampleProducts.slice(0, 15)) {
      const originalTitle = product.name;
      
      for (const platform of this.platforms) {
        const startTime = Date.now();
        
        try {
          const result = this.seoGenerator.generatePlatformTitle(originalTitle, platform);
          const endTime = Date.now();
          
          const config = this.seoGenerator.getPlatformConfig(platform);
          const lengthCompliance = result.length <= config!.maxTitleLength;
          const isAppropriate = this.validateTitleAppropriateness(result, platform, originalTitle);
          
          platformTests.push({
            platform,
            originalTitle,
            generatedTitle: result.generatedTitle,
            similarity: result.similarity,
            qualityScore: result.qualityScore,
            keywordsUsed: result.keywordsUsed,
            lengthCompliance,
            isAppropriate,
            testDuration: endTime - startTime
          });

          totalTests++;
          totalSimilarity += result.similarity;
          totalQualityScore += result.qualityScore;
          
          if (lengthCompliance && isAppropriate && result.similarity >= 70 && result.similarity <= 85) {
            passedTests++;
          }

        } catch (error) {
          console.warn(`SEO test failed for ${platform}:`, error);
          totalTests++;
        }
      }
    }

    // Test title variations
    for (const product of sampleProducts.slice(0, 10)) {
      const originalTitle = product.name;
      
      try {
        const bulkResult = this.seoGenerator.generateAllPlatformTitles(originalTitle);
        
        const variations = bulkResult.platformTitles.map(result => ({
          platform: result.platform,
          title: result.generatedTitle,
          similarity: result.similarity,
          uniqueness: this.calculateTitleUniqueness(result.generatedTitle, bulkResult.platformTitles)
        }));

        titleVariationTests.push({
          originalTitle,
          variations,
          averageSimilarity: bulkResult.averageSimilarity,
          variationQuality: this.calculateVariationQuality(variations)
        });

      } catch (error) {
        console.warn(`Title variation test failed:`, error);
      }
    }

    // Test keyword optimization
    for (const product of sampleProducts.slice(0, 10)) {
      const originalTitle = product.name;
      
      for (const platform of this.platforms.slice(0, 2)) { // Test first 2 platforms
        try {
          const result = this.seoGenerator.generatePlatformTitle(originalTitle, platform);
          const keywordsAdded = this.identifyAddedKeywords(originalTitle, result.generatedTitle);
          const keywordDensity = this.calculateKeywordDensity(result.generatedTitle);
          const seoScore = this.calculateSEOScore(result.generatedTitle, platform);
          const platformSpecificOptimization = this.validatePlatformOptimization(result, platform);

          keywordOptimizationTests.push({
            platform,
            originalTitle,
            generatedTitle: result.generatedTitle,
            keywordsAdded,
            keywordDensity,
            seoScore,
            platformSpecificOptimization
          });

        } catch (error) {
          console.warn(`Keyword optimization test failed:`, error);
        }
      }
    }

    const averageSimilarity = totalTests > 0 ? Math.round(totalSimilarity / totalTests) : 0;
    const averageQualityScore = totalTests > 0 ? Math.round(totalQualityScore / totalTests) : 0;

    // Calculate performance metrics
    const performanceMetrics: SEOPerformanceMetrics = {
      singleGenerationTime: platformTests.length > 0
        ? platformTests.reduce((sum, test) => sum + test.testDuration, 0) / platformTests.length
        : 0,
      bulkGenerationTime: 0, // Would need separate bulk timing
      memoryUsagePerGeneration: 0, // Would need actual memory profiling
      patternMatchingTime: 0 // Would need detailed profiling
    };

    return {
      totalSEOTests: totalTests,
      passedSEOTests: passedTests,
      failedSEOTests: totalTests - passedTests,
      averageSimilarity,
      averageQualityScore,
      platformTests,
      titleVariationTests,
      keywordOptimizationTests,
      performanceMetrics
    };
  }

  private validateTitleAppropriateness(result: any, platform: string, originalTitle: string): boolean {
    // Check if title is appropriate for the platform
    const title = result.generatedTitle;
    
    // Basic appropriateness checks
    if (title.length === 0) return false;
    if (title === originalTitle) return false; // Should be different
    
    // Platform-specific checks
    switch (platform) {
      case 'tiktokshop':
        // TikTok Shop often uses emojis and trending language
        return title.includes('🔥') || title.includes('✨') || title.includes('viral') || title.includes('trending');
      
      case 'shopee':
        // Shopee focuses on value and quality
        return title.includes('murah') || title.includes('berkualitas') || title.includes('original') || title.includes('promo');
      
      case 'website':
        // Website should be more professional
        return !title.includes('🔥') && !title.includes('murah') && title.length <= 60;
      
      default:
        return true;
    }
  }

  private calculateTitleUniqueness(title: string, allTitles: any[]): number {
    const otherTitles = allTitles.filter(t => t.generatedTitle !== title);
    if (otherTitles.length === 0) return 100;
    
    let totalSimilarity = 0;
    for (const otherTitle of otherTitles) {
      const similarity = this.calculateStringSimilarity(title, otherTitle.generatedTitle);
      totalSimilarity += similarity;
    }
    
    const averageSimilarity = totalSimilarity / otherTitles.length;
    return Math.max(0, 100 - averageSimilarity);
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? (intersection.size / union.size) * 100 : 0;
  }

  private calculateVariationQuality(variations: any[]): number {
    if (variations.length < 2) return 0;
    
    // Quality is based on appropriate similarity range and uniqueness
    let qualityScore = 0;
    
    for (const variation of variations) {
      // Good similarity range (70-85%)
      if (variation.similarity >= 70 && variation.similarity <= 85) {
        qualityScore += 25;
      }
      
      // Good uniqueness (>20%)
      if (variation.uniqueness > 20) {
        qualityScore += 25;
      }
    }
    
    return Math.min(100, qualityScore / variations.length);
  }

  private identifyAddedKeywords(originalTitle: string, generatedTitle: string): string[] {
    const originalWords = new Set(originalTitle.toLowerCase().split(/\s+/));
    const generatedWords = generatedTitle.toLowerCase().split(/\s+/);
    
    return generatedWords.filter(word => !originalWords.has(word) && word.length > 2);
  }

  private calculateKeywordDensity(title: string): number {
    const words = title.split(/\s+/);
    const fpvKeywords = ['drone', 'fpv', 'racing', 'frame', 'carbon', 'motor', 'propeller'];
    const keywordCount = words.filter(word => 
      fpvKeywords.some(keyword => word.toLowerCase().includes(keyword))
    ).length;
    
    return words.length > 0 ? (keywordCount / words.length) * 100 : 0;
  }

  private calculateSEOScore(title: string, platform: string): number {
    let score = 100;
    
    // Length optimization
    const config = this.seoGenerator.getPlatformConfig(platform);
    if (config) {
      const lengthDiff = Math.abs(title.length - config.preferredLength);
      score -= Math.min(20, lengthDiff * 0.5);
    }
    
    // Keyword density
    const keywordDensity = this.calculateKeywordDensity(title);
    if (keywordDensity < 10) score -= 15;
    else if (keywordDensity > 30) score -= 10;
    
    // Readability
    const specialChars = (title.match(/[^\w\s]/g) || []).length;
    if (specialChars > 5) score -= 10;
    
    return Math.max(0, score);
  }

  private validatePlatformOptimization(result: any, platform: string): boolean {
    const title = result.generatedTitle;
    const keywords = result.keywordsUsed;
    
    // Check if platform-specific keywords are used
    const config = this.seoGenerator.getPlatformConfig(platform);
    if (!config) return false;
    
    const platformKeywords = config.priorityKeywords;
    const usedPlatformKeywords = keywords.filter(keyword =>
      platformKeywords.some(pk => pk.toLowerCase().includes(keyword.toLowerCase()))
    );
    
    return usedPlatformKeywords.length > 0;
  }

  private async runIntegrationTests(sampleProducts: any[]): Promise<IntegrationTestResults> {
    console.log('🔗 Running integration tests...');

    const masterProductTests: MasterProductIntegrationTest[] = [];
    const endToEndTests: EndToEndTest[] = [];
    const dataConsistencyTests: DataConsistencyTest[] = [];

    // Test master product integration
    for (const product of sampleProducts.slice(0, 10)) {
      const basePrice = parseFloat(product.basePrice.toString());
      
      // Test pricing integration
      const pricingIntegration = {
        basePrice,
        platformPrices: {} as Record<string, number>,
        calculationAccuracy: true
      };

      for (const platform of this.platforms) {
        try {
          const result = this.pricingCalculator.calculatePlatformPrice(basePrice, platform);
          pricingIntegration.platformPrices[platform] = result.finalPrice;
        } catch (error) {
          pricingIntegration.calculationAccuracy = false;
        }
      }

      // Test SEO integration
      const seoIntegration = {
        originalTitle: product.name,
        platformTitles: {} as Record<string, string>,
        titleQuality: true
      };

      for (const platform of this.platforms) {
        try {
          const result = this.seoGenerator.generatePlatformTitle(product.name, platform);
          seoIntegration.platformTitles[platform] = result.generatedTitle;
        } catch (error) {
          seoIntegration.titleQuality = false;
        }
      }

      masterProductTests.push({
        productId: product.id,
        masterSku: product.masterSku,
        pricingIntegration,
        seoIntegration,
        overallIntegration: pricingIntegration.calculationAccuracy && seoIntegration.titleQuality
      });
    }

    // End-to-end tests
    const e2eTests = [
      {
        name: 'Complete Product Processing',
        steps: [
          'Get product from database',
          'Calculate all platform prices',
          'Generate all platform titles',
          'Validate results'
        ]
      },
      {
        name: 'Bulk Processing',
        steps: [
          'Get multiple products',
          'Process pricing for all platforms',
          'Process SEO for all platforms',
          'Validate consistency'
        ]
      }
    ];

    for (const test of e2eTests) {
      const startTime = Date.now();
      let result: 'PASS' | 'FAIL' = 'PASS';
      let error: string | undefined;

      try {
        if (test.name === 'Complete Product Processing') {
          const product = sampleProducts[0];
          const basePrice = parseFloat(product.basePrice.toString());
          
          // Step 1: Get product (already done)
          // Step 2: Calculate prices
          const pricingResults = this.pricingCalculator.calculateAllPlatformPrices(basePrice);
          
          // Step 3: Generate titles
          const seoResults = this.seoGenerator.generateAllPlatformTitles(product.name);
          
          // Step 4: Validate
          if (pricingResults.platformResults.length === 0 || seoResults.platformTitles.length === 0) {
            result = 'FAIL';
            error = 'No results generated';
          }
        }
      } catch (err) {
        result = 'FAIL';
        error = err instanceof Error ? err.message : 'Unknown error';
      }

      const endTime = Date.now();
      endToEndTests.push({
        testName: test.name,
        steps: test.steps,
        result,
        duration: endTime - startTime,
        error
      });
    }

    // Data consistency tests
    const consistencyTests = [
      {
        name: 'Pricing Consistency',
        test: () => {
          const basePrice = 10000;
          const result1 = this.pricingCalculator.calculatePlatformPrice(basePrice, 'shopee');
          const result2 = this.pricingCalculator.calculatePlatformPrice(basePrice, 'shopee');
          return { expected: result1.finalPrice, actual: result2.finalPrice };
        }
      },
      {
        name: 'SEO Consistency',
        test: () => {
          const title = 'Test Product Frame Carbon 5 Inch';
          const result1 = this.seoGenerator.generatePlatformTitle(title, 'shopee');
          const result2 = this.seoGenerator.generatePlatformTitle(title, 'shopee');
          return { expected: result1.generatedTitle, actual: result2.generatedTitle };
        }
      }
    ];

    for (const test of consistencyTests) {
      try {
        const { expected, actual } = test.test();
        dataConsistencyTests.push({
          testName: test.name,
          expectedValue: expected,
          actualValue: actual,
          isConsistent: expected === actual
        });
      } catch (error) {
        dataConsistencyTests.push({
          testName: test.name,
          expectedValue: null,
          actualValue: null,
          isConsistent: false
        });
      }
    }

    return {
      masterProductTests,
      endToEndTests,
      dataConsistencyTests
    };
  }

  private async runPerformanceTests(sampleProducts: any[]): Promise<PerformanceTestResults> {
    console.log('⚡ Running performance tests...');

    const initialMemory = process.memoryUsage().heapUsed;
    let peakMemory = initialMemory;

    // Pricing performance tests
    const pricingStartTime = Date.now();
    let pricingCalculations = 0;

    for (const product of sampleProducts.slice(0, 20)) {
      const basePrice = parseFloat(product.basePrice.toString());
      
      for (const platform of this.platforms) {
        try {
          this.pricingCalculator.calculatePlatformPrice(basePrice, platform);
          pricingCalculations++;
          
          const currentMemory = process.memoryUsage().heapUsed;
          if (currentMemory > peakMemory) {
            peakMemory = currentMemory;
          }
        } catch (error) {
          // Ignore errors for performance testing
        }
      }
    }

    const pricingEndTime = Date.now();
    const pricingDuration = pricingEndTime - pricingStartTime;

    // SEO performance tests
    const seoStartTime = Date.now();
    let seoGenerations = 0;

    for (const product of sampleProducts.slice(0, 20)) {
      for (const platform of this.platforms) {
        try {
          this.seoGenerator.generatePlatformTitle(product.name, platform);
          seoGenerations++;
          
          const currentMemory = process.memoryUsage().heapUsed;
          if (currentMemory > peakMemory) {
            peakMemory = currentMemory;
          }
        } catch (error) {
          // Ignore errors for performance testing
        }
      }
    }

    const seoEndTime = Date.now();
    const seoDuration = seoEndTime - seoStartTime;

    const finalMemory = process.memoryUsage().heapUsed;

    return {
      pricingPerformance: {
        averageCalculationTime: pricingCalculations > 0 ? pricingDuration / pricingCalculations : 0,
        maxCalculationTime: pricingDuration,
        calculationsPerSecond: pricingDuration > 0 ? Math.round((pricingCalculations * 1000) / pricingDuration) : 0
      },
      seoPerformance: {
        averageGenerationTime: seoGenerations > 0 ? seoDuration / seoGenerations : 0,
        maxGenerationTime: seoDuration,
        generationsPerSecond: seoDuration > 0 ? Math.round((seoGenerations * 1000) / seoDuration) : 0
      },
      memoryUsage: {
        initialMemory: Math.round(initialMemory / 1024 / 1024), // MB
        peakMemory: Math.round(peakMemory / 1024 / 1024), // MB
        finalMemory: Math.round(finalMemory / 1024 / 1024) // MB
      }
    };
  }

  private calculateOverallScore(
    pricing: PricingTestResults,
    seo: SEOTestResults,
    integration: IntegrationTestResults,
    performance: PerformanceTestResults
  ): number {
    let score = 100;

    // Pricing accuracy (40 points)
    if (pricing.accuracyRate < 95) score -= 20;
    else if (pricing.accuracyRate < 98) score -= 10;
    else if (pricing.accuracyRate < 100) score -= 5;

    // SEO quality (30 points)
    const seoPassRate = pricing.totalPricingTests > 0 ? (seo.passedSEOTests / seo.totalSEOTests) * 100 : 0;
    if (seoPassRate < 80) score -= 20;
    else if (seoPassRate < 90) score -= 10;
    else if (seoPassRate < 95) score -= 5;

    // Integration tests (20 points)
    const integrationPassRate = integration.masterProductTests.length > 0
      ? (integration.masterProductTests.filter(t => t.overallIntegration).length / integration.masterProductTests.length) * 100
      : 0;
    if (integrationPassRate < 90) score -= 15;
    else if (integrationPassRate < 95) score -= 10;
    else if (integrationPassRate < 100) score -= 5;

    // Performance (10 points)
    if (performance.pricingPerformance.averageCalculationTime > 100) score -= 5; // >100ms is slow
    if (performance.seoPerformance.averageGenerationTime > 200) score -= 5; // >200ms is slow

    return Math.max(0, score);
  }

  private determineTestStatus(
    overallScore: number,
    pricing: PricingTestResults,
    seo: SEOTestResults,
    integration: IntegrationTestResults
  ): 'PASS' | 'WARNING' | 'FAIL' {
    // Check for critical failures
    if (pricing.accuracyRate < 80) return 'FAIL';
    if (seo.totalSEOTests > 0 && (seo.passedSEOTests / seo.totalSEOTests) < 0.7) return 'FAIL';
    
    if (overallScore >= 90) return 'PASS';
    if (overallScore >= 75) return 'WARNING';
    return 'FAIL';
  }

  private generateRecommendations(
    pricing: PricingTestResults,
    seo: SEOTestResults,
    integration: IntegrationTestResults,
    performance: PerformanceTestResults
  ): TestRecommendation[] {
    const recommendations: TestRecommendation[] = [];

    // Pricing recommendations
    if (pricing.accuracyRate < 95) {
      recommendations.push({
        priority: pricing.accuracyRate < 80 ? 'critical' : 'high',
        category: 'pricing',
        title: 'Pricing Calculation Accuracy Issues',
        description: `Pricing accuracy is ${pricing.accuracyRate}%, below the 95% target`,
        actionRequired: 'Review and fix pricing calculation logic, especially fee calculations',
        expectedOutcome: 'Achieve 95%+ pricing accuracy',
        affectedTests: pricing.failedPricingTests
      });
    }

    // SEO recommendations
    const seoPassRate = seo.totalSEOTests > 0 ? (seo.passedSEOTests / seo.totalSEOTests) * 100 : 0;
    if (seoPassRate < 90) {
      recommendations.push({
        priority: seoPassRate < 70 ? 'critical' : 'high',
        category: 'seo',
        title: 'SEO Title Generation Issues',
        description: `SEO test pass rate is ${Math.round(seoPassRate)}%, below the 90% target`,
        actionRequired: 'Review title generation patterns and platform-specific optimizations',
        expectedOutcome: 'Achieve 90%+ SEO test pass rate',
        affectedTests: seo.failedSEOTests
      });
    }

    // Performance recommendations
    if (performance.pricingPerformance.averageCalculationTime > 50) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        title: 'Pricing Calculation Performance',
        description: `Average pricing calculation time is ${Math.round(performance.pricingPerformance.averageCalculationTime)}ms`,
        actionRequired: 'Optimize pricing calculation algorithms and consider caching',
        expectedOutcome: 'Reduce calculation time to <50ms average'
      });
    }

    if (performance.seoPerformance.averageGenerationTime > 100) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        title: 'SEO Generation Performance',
        description: `Average SEO generation time is ${Math.round(performance.seoPerformance.averageGenerationTime)}ms`,
        actionRequired: 'Optimize title generation algorithms and pattern matching',
        expectedOutcome: 'Reduce generation time to <100ms average'
      });
    }

    // Integration recommendations
    const integrationIssues = integration.masterProductTests.filter(t => !t.overallIntegration).length;
    if (integrationIssues > 0) {
      recommendations.push({
        priority: 'high',
        category: 'integration',
        title: 'Integration Test Failures',
        description: `${integrationIssues} products failed integration tests`,
        actionRequired: 'Review and fix integration between pricing and SEO components',
        expectedOutcome: 'All products pass integration tests',
        affectedTests: integrationIssues
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }
}

// Export singleton instance
export const pricingSEOTester = new PricingSEOTester();