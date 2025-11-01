/**
 * Data Analyzer for Phase 1
 * Analyzes imported data from Shopee and TikTok Shop to identify overlaps and differences
 */

import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export interface ProductOverlapStats {
  totalShopeeProducts: number;
  totalTikTokProducts: number;
  commonProducts: number;
  overlapPercentage: number;
  shopeeOnlyProducts: string[];
  tiktokOnlyProducts: string[];
  similarProducts: Array<{
    shopeeProduct: any;
    tiktokProduct: any;
    similarityScore: number;
    matchingFields: string[];
  }>;
}

export interface FieldMappingAnalysis {
  commonFields: Array<{
    fieldName: string;
    shopeeField: string;
    tiktokField: string;
    dataType: string;
    presentInShopee: number;
    presentInTikTok: number;
    matchPercentage: number;
  }>;
  shopeeOnlyFields: Array<{
    fieldName: string;
    dataType: string;
    frequency: number;
    sampleValues: any[];
  }>;
  tiktokOnlyFields: Array<{
    fieldName: string;
    dataType: string;
    frequency: number;
    sampleValues: any[];
  }>;
  fieldOverlapPercentage: number;
}

export interface DataQualityReport {
  shopeeQuality: {
    totalProducts: number;
    validProducts: number;
    missingRequiredFields: number;
    invalidPrices: number;
    missingImages: number;
    qualityScore: number;
  };
  tiktokQuality: {
    totalProducts: number;
    validProducts: number;
    missingRequiredFields: number;
    invalidPrices: number;
    missingImages: number;
    tokopediaEnabledCount: number;
    qualityScore: number;
  };
  overallQuality: {
    totalProducts: number;
    validProducts: number;
    qualityScore: number;
    recommendations: string[];
  };
}

export interface ComparisonAnalysisReport {
  summary: {
    analysisDate: Date;
    shopeeDataPath: string;
    tiktokDataPath: string;
    analysisVersion: string;
  };
  productOverlap: ProductOverlapStats;
  fieldMapping: FieldMappingAnalysis;
  dataQuality: DataQualityReport;
  recommendations: string[];
  nextSteps: string[];
}

export class DataAnalyzer {
  private shopeeDataPath: string;
  private tiktokDataPath: string;

  constructor(
    shopeeDataPath = './data/raw-imports/shopee',
    tiktokDataPath = './data/raw-imports/tiktokshop'
  ) {
    this.shopeeDataPath = shopeeDataPath;
    this.tiktokDataPath = tiktokDataPath;
  }

  /**
   * Load all imported Shopee products from storage
   */
  async loadShopeeProducts(): Promise<any[]> {
    const products: any[] = [];
    
    try {
      if (!existsSync(this.shopeeDataPath)) {
        console.warn(`Shopee data directory not found: ${this.shopeeDataPath}`);
        return products;
      }

      const files = await readdir(this.shopeeDataPath);
      const batchFiles = files.filter(file => file.startsWith('batch_') && file.endsWith('.json'));

      for (const file of batchFiles) {
        try {
          const filePath = path.join(this.shopeeDataPath, file);
          const content = await readFile(filePath, 'utf8');
          const batchData = JSON.parse(content);
          
          if (batchData.products && Array.isArray(batchData.products)) {
            products.push(...batchData.products);
          }
        } catch (error) {
          console.warn(`Failed to load Shopee batch file ${file}:`, error);
        }
      }

      console.log(`✅ Loaded ${products.length} Shopee products from ${batchFiles.length} batch files`);
      return products;
    } catch (error) {
      console.error('Failed to load Shopee products:', error);
      return products;
    }
  }

