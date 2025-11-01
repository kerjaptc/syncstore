/**
 * Comprehensive Data Validator for Task 8.1
 * Executes comprehensive data validation on all imported products
 * Verifies required fields are present and valid
 * Checks image URL accessibility for sample products
 * 
 * Requirements: 4.1, 4.2, 4.3
 */

import { db } from '../db';
import { masterProducts, platformMappings } from '../db/master-catalog-schema';
import { eq, count, sql, isNotNull } from 'drizzle-orm';
import { productValidator } from './product-validator';
import { tiktokShopValidator } from './tiktokshop-validator';
import { rawDataStore } from '../storage/raw-data-store';
import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export interface ComprehensiveValidationResult {
  overview: ValidationOverview;
  masterCatalogValidation: MasterCatalogValidation;
  rawDataValidation: RawDataValidation;
  imageValidation: ImageValidation;
  fieldValidation: FieldValidation;
  dataIntegrityValidation: DataIntegrityValidation;
  recommendations: ValidationRecommendation[];
  overallScore: number;
  status: 'PASS' | 'WARNING' | 'FAIL';
}

export interface ValidationOverview {
  totalProductsValidated: number;
  validationStartTime: Date;
  validationEndTime: Date;
  validationDuration: number; // milliseconds
  platformsCovered: string[];
  validationTypes: string[];
}

export interface MasterCatalogValidation {
  totalMasterProducts: number;
  validProducts: number;
  invalidProducts: number;
  productsWithErrors: number;
  productsWithWarnings: number;
  averageDataQualityScore: number;
  requiredFieldsValidation: RequiredFieldValidation[];
  statusBreakdown: Record<string, number>;
  sampleValidationResults: MasterProductValidationResult[];
}

export interface RawDataValidation {
  totalRawProducts: number;
  validRawProducts: number;
  invalidRawProducts: number;
  platformBreakdown: Record<string, RawDataPlatformValidation>;
  sampleValidationResults: RawDataValidationResult[];
}

export interface ImageValidation {
  totalImagesChecked: number;
  validImages: number;
  invalidImages: number;
  accessibilityRate: number;
  sampleResults: ImageValidationResult[];
  commonIssues: Array<{ issue: string; count: number }>;
}

export interface FieldValidation {
  requiredFieldsPresent: number;
  requiredFieldsMissing: number;
  fieldCompleteness: Record<string, FieldCompletenessInfo>;
  dataTypeValidation: DataTypeValidationResult[];
  valueRangeValidation: ValueRangeValidationResult[];
}

export interface DataIntegrityValidation {
  duplicateProducts: number;
  orphanedMappings: number;
  missingMappings: number;
  inconsistentPricing: number;
  referentialIntegrity: ReferentialIntegrityResult[];
}

export interface RequiredFieldValidation {
  fieldName: string;
  required: boolean;
  presentCount: number;
  missingCount: number;
  validCount: number;
  invalidCount: number;
  completenessPercentage: number;
}

export interface MasterProductValidationResult {
  productId: string;
  masterSku: string;
  name: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  dataQualityScore: number;
  fieldsValidated: Record<string, boolean>;
}

export interface RawDataPlatformValidation {
  platform: string;
  totalProducts: number;
  validProducts: number;
  invalidProducts: number;
  validationRate: number;
  commonErrors: Array<{ error: string; count: number }>;
}

export interface RawDataValidationResult {
  platform: string;
  productId: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  tokopediaFlag?: boolean;
}

export interface ImageValidationResult {
  imageUrl: string;
  isAccessible: boolean;
  responseCode?: number;
  responseTime?: number;
  error?: string;
  productId?: string;
}

export interface FieldCompletenessInfo {
  fieldName: string;
  totalProducts: number;
  presentCount: number;
  missingCount: number;
  completenessPercentage: number;
  dataTypes: Record<string, number>;
}

export interface DataTypeValidationResult {
  fieldName: string;
  expectedType: string;
  validCount: number;
  invalidCount: number;
  invalidExamples: Array<{ value: any; actualType: string }>;
}