  /**
   * Load all imported TikTok Shop products from storage
   */
  async loadTikTokProducts(): Promise<any[]> {
    const products: any[] = [];
    
    try {
      if (!existsSync(this.tiktokDataPath)) {
        console.warn(`TikTok Shop data directory not found: ${this.tiktokDataPath}`);
        return products;
      }

      const files = await readdir(this.tiktokDataPath);
      const batchFiles = files.filter(file => file.startsWith('batch_') && file.endsWith('.json'));

      for (const file of batchFiles) {
        try {
          const filePath = path.join(this.tiktokDataPath, file);
          const content = await readFile(filePath, 'utf8');
          const batchData = JSON.parse(content);
          
          if (batchData.products && Array.isArray(batchData.products)) {
            products.push(...batchData.products);
          }
        } catch (error) {
          console.warn(`Failed to load TikTok batch file ${file}:`, error);
        }
      }

      console.log(`✅ Loaded ${products.length} TikTok Shop products from ${batchFiles.length} batch files`);
      return products;
    } catch (error) {
      console.error('Failed to load TikTok Shop products:', error);
      return products;
    }
  }

  /**
   * Calculate product overlap between platforms
   */
  async calculateProductOverlap(): Promise<ProductOverlapStats> {
    const shopeeProducts = await this.loadShopeeProducts();
    const tiktokProducts = await this.loadTikTokProducts();

    console.log('🔍 Analyzing product overlap...');

    const shopeeOnlyProducts: string[] = [];
    const tiktokOnlyProducts: string[] = [];
    const similarProducts: Array<{
      shopeeProduct: any;
      tiktokProduct: any;
      similarityScore: number;
      matchingFields: string[];
    }> = [];

    // Create maps for efficient lookup
    const shopeeProductMap = new Map();
    const tiktokProductMap = new Map();

    shopeeProducts.forEach(product => {
      const key = this.normalizeProductTitle(product.item_name || product.title || '');
      shopeeProductMap.set(key, product);
    });

    tiktokProducts.forEach(product => {
      const key = this.normalizeProductTitle(product.product_name || product.title || '');
      tiktokProductMap.set(key, product);
    });

    // Find similar products using title matching and other criteria
    const matchedTikTokProducts = new Set();

    for (const [shopeeKey, shopeeProduct] of shopeeProductMap) {
      let bestMatch = null;
      let bestScore = 0;

      for (const [tiktokKey, tiktokProduct] of tiktokProductMap) {
        if (matchedTikTokProducts.has(tiktokKey)) continue;

        const similarity = this.calculateProductSimilarity(shopeeProduct, tiktokProduct);
        
        if (similarity.score > bestScore && similarity.score >= 0.7) { // 70% similarity threshold
          bestScore = similarity.score;
          bestMatch = {
            tiktokKey,
            tiktokProduct,
            matchingFields: similarity.matchingFields
          };
        }
      }

      if (bestMatch) {
        similarProducts.push({
          shopeeProduct,
          tiktokProduct: bestMatch.tiktokProduct,
          similarityScore: bestScore,
          matchingFields: bestMatch.matchingFields
        });
        matchedTikTokProducts.add(bestMatch.tiktokKey);
      } else {
        shopeeOnlyProducts.push(shopeeProduct.item_id || shopeeProduct.id || 'unknown');
      }
    }

    // Find TikTok-only products
    for (const [tiktokKey, tiktokProduct] of tiktokProductMap) {
      if (!matchedTikTokProducts.has(tiktokKey)) {
        tiktokOnlyProducts.push(tiktokProduct.product_id || tiktokProduct.id || 'unknown');
      }
    }

    const commonProducts = similarProducts.length;
    const totalProducts = shopeeProducts.length + tiktokProducts.length - commonProducts;
    const overlapPercentage = totalProducts > 0 ? (commonProducts / Math.min(shopeeProducts.length, tiktokProducts.length)) * 100 : 0;

    const stats: ProductOverlapStats = {
      totalShopeeProducts: shopeeProducts.length,
      totalTikTokProducts: tiktokProducts.length,
      commonProducts,
      overlapPercentage: Math.round(overlapPercentage * 100) / 100,
      shopeeOnlyProducts,
      tiktokOnlyProducts,
      similarProducts
    };

    console.log(`📊 Product Overlap Analysis Complete:`);
    console.log(`   Shopee Products: ${stats.totalShopeeProducts}`);
    console.log(`   TikTok Products: ${stats.totalTikTokProducts}`);
    console.log(`   Common Products: ${stats.commonProducts}`);
    console.log(`   Overlap Percentage: ${stats.overlapPercentage}%`);

    return stats;
  }

  /**
   * Analyze field mappings between platforms
   */
  async analyzeFieldMappings(): Promise<FieldMappingAnalysis> {
    const shopeeProducts = await this.loadShopeeProducts();
    const tiktokProducts = await this.loadTikTokProducts();

    console.log('🔍 Analyzing field mappings...');

    const shopeeFields = this.extractFieldStructure(shopeeProducts, 'shopee');
    const tiktokFields = this.extractFieldStructure(tiktokProducts, 'tiktok');

    const commonFields: FieldMappingAnalysis['commonFields'] = [];
    const shopeeOnlyFields: FieldMappingAnalysis['shopeeOnlyFields'] = [];
    const tiktokOnlyFields: FieldMappingAnalysis['tiktokOnlyFields'] = [];

    // Find common fields
    const allFieldNames = new Set([...Object.keys(shopeeFields), ...Object.keys(tiktokFields)]);

    for (const fieldName of allFieldNames) {
      const shopeeField = shopeeFields[fieldName];
      const tiktokField = tiktokFields[fieldName];

      if (shopeeField && tiktokField) {
        // Common field
        const matchPercentage = this.calculateFieldMatchPercentage(shopeeField, tiktokField);
        commonFields.push({
          fieldName,
          shopeeField: fieldName,
          tiktokField: fieldName,
          dataType: shopeeField.dataType,
          presentInShopee: shopeeField.frequency,
          presentInTikTok: tiktokField.frequency,
          matchPercentage
        });
      } else if (shopeeField && !tiktokField) {
        // Shopee-only field
        shopeeOnlyFields.push({
          fieldName,
          dataType: shopeeField.dataType,
          frequency: shopeeField.frequency,
          sampleValues: shopeeField.sampleValues
        });
      } else if (!shopeeField && tiktokField) {
        // TikTok-only field
        tiktokOnlyFields.push({
          fieldName,
          dataType: tiktokField.dataType,
          frequency: tiktokField.frequency,
          sampleValues: tiktokField.sampleValues
        });
      }
    }

    const totalFields = allFieldNames.size;
    const commonFieldCount = commonFields.length;
    const fieldOverlapPercentage = totalFields > 0 ? (commonFieldCount / totalFields) * 100 : 0;

    const analysis: FieldMappingAnalysis = {
      commonFields: commonFields.sort((a, b) => b.matchPercentage - a.matchPercentage),
      shopeeOnlyFields: shopeeOnlyFields.sort((a, b) => b.frequency - a.frequency),
      tiktokOnlyFields: tiktokOnlyFields.sort((a, b) => b.frequency - a.frequency),
      fieldOverlapPercentage: Math.round(fieldOverlapPercentage * 100) / 100
    };

    console.log(`📊 Field Mapping Analysis Complete:`);
    console.log(`   Total Fields: ${totalFields}`);
    console.log(`   Common Fields: ${commonFieldCount}`);
    console.log(`   Field Overlap: ${analysis.fieldOverlapPercentage}%`);

    return analysis;
  }