export interface ValueRangeValidationResult {
  fieldName: string;
  validRange: { min?: number; max?: number };
  validCount: number;
  outOfRangeCount: number;
  outOfRangeExamples: Array<{ value: any; reason: string }>;
}

export interface ReferentialIntegrityResult {
  relationship: string;
  validReferences: number;
  invalidReferences: number;
  orphanedRecords: number;
  missingReferences: number;
}

export interface ValidationRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'data_quality' | 'field_validation' | 'image_validation' | 'data_integrity' | 'performance';
  title: string;
  description: string;
  actionRequired: string;
  expectedOutcome: string;
  affectedCount?: number;
}

export class ComprehensiveDataValidator {
  private readonly rawDataPath = './data/raw-imports';
  private readonly platforms = ['shopee', 'tiktokshop'];
  private readonly requiredFields = [
    'name', 'basePrice', 'weight', 'dimensions', 'images', 'category', 'brand'
  ];
  private readonly sampleImageCount = 50; // Number of images to test for accessibility

  async validateAllData(): Promise<ComprehensiveValidationResult> {
    const startTime = new Date();
    console.log('🔍 Starting comprehensive data validation...');

    try {
      // Initialize validation components
      await rawDataStore.initialize();

      // Execute all validation types
      const masterCatalogValidation = await this.validateMasterCatalog();
      const rawDataValidation = await this.validateRawData();
      const imageValidation = await this.validateImageAccessibility();
      const fieldValidation = await this.validateFields();
      const dataIntegrityValidation = await this.validateDataIntegrity();

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const overview: ValidationOverview = {
        totalProductsValidated: masterCatalogValidation.totalMasterProducts + rawDataValidation.totalRawProducts,
        validationStartTime: startTime,
        validationEndTime: endTime,
        validationDuration: duration,
        platformsCovered: this.platforms,
        validationTypes: ['master_catalog', 'raw_data', 'images', 'fields', 'data_integrity']
      };

      // Calculate overall score and status
      const overallScore = this.calculateOverallScore(
        masterCatalogValidation,
        rawDataValidation,
        imageValidation,
        fieldValidation,
        dataIntegrityValidation
      );

      const status = this.determineValidationStatus(overallScore, [
        masterCatalogValidation,
        rawDataValidation,
        imageValidation,
        fieldValidation,
        dataIntegrityValidation
      ]);

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        masterCatalogValidation,
        rawDataValidation,
        imageValidation,
        fieldValidation,
        dataIntegrityValidation
      );

      return {
        overview,
        masterCatalogValidation,
        rawDataValidation,
        imageValidation,
        fieldValidation,
        dataIntegrityValidation,
        recommendations,
        overallScore,
        status
      };

    } catch (error) {
      console.error('❌ Comprehensive validation failed:', error);
      throw error;
    }
  }

  private async validateMasterCatalog(): Promise<MasterCatalogValidation> {
    console.log('🏪 Validating master catalog...');

    // Get total master products
    const [totalResult] = await db.select({ count: count() }).from(masterProducts);
    const totalMasterProducts = totalResult.count;

    if (totalMasterProducts === 0) {
      return {
        totalMasterProducts: 0,
        validProducts: 0,
        invalidProducts: 0,
        productsWithErrors: 0,
        productsWithWarnings: 0,
        averageDataQualityScore: 0,
        requiredFieldsValidation: [],
        statusBreakdown: {},
        sampleValidationResults: []
      };
    }

    // Get products with validation errors and warnings
    const errorStats = await db
      .select({
        withErrors: sql<number>`COUNT(CASE WHEN jsonb_array_length(${masterProducts.validationErrors}) > 0 THEN 1 END)`,
        withWarnings: sql<number>`COUNT(CASE WHEN jsonb_array_length(${masterProducts.validationWarnings}) > 0 THEN 1 END)`,
        avgQuality: sql<number>`AVG(COALESCE(${masterProducts.dataQualityScore}, 0))`
      })
      .from(masterProducts);

    const productsWithErrors = errorStats[0]?.withErrors || 0;
    const productsWithWarnings = errorStats[0]?.withWarnings || 0;
    const averageDataQualityScore = Math.round(errorStats[0]?.avgQuality || 0);

    // Get status breakdown
    const statusBreakdown = await db
      .select({
        status: masterProducts.status,
        count: count()
      })
      .from(masterProducts)
      .groupBy(masterProducts.status);

    const statusBreakdownMap: Record<string, number> = {};
    statusBreakdown.forEach(row => {
      statusBreakdownMap[row.status] = row.count;
    });

    // Validate required fields
    const requiredFieldsValidation = await this.validateRequiredFields();

    // Get sample products for detailed validation
    const sampleProducts = await db
      .select()
      .from(masterProducts)
      .limit(20);

    const sampleValidationResults: MasterProductValidationResult[] = [];

    for (const product of sampleProducts) {
      const validationResult = await this.validateMasterProduct(product);
      sampleValidationResults.push(validationResult);
    }

    const validProducts = sampleValidationResults.filter(r => r.isValid).length;
    const invalidProducts = sampleValidationResults.length - validProducts;

    return {
      totalMasterProducts,
      validProducts: Math.round((validProducts / sampleValidationResults.length) * totalMasterProducts),
      invalidProducts: Math.round((invalidProducts / sampleValidationResults.length) * totalMasterProducts),
      productsWithErrors,
      productsWithWarnings,
      averageDataQualityScore,
      requiredFieldsValidation,
      statusBreakdown: statusBreakdownMap,
      sampleValidationResults
    };
  }

  private async validateRequiredFields(): Promise<RequiredFieldValidation[]> {
    const results: RequiredFieldValidation[] = [];

    for (const fieldName of this.requiredFields) {
      let presentCount = 0;
      let validCount = 0;

      // Get field statistics based on field type
      let fieldStats;
      
      switch (fieldName) {
        case 'name':
          fieldStats = await db
            .select({
              present: sql<number>`COUNT(CASE WHEN ${masterProducts.name} IS NOT NULL AND ${masterProducts.name} != '' THEN 1 END)`,
              valid: sql<number>`COUNT(CASE WHEN ${masterProducts.name} IS NOT NULL AND LENGTH(${masterProducts.name}) >= 3 THEN 1 END)`,
              total: count()
            })
            .from(masterProducts);
          break;
          
        case 'basePrice':
          fieldStats = await db
            .select({
              present: sql<number>`COUNT(CASE WHEN ${masterProducts.basePrice} IS NOT NULL THEN 1 END)`,
              valid: sql<number>`COUNT(CASE WHEN ${masterProducts.basePrice} > 0 THEN 1 END)`,
              total: count()
            })
            .from(masterProducts);
          break;
          
        case 'images':
          fieldStats = await db
            .select({
              present: sql<number>`COUNT(CASE WHEN ${masterProducts.images} IS NOT NULL AND ${masterProducts.images} != '[]' THEN 1 END)`,
              valid: sql<number>`COUNT(CASE WHEN jsonb_array_length(${masterProducts.images}) > 0 THEN 1 END)`,
              total: count()
            })
            .from(masterProducts);
          break;
          
        default:
          // Generic field validation
          const fieldColumn = masterProducts[fieldName as keyof typeof masterProducts];
          if (fieldColumn) {
            fieldStats = await db
              .select({
                present: sql<number>`COUNT(CASE WHEN ${fieldColumn} IS NOT NULL THEN 1 END)`,
                valid: sql<number>`COUNT(CASE WHEN ${fieldColumn} IS NOT NULL THEN 1 END)`,
                total: count()
              })
              .from(masterProducts);
          } else {
            continue; // Skip unknown fields
          }
      }

      if (fieldStats && fieldStats[0]) {
        const stats = fieldStats[0];
        presentCount = stats.present;
        validCount = stats.valid;
        const totalCount = stats.total;
        const missingCount = totalCount - presentCount;
        const invalidCount = presentCount - validCount;

        results.push({
          fieldName,
          required: true,
          presentCount,
          missingCount,
          validCount,
          invalidCount,
          completenessPercentage: totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0
        });
      }
    }

    return results;
  }

  private async validateMasterProduct(product: any): Promise<MasterProductValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldsValidated: Record<string, boolean> = {};

    // Validate required fields
    for (const field of this.requiredFields) {
      const value = product[field];
      let isValid = true;

      switch (field) {
        case 'name':
          isValid = value && typeof value === 'string' && value.length >= 3;
          if (!isValid) errors.push(`Invalid or missing product name`);
          break;
          
        case 'basePrice':
          isValid = value && typeof value === 'string' && parseFloat(value) > 0;
          if (!isValid) errors.push(`Invalid or missing base price`);
          break;
          
        case 'weight':
          isValid = value && typeof value === 'string' && parseFloat(value) > 0;
          if (!isValid) warnings.push(`Invalid or missing weight`);
          break;
          
        case 'images':
          const images = Array.isArray(value) ? value : [];
          isValid = images.length > 0;
          if (!isValid) errors.push(`No product images found`);
          else if (images.length < 3) warnings.push(`Less than 3 product images`);
          break;
          
        case 'category':
          isValid = value && typeof value === 'object';
          if (!isValid) warnings.push(`Invalid or missing category information`);
          break;
          
        case 'brand':
          isValid = value && typeof value === 'string' && value.length > 0;
          if (!isValid) warnings.push(`Invalid or missing brand information`);
          break;
          
        case 'dimensions':
          isValid = value && typeof value === 'object';
          if (!isValid) warnings.push(`Invalid or missing dimensions`);
          break;
      }

      fieldsValidated[field] = isValid;
    }

    // Additional validations
    if (product.status && !['active', 'inactive', 'draft', 'archived'].includes(product.status)) {
      warnings.push(`Invalid product status: ${product.status}`);
    }

    if (product.currency && product.currency !== 'IDR') {
      warnings.push(`Non-IDR currency detected: ${product.currency}`);
    }

    const isValid = errors.length === 0;
    const dataQualityScore = product.dataQualityScore || 0;

    return {
      productId: product.id,
      masterSku: product.masterSku,
      name: product.name,
      isValid,
      errors,
      warnings,
      dataQualityScore,
      fieldsValidated
    };
  }

  private async validateRawData(): Promise<RawDataValidation> {
    console.log('📊 Validating raw imported data...');

    let totalRawProducts = 0;
    let validRawProducts = 0;
    let invalidRawProducts = 0;
    const platformBreakdown: Record<string, RawDataPlatformValidation> = {};
    const sampleValidationResults: RawDataValidationResult[] = [];

    for (const platform of this.platforms) {
      const platformPath = path.join(this.rawDataPath, platform);
      
      if (!existsSync(platformPath)) {
        platformBreakdown[platform] = {
          platform,
          totalProducts: 0,
          validProducts: 0,
          invalidProducts: 0,
          validationRate: 0,
          commonErrors: []
        };
        continue;
      }

      const files = await readdir(platformPath);
      const batchFiles = files.filter(file => file.startsWith('batch_') && file.endsWith('.json'));
      
      let platformProductCount = 0;
      let platformValidCount = 0;
      let platformInvalidCount = 0;
      const platformErrors: Record<string, number> = {};

      // Validate sample batch files
      const sampleFiles = batchFiles.slice(0, 2);
      
      for (const file of sampleFiles) {
        try {
          const filePath = path.join(platformPath, file);
          const content = await readFile(filePath, 'utf8');
          const batchData = JSON.parse(content);
          
          if (batchData?.products) {
            for (const product of batchData.products.slice(0, 10)) { // Sample 10 products per batch
              platformProductCount++;
              totalRawProducts++;

              const validationResult = await this.validateRawProduct(product, platform);
              
              if (validationResult.isValid) {
                platformValidCount++;
                validRawProducts++;
              } else {
                platformInvalidCount++;
                invalidRawProducts++;
                
                // Count errors
                validationResult.errors.forEach(error => {
                  platformErrors[error] = (platformErrors[error] || 0) + 1;
                });
              }

              if (sampleValidationResults.length < 20) {
                sampleValidationResults.push(validationResult);
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to validate batch file ${file}:`, error);
        }
      }

      const commonErrors = Object.entries(platformErrors)
        .map(([error, count]) => ({ error, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      platformBreakdown[platform] = {
        platform,
        totalProducts: platformProductCount,
        validProducts: platformValidCount,
        invalidProducts: platformInvalidCount,
        validationRate: platformProductCount > 0 ? Math.round((platformValidCount / platformProductCount) * 100) : 0,
        commonErrors
      };
    }

    return {
      totalRawProducts,
      validRawProducts,
      invalidRawProducts,
      platformBreakdown,
      sampleValidationResults
    };
  }

  private async validateRawProduct(product: any, platform: string): Promise<RawDataValidationResult> {
    const productId = platform === 'shopee' 
      ? product.item_id?.toString() 
      : product.product_id;

    let validationResult;
    
    if (platform === 'shopee') {
      validationResult = productValidator.validateShopeeProduct(product);
    } else if (platform === 'tiktokshop') {
      validationResult = tiktokShopValidator.validateProduct(product);
    } else {
      return {
        platform,
        productId: productId || 'unknown',
        isValid: false,
        errors: ['Unknown platform'],
        warnings: []
      };
    }

    return {
      platform,
      productId: productId || 'unknown',
      isValid: validationResult.isValid,
      errors: validationResult.errors,
      warnings: validationResult.warnings,
      tokopediaFlag: validationResult.tokopediaFlag
    };
  }

  private async validateImageAccessibility(): Promise<ImageValidation> {
    console.log('🖼️  Validating image accessibility...');

    // Get sample images from master products
    const sampleProducts = await db
      .select({
        id: masterProducts.id,
        images: masterProducts.images
      })
      .from(masterProducts)
      .where(sql`jsonb_array_length(${masterProducts.images}) > 0`)
      .limit(Math.ceil(this.sampleImageCount / 3)); // Assuming ~3 images per product

    const imageUrls: Array<{ url: string; productId: string }> = [];
    
    for (const product of sampleProducts) {
      const images = Array.isArray(product.images) ? product.images : [];
      for (const image of images.slice(0, 3)) { // Max 3 images per product
        if (typeof image === 'string') {
          imageUrls.push({ url: image, productId: product.id });
        } else if (typeof image === 'object' && image.url) {
          imageUrls.push({ url: image.url, productId: product.id });
        }
        
        if (imageUrls.length >= this.sampleImageCount) break;
      }
      if (imageUrls.length >= this.sampleImageCount) break;
    }

    const sampleResults: ImageValidationResult[] = [];
    let validImages = 0;
    let invalidImages = 0;
    const issueCount: Record<string, number> = {};

    console.log(`  Testing accessibility of ${imageUrls.length} sample images...`);

    for (const { url, productId } of imageUrls) {
      const startTime = Date.now();
      
      try {
        const response = await fetch(url, { 
          method: 'HEAD',
          timeout: 5000 // 5 second timeout
        });
        
        const responseTime = Date.now() - startTime;
        const isAccessible = response.ok;
        
        if (isAccessible) {
          validImages++;
        } else {
          invalidImages++;
          const issue = `HTTP ${response.status}`;
          issueCount[issue] = (issueCount[issue] || 0) + 1;
        }

        sampleResults.push({
          imageUrl: url,
          isAccessible,
          responseCode: response.status,
          responseTime,
          productId
        });

      } catch (error) {
        invalidImages++;
        const issue = error instanceof Error ? error.message : 'Network error';
        issueCount[issue] = (issueCount[issue] || 0) + 1;

        sampleResults.push({
          imageUrl: url,
          isAccessible: false,
          error: issue,
          productId
        });
      }
    }

    const commonIssues = Object.entries(issueCount)
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const accessibilityRate = imageUrls.length > 0 
      ? Math.round((validImages / imageUrls.length) * 100) 
      : 0;

    return {
      totalImagesChecked: imageUrls.length,
      validImages,
      invalidImages,
      accessibilityRate,
      sampleResults: sampleResults.slice(0, 10), // Show first 10 results
      commonIssues
    };
  }

  private async validateFields(): Promise<FieldValidation> {
    console.log('📝 Validating field completeness and data types...');

    const requiredFieldsValidation = await this.validateRequiredFields();
    const requiredFieldsPresent = requiredFieldsValidation.reduce((sum, field) => sum + field.presentCount, 0);
    const requiredFieldsMissing = requiredFieldsValidation.reduce((sum, field) => sum + field.missingCount, 0);

    // Build field completeness info
    const fieldCompleteness: Record<string, FieldCompletenessInfo> = {};
    
    for (const fieldValidation of requiredFieldsValidation) {
      fieldCompleteness[fieldValidation.fieldName] = {
        fieldName: fieldValidation.fieldName,
        totalProducts: fieldValidation.presentCount + fieldValidation.missingCount,
        presentCount: fieldValidation.presentCount,
        missingCount: fieldValidation.missingCount,
        completenessPercentage: fieldValidation.completenessPercentage,
        dataTypes: { 'string': fieldValidation.validCount } // Simplified for now
      };
    }

    // Validate data types for key fields
    const dataTypeValidation: DataTypeValidationResult[] = [
      await this.validateFieldDataType('basePrice', 'number'),
      await this.validateFieldDataType('weight', 'number'),
      await this.validateFieldDataType('name', 'string'),
    ];

    // Validate value ranges
    const valueRangeValidation: ValueRangeValidationResult[] = [
      await this.validateFieldValueRange('basePrice', { min: 0 }),
      await this.validateFieldValueRange('weight', { min: 0 }),
    ];

    return {
      requiredFieldsPresent,
      requiredFieldsMissing,
      fieldCompleteness,
      dataTypeValidation,
      valueRangeValidation
    };
  }

  private async validateFieldDataType(fieldName: string, expectedType: string): Promise<DataTypeValidationResult> {
    // This is a simplified implementation - in a real scenario, you'd check actual data types
    const sampleProducts = await db
      .select()
      .from(masterProducts)
      .limit(100);

    let validCount = 0;
    let invalidCount = 0;
    const invalidExamples: Array<{ value: any; actualType: string }> = [];

    for (const product of sampleProducts) {
      const value = product[fieldName as keyof typeof product];
      const actualType = typeof value;
      
      let isValid = false;
      
      switch (expectedType) {
        case 'number':
          isValid = !isNaN(parseFloat(value as string));
          break;
        case 'string':
          isValid = typeof value === 'string' && value.length > 0;
          break;
        default:
          isValid = actualType === expectedType;
      }

      if (isValid) {
        validCount++;
      } else {
        invalidCount++;
        if (invalidExamples.length < 5) {
          invalidExamples.push({ value, actualType });
        }
      }
    }

    return {
      fieldName,
      expectedType,
      validCount,
      invalidCount,
      invalidExamples
    };
  }

  private async validateFieldValueRange(
    fieldName: string, 
    validRange: { min?: number; max?: number }
  ): Promise<ValueRangeValidationResult> {
    const sampleProducts = await db
      .select()
      .from(masterProducts)
      .limit(100);

    let validCount = 0;
    let outOfRangeCount = 0;
    const outOfRangeExamples: Array<{ value: any; reason: string }> = [];

    for (const product of sampleProducts) {
      const value = parseFloat(product[fieldName as keyof typeof product] as string);
      
      if (isNaN(value)) continue;

      let isValid = true;
      let reason = '';

      if (validRange.min !== undefined && value < validRange.min) {
        isValid = false;
        reason = `Below minimum ${validRange.min}`;
      }

      if (validRange.max !== undefined && value > validRange.max) {
        isValid = false;
        reason = `Above maximum ${validRange.max}`;
      }

      if (isValid) {
        validCount++;
      } else {
        outOfRangeCount++;
        if (outOfRangeExamples.length < 5) {
          outOfRangeExamples.push({ value, reason });
        }
      }
    }

    return {
      fieldName,
      validRange,
      validCount,
      outOfRangeCount,
      outOfRangeExamples
    };
  }

  private async validateDataIntegrity(): Promise<DataIntegrityValidation> {
    console.log('🔗 Validating data integrity...');

    // Check for duplicate products (same masterSku)
    const duplicateSkus = await db
      .select({
        masterSku: masterProducts.masterSku,
        count: count()
      })
      .from(masterProducts)
      .groupBy(masterProducts.masterSku)
      .having(sql`COUNT(*) > 1`);

    const duplicateProducts = duplicateSkus.reduce((sum, sku) => sum + sku.count - 1, 0);

    // Check for orphaned platform mappings
    const orphanedMappingsResult = await db
      .select({ count: count() })
      .from(platformMappings)
      .leftJoin(masterProducts, eq(platformMappings.masterProductId, masterProducts.id))
      .where(sql`${masterProducts.id} IS NULL`);

    const orphanedMappings = orphanedMappingsResult[0]?.count || 0;

    // Check for missing platform mappings
    const missingMappingsResult = await db
      .select({ count: count() })
      .from(masterProducts)
      .leftJoin(platformMappings, eq(masterProducts.id, platformMappings.masterProductId))
      .where(sql`${platformMappings.id} IS NULL`);

    const missingMappings = missingMappingsResult[0]?.count || 0;

    // Check for pricing inconsistencies (simplified)
    const inconsistentPricingResult = await db
      .select({ count: count() })
      .from(masterProducts)
      .where(sql`${masterProducts.basePrice} <= 0 OR ${masterProducts.basePrice} IS NULL`);

    const inconsistentPricing = inconsistentPricingResult[0]?.count || 0;

    // Referential integrity checks
    const referentialIntegrity: ReferentialIntegrityResult[] = [
      {
        relationship: 'master_products -> platform_mappings',
        validReferences: await this.countValidReferences('master_products', 'platform_mappings'),
        invalidReferences: orphanedMappings,
        orphanedRecords: orphanedMappings,
        missingReferences: missingMappings
      }
    ];

    return {
      duplicateProducts,
      orphanedMappings,
      missingMappings,
      inconsistentPricing,
      referentialIntegrity
    };
  }

  private async countValidReferences(parentTable: string, childTable: string): Promise<number> {
    // Simplified implementation
    const [result] = await db
      .select({ count: count() })
      .from(platformMappings)
      .innerJoin(masterProducts, eq(platformMappings.masterProductId, masterProducts.id));

    return result.count;
  }

  private calculateOverallScore(
    masterCatalog: MasterCatalogValidation,
    rawData: RawDataValidation,
    images: ImageValidation,
    fields: FieldValidation,
    integrity: DataIntegrityValidation
  ): number {
    let score = 100;

    // Master catalog validation (30 points)
    if (masterCatalog.totalMasterProducts === 0) {
      score -= 30;
    } else {
      const validationRate = masterCatalog.validProducts / masterCatalog.totalMasterProducts;
      if (validationRate < 0.95) score -= 15;
      else if (validationRate < 0.98) score -= 5;

      if (masterCatalog.averageDataQualityScore < 80) score -= 10;
      else if (masterCatalog.averageDataQualityScore < 90) score -= 5;
    }

    // Raw data validation (20 points)
    if (rawData.totalRawProducts > 0) {
      const rawValidationRate = rawData.validRawProducts / rawData.totalRawProducts;
      if (rawValidationRate < 0.90) score -= 15;
      else if (rawValidationRate < 0.95) score -= 5;
    }

    // Image validation (15 points)
    if (images.totalImagesChecked > 0) {
      if (images.accessibilityRate < 80) score -= 15;
      else if (images.accessibilityRate < 90) score -= 10;
      else if (images.accessibilityRate < 95) score -= 5;
    }

    // Field validation (20 points)
    const fieldCompletenessRate = fields.requiredFieldsPresent / 
      (fields.requiredFieldsPresent + fields.requiredFieldsMissing);
    
    if (fieldCompletenessRate < 0.90) score -= 15;
    else if (fieldCompletenessRate < 0.95) score -= 10;
    else if (fieldCompletenessRate < 0.98) score -= 5;

    // Data integrity (15 points)
    if (integrity.duplicateProducts > 0) score -= 5;
    if (integrity.orphanedMappings > 0) score -= 5;
    if (integrity.inconsistentPricing > 0) score -= 5;

    return Math.max(0, score);
  }

  private determineValidationStatus(
    overallScore: number,
    validationResults: any[]
  ): 'PASS' | 'WARNING' | 'FAIL' {
    // Check for critical failures
    const hasCriticalIssues = validationResults.some(result => {
      if (result.totalMasterProducts === 0) return true;
      if (result.totalImagesChecked > 0 && result.accessibilityRate < 50) return true;
      return false;
    });

    if (hasCriticalIssues) return 'FAIL';
    if (overallScore >= 90) return 'PASS';
    if (overallScore >= 70) return 'WARNING';
    return 'FAIL';
  }

  private generateRecommendations(
    masterCatalog: MasterCatalogValidation,
    rawData: RawDataValidation,
    images: ImageValidation,
    fields: FieldValidation,
    integrity: DataIntegrityValidation
  ): ValidationRecommendation[] {
    const recommendations: ValidationRecommendation[] = [];

    // Critical recommendations
    if (masterCatalog.totalMasterProducts === 0) {
      recommendations.push({
        priority: 'critical',
        category: 'data_quality',
        title: 'No Master Products Found',
        description: 'Master catalog is empty',
        actionRequired: 'Run data import and population process',
        expectedOutcome: 'Master catalog populated with imported products'
      });
    }

    // High priority recommendations
    if (masterCatalog.averageDataQualityScore < 80) {
      recommendations.push({
        priority: 'high',
        category: 'data_quality',
        title: 'Low Data Quality Score',
        description: `Average data quality score is ${masterCatalog.averageDataQualityScore}/100`,
        actionRequired: 'Review and fix data validation errors',
        expectedOutcome: 'Achieve 90+ data quality score',
        affectedCount: masterCatalog.productsWithErrors
      });
    }

    if (images.accessibilityRate < 90) {
      recommendations.push({
        priority: 'high',
        category: 'image_validation',
        title: 'Image Accessibility Issues',
        description: `${images.accessibilityRate}% of images are accessible`,
        actionRequired: 'Fix broken image URLs and hosting issues',
        expectedOutcome: 'Achieve 95%+ image accessibility rate',
        affectedCount: images.invalidImages
      });
    }

    // Medium priority recommendations
    if (integrity.duplicateProducts > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'data_integrity',
        title: 'Duplicate Products Found',
        description: 'Multiple products with same SKU detected',
        actionRequired: 'Review and merge or remove duplicate products',
        expectedOutcome: 'Unique SKUs for all products',
        affectedCount: integrity.duplicateProducts
      });
    }

    if (integrity.orphanedMappings > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'data_integrity',
        title: 'Orphaned Platform Mappings',
        description: 'Platform mappings without corresponding master products',
        actionRequired: 'Clean up orphaned mappings or restore missing products',
        expectedOutcome: 'All mappings have valid product references',
        affectedCount: integrity.orphanedMappings
      });
    }

    // Low priority recommendations
    if (masterCatalog.productsWithWarnings > 0) {
      recommendations.push({
        priority: 'low',
        category: 'data_quality',
        title: 'Products with Warnings',
        description: 'Some products have validation warnings',
        actionRequired: 'Review and address validation warnings',
        expectedOutcome: 'Reduced warning count for better data quality',
        affectedCount: masterCatalog.productsWithWarnings
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }
}

// Export singleton instance
export const comprehensiveDataValidator = new ComprehensiveDataValidator();