  /**
   * Analyze data quality across platforms
   */
  async analyzeDataQuality(): Promise<DataQualityReport> {
    const shopeeProducts = await this.loadShopeeProducts();
    const tiktokProducts = await this.loadTikTokProducts();

    console.log('🔍 Analyzing data quality...');

    const shopeeQuality = this.analyzeProductQuality(shopeeProducts, 'shopee');
    const tiktokQuality = this.analyzeProductQuality(tiktokProducts, 'tiktok');

    const totalProducts = shopeeProducts.length + tiktokProducts.length;
    const validProducts = shopeeQuality.validProducts + tiktokQuality.validProducts;
    const overallQualityScore = totalProducts > 0 ? (validProducts / totalProducts) * 100 : 0;

    const recommendations: string[] = [];
    
    if (shopeeQuality.qualityScore < 95) {
      recommendations.push(`Shopee data quality (${shopeeQuality.qualityScore}%) needs improvement`);
    }
    
    if (tiktokQuality.qualityScore < 95) {
      recommendations.push(`TikTok Shop data quality (${tiktokQuality.qualityScore}%) needs improvement`);
    }
    
    if (overallQualityScore < 95) {
      recommendations.push('Overall data quality below 95% target - review validation rules');
    }

    const report: DataQualityReport = {
      shopeeQuality,
      tiktokQuality,
      overallQuality: {
        totalProducts,
        validProducts,
        qualityScore: Math.round(overallQualityScore * 100) / 100,
        recommendations
      }
    };

    console.log(`📊 Data Quality Analysis Complete:`);
    console.log(`   Overall Quality Score: ${report.overallQuality.qualityScore}%`);
    console.log(`   Valid Products: ${validProducts}/${totalProducts}`);

    return report;
  }

  /**
   * Generate comprehensive comparison analysis report
   */
  async generateComparisonReport(): Promise<ComparisonAnalysisReport> {
    console.log('📊 Generating comprehensive comparison analysis report...');

    const [productOverlap, fieldMapping, dataQuality] = await Promise.all([
      this.calculateProductOverlap(),
      this.analyzeFieldMappings(),
      this.analyzeDataQuality()
    ]);

    const recommendations: string[] = [];
    const nextSteps: string[] = [];

    // Generate recommendations based on analysis
    if (productOverlap.overlapPercentage < 90) {
      recommendations.push(`Product overlap (${productOverlap.overlapPercentage}%) is below 90% target`);
      nextSteps.push('Review product matching criteria and improve similarity detection');
    }

    if (fieldMapping.fieldOverlapPercentage < 90) {
      recommendations.push(`Field overlap (${fieldMapping.fieldOverlapPercentage}%) is below 90% target`);
      nextSteps.push('Create field mapping strategy for platform-specific fields');
    }

    if (dataQuality.overallQuality.qualityScore < 95) {
      recommendations.push(`Data quality (${dataQuality.overallQuality.qualityScore}%) needs improvement`);
      nextSteps.push('Implement additional data validation and cleaning processes');
    }

    // Add positive recommendations
    if (productOverlap.overlapPercentage >= 90) {
      recommendations.push('Product overlap meets requirements - ready for master schema design');
    }

    if (fieldMapping.fieldOverlapPercentage >= 90) {
      recommendations.push('Field mapping analysis complete - proceed with unified schema');
    }

    nextSteps.push('Design master product schema based on analysis results');
    nextSteps.push('Implement platform-specific mapping structures');
    nextSteps.push('Create pricing calculation system with platform fees');

    const report: ComparisonAnalysisReport = {
      summary: {
        analysisDate: new Date(),
        shopeeDataPath: this.shopeeDataPath,
        tiktokDataPath: this.tiktokDataPath,
        analysisVersion: '1.0.0'
      },
      productOverlap,
      fieldMapping,
      dataQuality,
      recommendations,
      nextSteps
    };

    console.log('✅ Comparison analysis report generated successfully');
    return report;
  }

  /**
   * Normalize product title for comparison
   */
  private normalizeProductTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Calculate similarity between two products
   */
  private calculateProductSimilarity(shopeeProduct: any, tiktokProduct: any): {
    score: number;
    matchingFields: string[];
  } {
    const matchingFields: string[] = [];
    let totalScore = 0;
    let maxScore = 0;

    // Title similarity (weight: 40%)
    const shopeeTitle = this.normalizeProductTitle(shopeeProduct.item_name || shopeeProduct.title || '');
    const tiktokTitle = this.normalizeProductTitle(tiktokProduct.product_name || tiktokProduct.title || '');
    const titleSimilarity = this.calculateStringSimilarity(shopeeTitle, tiktokTitle);
    
    if (titleSimilarity > 0.7) {
      matchingFields.push('title');
      totalScore += titleSimilarity * 0.4;
    }
    maxScore += 0.4;

    // Price similarity (weight: 20%)
    const shopeePrice = shopeeProduct.price || 0;
    const tiktokPrice = tiktokProduct.price || 0;
    if (shopeePrice > 0 && tiktokPrice > 0) {
      const priceDiff = Math.abs(shopeePrice - tiktokPrice) / Math.max(shopeePrice, tiktokPrice);
      const priceSimilarity = Math.max(0, 1 - priceDiff);
      
      if (priceSimilarity > 0.8) {
        matchingFields.push('price');
        totalScore += priceSimilarity * 0.2;
      }
    }
    maxScore += 0.2;

    // Category similarity (weight: 20%)
    const shopeeCategory = shopeeProduct.category_id || '';
    const tiktokCategory = tiktokProduct.category_id || '';
    if (shopeeCategory && tiktokCategory) {
      const categorySimilarity = shopeeCategory === tiktokCategory ? 1 : 0;
      if (categorySimilarity > 0) {
        matchingFields.push('category');
        totalScore += categorySimilarity * 0.2;
      }
    }
    maxScore += 0.2;

    // Weight similarity (weight: 10%)
    const shopeeWeight = shopeeProduct.weight || 0;
    const tiktokWeight = tiktokProduct.weight || 0;
    if (shopeeWeight > 0 && tiktokWeight > 0) {
      const weightDiff = Math.abs(shopeeWeight - tiktokWeight) / Math.max(shopeeWeight, tiktokWeight);
      const weightSimilarity = Math.max(0, 1 - weightDiff);
      
      if (weightSimilarity > 0.9) {
        matchingFields.push('weight');
        totalScore += weightSimilarity * 0.1;
      }
    }
    maxScore += 0.1;

    // Images similarity (weight: 10%)
    const shopeeImages = shopeeProduct.images || [];
    const tiktokImages = tiktokProduct.images || [];
    if (shopeeImages.length > 0 && tiktokImages.length > 0) {
      const imageCountSimilarity = 1 - Math.abs(shopeeImages.length - tiktokImages.length) / Math.max(shopeeImages.length, tiktokImages.length);
      if (imageCountSimilarity > 0.8) {
        matchingFields.push('images');
        totalScore += imageCountSimilarity * 0.1;
      }
    }
    maxScore += 0.1;

    const finalScore = maxScore > 0 ? totalScore / maxScore : 0;

    return {
      score: Math.round(finalScore * 1000) / 1000,
      matchingFields
    };
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    const distance = matrix[str2.length][str1.length];
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength > 0 ? 1 - distance / maxLength : 0;
  }
  /**
   * Extract field structure from products
   */
  private extractFieldStructure(products: any[], platform: string): Record<string, {
    dataType: string;
    frequency: number;
    sampleValues: any[];
  }> {
    const fieldMap: Record<string, {
      dataType: string;
      frequency: number;
      sampleValues: any[];
    }> = {};

    products.forEach(product => {
      this.extractFieldsRecursive(product, '', fieldMap, products.length);
    });

    return fieldMap;
  }

  /**
   * Recursively extract fields from nested objects
   */
  private extractFieldsRecursive(
    obj: any,
    prefix: string,
    fieldMap: Record<string, { dataType: string; frequency: number; sampleValues: any[] }>,
    totalProducts: number
  ): void {
    if (obj === null || obj === undefined) return;

    if (typeof obj === 'object' && !Array.isArray(obj)) {
      Object.keys(obj).forEach(key => {
        const fieldName = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (!fieldMap[fieldName]) {
          fieldMap[fieldName] = {
            dataType: this.getDataType(value),
            frequency: 0,
            sampleValues: []
          };
        }

        fieldMap[fieldName].frequency++;
        
        if (fieldMap[fieldName].sampleValues.length < 5 && value !== null && value !== undefined) {
          fieldMap[fieldName].sampleValues.push(value);
        }

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          this.extractFieldsRecursive(value, fieldName, fieldMap, totalProducts);
        }
      });
    }
  }

  /**
   * Get data type of a value
   */
  private getDataType(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
    return typeof value;
  }

  /**
   * Calculate field match percentage between platforms
   */
  private calculateFieldMatchPercentage(shopeeField: any, tiktokField: any): number {
    let score = 0;
    let maxScore = 0;

    // Data type match (50%)
    if (shopeeField.dataType === tiktokField.dataType) {
      score += 0.5;
    }
    maxScore += 0.5;

    // Frequency similarity (30%)
    const frequencyDiff = Math.abs(shopeeField.frequency - tiktokField.frequency);
    const maxFrequency = Math.max(shopeeField.frequency, tiktokField.frequency);
    const frequencySimilarity = maxFrequency > 0 ? 1 - (frequencyDiff / maxFrequency) : 1;
    score += frequencySimilarity * 0.3;
    maxScore += 0.3;

    // Sample values similarity (20%)
    const sampleSimilarity = this.calculateSampleValuesSimilarity(
      shopeeField.sampleValues,
      tiktokField.sampleValues
    );
    score += sampleSimilarity * 0.2;
    maxScore += 0.2;

    return maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;
  }

  /**
   * Calculate similarity between sample values
   */
  private calculateSampleValuesSimilarity(samples1: any[], samples2: any[]): number {
    if (samples1.length === 0 && samples2.length === 0) return 1;
    if (samples1.length === 0 || samples2.length === 0) return 0;

    let matches = 0;
    const maxSamples = Math.max(samples1.length, samples2.length);

    samples1.forEach(sample1 => {
      if (samples2.some(sample2 => this.valuesAreSimilar(sample1, sample2))) {
        matches++;
      }
    });

    return matches / maxSamples;
  }

  /**
   * Check if two values are similar
   */
  private valuesAreSimilar(value1: any, value2: any): boolean {
    if (value1 === value2) return true;
    
    if (typeof value1 === 'string' && typeof value2 === 'string') {
      return this.calculateStringSimilarity(value1.toLowerCase(), value2.toLowerCase()) > 0.8;
    }
    
    if (typeof value1 === 'number' && typeof value2 === 'number') {
      const diff = Math.abs(value1 - value2);
      const avg = (value1 + value2) / 2;
      return avg > 0 ? (diff / avg) < 0.1 : diff < 0.01;
    }
    
    return false;
  }

  /**
   * Analyze product quality for a platform
   */
  private analyzeProductQuality(products: any[], platform: string): any {
    let validProducts = 0;
    let missingRequiredFields = 0;
    let invalidPrices = 0;
    let missingImages = 0;
    let tokopediaEnabledCount = 0;

    products.forEach(product => {
      let isValid = true;

      // Check required fields
      const title = product.item_name || product.product_name || product.title;
      const price = product.price;
      const images = product.images || [];

      if (!title || title.trim().length === 0) {
        missingRequiredFields++;
        isValid = false;
      }

      if (!price || price <= 0) {
        invalidPrices++;
        isValid = false;
      }

      if (!images || images.length === 0) {
        missingImages++;
        isValid = false;
      }

      // TikTok specific checks
      if (platform === 'tiktok' && product.include_tokopedia) {
        tokopediaEnabledCount++;
      }

      if (isValid) {
        validProducts++;
      }
    });

    const qualityScore = products.length > 0 ? (validProducts / products.length) * 100 : 0;

    const result: any = {
      totalProducts: products.length,
      validProducts,
      missingRequiredFields,
      invalidPrices,
      missingImages,
      qualityScore: Math.round(qualityScore * 100) / 100
    };

    if (platform === 'tiktok') {
      result.tokopediaEnabledCount = tokopediaEnabledCount;
    }

    return result;
  }
}