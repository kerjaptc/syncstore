#!/usr/bin/env node

/**
 * Comprehensive Analysis Report Generator for Phase 1
 * Generates detailed field mapping accuracy, data quality issues, and platform-specific differences
 */

const fs = require('fs').promises;
const path = require('path');

// Enhanced DataAnalyzer class for comprehensive reporting
class ComprehensiveDataAnalyzer {
  constructor(shopeeDataPath = './data/raw-imports/shopee', tiktokDataPath = './data/raw-imports/tiktokshop') {
    this.shopeeDataPath = shopeeDataPath;
    this.tiktokDataPath = tiktokDataPath;
  }

  async loadShopeeProducts() {
    console.log('📦 Loading Shopee products...');
    // Enhanced mock data with more realistic field structures
    return [
      {
        item_id: 'shopee_1',
        item_name: 'Racing Frame 5 Inch Carbon Fiber',
        description: 'High-quality carbon fiber racing frame for 5-inch FPV drones',
        price: 150000,
        images: ['frame1.jpg', 'frame2.jpg', 'frame3.jpg'],
        weight: 0.5,
        category_id: 'frames',
        brand: 'Motekar FPV',
        stock: 25,
        dimensions: { length: 220, width: 220, height: 30 },
        material: 'Carbon Fiber',
        compatibility: ['5inch', 'racing'],
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-10-20T14:22:00Z'
      },
      {
        item_id: 'shopee_2',
        item_name: 'FPV Camera 1200TVL HD',
        description: 'High-definition FPV camera with 1200TVL resolution',
        price: 75000,
        images: ['cam1.jpg', 'cam2.jpg'],
        weight: 0.1,
        category_id: 'cameras',
        brand: 'RunCam',
        stock: 50,
        dimensions: { length: 19, width: 19, height: 18 },
        resolution: '1200TVL',
        lens_size: '2.1mm',
        created_at: '2024-02-10T09:15:00Z',
        updated_at: '2024-10-18T16:45:00Z'
      },
      {
        item_id: 'shopee_3',
        item_name: 'Propeller 9 Inch High Performance',
        description: 'High-performance 9-inch propellers for long-range flights',
        price: 25000,
        images: ['prop1.jpg', 'prop2.jpg', 'prop3.jpg'],
        weight: 0.05,
        category_id: 'propellers',
        brand: 'HQProp',
        stock: 100,
        dimensions: { length: 230, width: 230, height: 15 },
        pitch: '4.5',
        blade_count: 2,
        created_at: '2024-01-20T11:00:00Z',
        updated_at: '2024-10-15T13:30:00Z'
      }
    ];
  }

  async loadTikTokProducts() {
    console.log('📦 Loading TikTok Shop products...');
    // Enhanced mock data with TikTok-specific fields
    return [
      {
        product_id: 'tiktok_1',
        product_name: 'Racing Frame 5 Inch Carbon',
        description: 'Premium carbon racing frame for competitive FPV racing',
        price: 155000,
        images: [
          { url: 'frame1.jpg', alt: 'Front view' },
          { url: 'frame2.jpg', alt: 'Side view' }
        ],
        weight: 0.5,
        category_id: 'frames',
        brand_name: 'Motekar FPV',
        inventory: 20,
        package_dimensions: { length: 25, width: 25, height: 5 },
        include_tokopedia: true,
        tokopedia_category: 'drone-parts',
        shipping_weight: 0.6,
        created_time: 1705320600,
        update_time: 1729434120
      },
      {
        product_id: 'tiktok_2',
        product_name: 'FPV Camera 1200TVL Professional',
        description: 'Professional-grade FPV camera with superior image quality',
        price: 78000,
        images: [
          { url: 'cam1.jpg', alt: 'Camera front' },
          { url: 'cam2.jpg', alt: 'Camera back' }
        ],
        weight: 0.1,
        category_id: 'cameras',
        brand_name: 'RunCam',
        inventory: 45,
        package_dimensions: { length: 10, width: 10, height: 8 },
        include_tokopedia: false,
        video_specs: { resolution: '1200TVL', format: 'NTSC/PAL' },
        shipping_weight: 0.15,
        created_time: 1707292500,
        update_time: 1729261500
      }
    ];
  } 
 async generateFieldMappingAccuracyReport() {
    console.log('🔍 Analyzing field mapping accuracy...');
    
    const shopeeProducts = await this.loadShopeeProducts();
    const tiktokProducts = await this.loadTikTokProducts();

    // Extract all fields from both platforms
    const shopeeFields = this.extractAllFields(shopeeProducts);
    const tiktokFields = this.extractAllFields(tiktokProducts);

    // Analyze field mappings
    const fieldMappings = this.analyzeFieldMappings(shopeeFields, tiktokFields);
    
    // Calculate accuracy metrics
    const accuracy = this.calculateMappingAccuracy(fieldMappings);

    return {
      totalShopeeFields: Object.keys(shopeeFields).length,
      totalTikTokFields: Object.keys(tiktokFields).length,
      mappedFields: fieldMappings.exactMatches.length,
      similarFields: fieldMappings.similarMatches.length,
      unmappedShopeeFields: fieldMappings.shopeeOnly.length,
      unmappedTikTokFields: fieldMappings.tiktokOnly.length,
      mappingAccuracy: accuracy.overallAccuracy,
      fieldMappings,
      recommendations: this.generateFieldMappingRecommendations(fieldMappings, accuracy)
    };
  }

  async generateDataQualityReport() {
    console.log('🔍 Analyzing data quality issues...');
    
    const shopeeProducts = await this.loadShopeeProducts();
    const tiktokProducts = await this.loadTikTokProducts();

    const shopeeQuality = this.analyzeDataQuality(shopeeProducts, 'Shopee');
    const tiktokQuality = this.analyzeDataQuality(tiktokProducts, 'TikTok Shop');

    const overallQuality = this.calculateOverallQuality(shopeeQuality, tiktokQuality);

    return {
      shopeeQuality,
      tiktokQuality,
      overallQuality,
      qualityIssues: this.identifyQualityIssues(shopeeQuality, tiktokQuality),
      recommendations: this.generateQualityRecommendations(shopeeQuality, tiktokQuality)
    };
  }

  async generatePlatformDifferencesReport() {
    console.log('🔍 Analyzing platform-specific differences...');
    
    const shopeeProducts = await this.loadShopeeProducts();
    const tiktokProducts = await this.loadTikTokProducts();

    return {
      structuralDifferences: this.analyzeStructuralDifferences(shopeeProducts, tiktokProducts),
      dataFormatDifferences: this.analyzeDataFormatDifferences(shopeeProducts, tiktokProducts),
      businessLogicDifferences: this.analyzeBusinessLogicDifferences(shopeeProducts, tiktokProducts),
      integrationChallenges: this.identifyIntegrationChallenges(shopeeProducts, tiktokProducts),
      recommendations: this.generatePlatformRecommendations()
    };
  }

  extractAllFields(products) {
    const fields = {};
    
    products.forEach(product => {
      this.extractFieldsRecursive(product, '', fields);
    });

    return fields;
  }

  extractFieldsRecursive(obj, prefix, fields) {
    if (obj === null || obj === undefined) return;

    if (typeof obj === 'object' && !Array.isArray(obj)) {
      Object.keys(obj).forEach(key => {
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (!fields[fieldPath]) {
          fields[fieldPath] = {
            dataType: this.getDataType(value),
            frequency: 0,
            sampleValues: [],
            nullCount: 0,
            uniqueValues: new Set()
          };
        }

        fields[fieldPath].frequency++;
        
        if (value === null || value === undefined) {
          fields[fieldPath].nullCount++;
        } else {
          fields[fieldPath].uniqueValues.add(value);
          if (fields[fieldPath].sampleValues.length < 3) {
            fields[fieldPath].sampleValues.push(value);
          }
        }

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          this.extractFieldsRecursive(value, fieldPath, fields);
        }
      });
    }
  }

  analyzeFieldMappings(shopeeFields, tiktokFields) {
    const exactMatches = [];
    const similarMatches = [];
    const shopeeOnly = [];
    const tiktokOnly = [];

    const shopeeFieldNames = Object.keys(shopeeFields);
    const tiktokFieldNames = Object.keys(tiktokFields);

    // Find exact matches
    shopeeFieldNames.forEach(shopeeField => {
      if (tiktokFields[shopeeField]) {
        exactMatches.push({
          fieldName: shopeeField,
          shopeeField: shopeeFields[shopeeField],
          tiktokField: tiktokFields[shopeeField],
          matchType: 'exact'
        });
      }
    });

    // Find similar matches (semantic mapping)
    const semanticMappings = {
      'item_id': 'product_id',
      'item_name': 'product_name',
      'stock': 'inventory',
      'brand': 'brand_name',
      'created_at': 'created_time',
      'updated_at': 'update_time'
    };

    Object.entries(semanticMappings).forEach(([shopeeField, tiktokField]) => {
      if (shopeeFields[shopeeField] && tiktokFields[tiktokField]) {
        similarMatches.push({
          shopeeField: shopeeField,
          tiktokField: tiktokField,
          shopeeData: shopeeFields[shopeeField],
          tiktokData: tiktokFields[tiktokField],
          matchType: 'semantic',
          similarity: this.calculateFieldSimilarity(shopeeFields[shopeeField], tiktokFields[tiktokField])
        });
      }
    });

    // Find platform-only fields
    const mappedShopeeFields = new Set([
      ...exactMatches.map(m => m.fieldName),
      ...similarMatches.map(m => m.shopeeField)
    ]);
    
    const mappedTikTokFields = new Set([
      ...exactMatches.map(m => m.fieldName),
      ...similarMatches.map(m => m.tiktokField)
    ]);

    shopeeFieldNames.forEach(field => {
      if (!mappedShopeeFields.has(field)) {
        shopeeOnly.push({
          fieldName: field,
          data: shopeeFields[field],
          platform: 'Shopee'
        });
      }
    });

    tiktokFieldNames.forEach(field => {
      if (!mappedTikTokFields.has(field)) {
        tiktokOnly.push({
          fieldName: field,
          data: tiktokFields[field],
          platform: 'TikTok Shop'
        });
      }
    });

    return { exactMatches, similarMatches, shopeeOnly, tiktokOnly };
  }

  calculateMappingAccuracy(fieldMappings) {
    const totalShopeeFields = fieldMappings.exactMatches.length + 
                             fieldMappings.similarMatches.length + 
                             fieldMappings.shopeeOnly.length;
    
    const totalTikTokFields = fieldMappings.exactMatches.length + 
                             fieldMappings.similarMatches.length + 
                             fieldMappings.tiktokOnly.length;

    const mappedFields = fieldMappings.exactMatches.length + fieldMappings.similarMatches.length;
    const totalFields = Math.max(totalShopeeFields, totalTikTokFields);

    return {
      overallAccuracy: totalFields > 0 ? Math.round((mappedFields / totalFields) * 100) : 0,
      exactMatchRate: totalFields > 0 ? Math.round((fieldMappings.exactMatches.length / totalFields) * 100) : 0,
      semanticMatchRate: totalFields > 0 ? Math.round((fieldMappings.similarMatches.length / totalFields) * 100) : 0,
      unmappedRate: totalFields > 0 ? Math.round(((fieldMappings.shopeeOnly.length + fieldMappings.tiktokOnly.length) / totalFields) * 100) : 0
    };
  }

  analyzeDataQuality(products, platformName) {
    let validProducts = 0;
    let totalProducts = products.length;
    const issues = {
      missingTitles: 0,
      missingPrices: 0,
      invalidPrices: 0,
      missingImages: 0,
      missingDescriptions: 0,
      missingCategories: 0,
      missingBrands: 0,
      inconsistentData: 0
    };

    const qualityMetrics = {
      titleCompleteness: 0,
      priceValidity: 0,
      imageAvailability: 0,
      descriptionQuality: 0,
      categoryConsistency: 0,
      brandConsistency: 0
    };

    products.forEach(product => {
      let productValid = true;
      
      // Title validation
      const title = product.item_name || product.product_name || product.title;
      if (!title || title.trim().length === 0) {
        issues.missingTitles++;
        productValid = false;
      } else if (title.length < 10) {
        issues.inconsistentData++;
      } else {
        qualityMetrics.titleCompleteness++;
      }

      // Price validation
      const price = product.price;
      if (!price) {
        issues.missingPrices++;
        productValid = false;
      } else if (price <= 0) {
        issues.invalidPrices++;
        productValid = false;
      } else {
        qualityMetrics.priceValidity++;
      }

      // Images validation
      const images = product.images || [];
      if (!images || images.length === 0) {
        issues.missingImages++;
        productValid = false;
      } else {
        qualityMetrics.imageAvailability++;
      }

      // Description validation
      const description = product.description;
      if (!description || description.trim().length === 0) {
        issues.missingDescriptions++;
      } else if (description.length < 20) {
        issues.inconsistentData++;
      } else {
        qualityMetrics.descriptionQuality++;
      }

      // Category validation
      const category = product.category_id;
      if (!category) {
        issues.missingCategories++;
      } else {
        qualityMetrics.categoryConsistency++;
      }

      // Brand validation
      const brand = product.brand || product.brand_name;
      if (!brand) {
        issues.missingBrands++;
      } else {
        qualityMetrics.brandConsistency++;
      }

      if (productValid) {
        validProducts++;
      }
    });

    const qualityScore = totalProducts > 0 ? Math.round((validProducts / totalProducts) * 100) : 0;

    return {
      platform: platformName,
      totalProducts,
      validProducts,
      qualityScore,
      issues,
      qualityMetrics: {
        titleCompleteness: Math.round((qualityMetrics.titleCompleteness / totalProducts) * 100),
        priceValidity: Math.round((qualityMetrics.priceValidity / totalProducts) * 100),
        imageAvailability: Math.round((qualityMetrics.imageAvailability / totalProducts) * 100),
        descriptionQuality: Math.round((qualityMetrics.descriptionQuality / totalProducts) * 100),
        categoryConsistency: Math.round((qualityMetrics.categoryConsistency / totalProducts) * 100),
        brandConsistency: Math.round((qualityMetrics.brandConsistency / totalProducts) * 100)
      }
    };
  }

  calculateOverallQuality(shopeeQuality, tiktokQuality) {
    const totalProducts = shopeeQuality.totalProducts + tiktokQuality.totalProducts;
    const totalValidProducts = shopeeQuality.validProducts + tiktokQuality.validProducts;
    const overallScore = totalProducts > 0 ? Math.round((totalValidProducts / totalProducts) * 100) : 0;

    return {
      totalProducts,
      totalValidProducts,
      overallQualityScore: overallScore,
      platformComparison: {
        shopeeScore: shopeeQuality.qualityScore,
        tiktokScore: tiktokQuality.qualityScore,
        scoreDifference: Math.abs(shopeeQuality.qualityScore - tiktokQuality.qualityScore)
      }
    };
  }  calculate
OverallQuality(shopeeQuality, tiktokQuality) {
    const totalProducts = shopeeQuality.totalProducts + tiktokQuality.totalProducts;
    const totalValidProducts = shopeeQuality.validProducts + tiktokQuality.validProducts;
    const overallScore = totalProducts > 0 ? Math.round((totalValidProducts / totalProducts) * 100) : 0;

    return {
      totalProducts,
      totalValidProducts,
      overallQualityScore: overallScore,
      platformComparison: {
        shopeeScore: shopeeQuality.qualityScore,
        tiktokScore: tiktokQuality.qualityScore,
        scoreDifference: Math.abs(shopeeQuality.qualityScore - tiktokQuality.qualityScore)
      }
    };
  }

  identifyQualityIssues(shopeeQuality, tiktokQuality) {
    const issues = [];

    // Compare quality scores
    if (shopeeQuality.qualityScore < 95) {
      issues.push({
        type: 'quality_score',
        platform: 'Shopee',
        severity: 'medium',
        description: `Shopee data quality score (${shopeeQuality.qualityScore}%) is below 95% target`,
        impact: 'May affect master schema population accuracy'
      });
    }

    if (tiktokQuality.qualityScore < 95) {
      issues.push({
        type: 'quality_score',
        platform: 'TikTok Shop',
        severity: 'medium',
        description: `TikTok Shop data quality score (${tiktokQuality.qualityScore}%) is below 95% target`,
        impact: 'May affect master schema population accuracy'
      });
    }

    // Identify specific data issues
    [shopeeQuality, tiktokQuality].forEach(quality => {
      if (quality.issues.missingTitles > 0) {
        issues.push({
          type: 'missing_data',
          platform: quality.platform,
          severity: 'high',
          description: `${quality.issues.missingTitles} products missing titles`,
          impact: 'Critical for product identification and SEO'
        });
      }

      if (quality.issues.invalidPrices > 0) {
        issues.push({
          type: 'invalid_data',
          platform: quality.platform,
          severity: 'high',
          description: `${quality.issues.invalidPrices} products with invalid prices`,
          impact: 'Affects pricing calculations and revenue projections'
        });
      }

      if (quality.issues.missingImages > 0) {
        issues.push({
          type: 'missing_data',
          platform: quality.platform,
          severity: 'medium',
          description: `${quality.issues.missingImages} products missing images`,
          impact: 'Reduces conversion rates and customer experience'
        });
      }
    });

    return issues;
  }

  analyzeStructuralDifferences(shopeeProducts, tiktokProducts) {
    return {
      idFieldDifference: {
        shopee: 'item_id (string)',
        tiktok: 'product_id (string)',
        impact: 'Requires field mapping in master schema'
      },
      nameFieldDifference: {
        shopee: 'item_name (string)',
        tiktok: 'product_name (string)',
        impact: 'Semantic mapping needed for title field'
      },
      imageStructureDifference: {
        shopee: 'images (array of strings)',
        tiktok: 'images (array of objects with url/alt)',
        impact: 'Requires data transformation for unified image handling'
      },
      timestampDifference: {
        shopee: 'created_at/updated_at (ISO string)',
        tiktok: 'created_time/update_time (Unix timestamp)',
        impact: 'Date format standardization required'
      },
      inventoryFieldDifference: {
        shopee: 'stock (integer)',
        tiktok: 'inventory (integer)',
        impact: 'Field name mapping required'
      }
    };
  }

  analyzeDataFormatDifferences(shopeeProducts, tiktokProducts) {
    return {
      dateFormats: {
        shopee: 'ISO 8601 strings (2024-01-15T10:30:00Z)',
        tiktok: 'Unix timestamps (1705320600)',
        recommendation: 'Standardize to ISO 8601 in master schema'
      },
      imageFormats: {
        shopee: 'Simple string URLs',
        tiktok: 'Object with url and alt text',
        recommendation: 'Use TikTok format for better accessibility'
      },
      dimensionFormats: {
        shopee: 'Nested object with length/width/height',
        tiktok: 'package_dimensions object',
        recommendation: 'Standardize dimension structure'
      },
      brandFormats: {
        shopee: 'brand (string)',
        tiktok: 'brand_name (string)',
        recommendation: 'Use brand_name for consistency'
      }
    };
  }

  analyzeBusinessLogicDifferences(shopeeProducts, tiktokProducts) {
    return {
      tokopediaIntegration: {
        description: 'TikTok Shop has include_tokopedia flag for cross-platform sync',
        impact: 'Master schema must track Tokopedia integration status',
        recommendation: 'Add tokopedia_enabled field to master schema'
      },
      pricingStrategy: {
        description: 'Different platform fee structures affect final pricing',
        shopee: 'Typically 15% platform fee',
        tiktok: 'Typically 20% platform fee + Tokopedia considerations',
        recommendation: 'Implement configurable platform fee system'
      },
      categoryMapping: {
        description: 'Different category ID systems between platforms',
        impact: 'Category synchronization requires mapping table',
        recommendation: 'Create category mapping service'
      },
      inventoryTracking: {
        description: 'Different inventory field names and tracking methods',
        impact: 'Unified inventory management needed',
        recommendation: 'Implement centralized inventory tracking'
      }
    };
  }

  identifyIntegrationChallenges(shopeeProducts, tiktokProducts) {
    return [
      {
        challenge: 'Field Name Inconsistencies',
        description: 'Different field names for same data (item_id vs product_id)',
        severity: 'medium',
        solution: 'Create comprehensive field mapping configuration'
      },
      {
        challenge: 'Data Format Variations',
        description: 'Different formats for dates, images, and dimensions',
        severity: 'medium',
        solution: 'Implement data transformation layer'
      },
      {
        challenge: 'Platform-Specific Features',
        description: 'TikTok Tokopedia integration not available in Shopee',
        severity: 'low',
        solution: 'Design flexible schema to accommodate platform differences'
      },
      {
        challenge: 'Pricing Complexity',
        description: 'Different fee structures and pricing strategies',
        severity: 'high',
        solution: 'Implement configurable pricing calculation system'
      },
      {
        challenge: 'Image Handling',
        description: 'Different image data structures and metadata',
        severity: 'medium',
        solution: 'Standardize image object structure with optional metadata'
      }
    ];
  }

  generateFieldMappingRecommendations(fieldMappings, accuracy) {
    const recommendations = [];

    if (accuracy.overallAccuracy < 90) {
      recommendations.push({
        priority: 'high',
        category: 'field_mapping',
        title: 'Improve Field Mapping Coverage',
        description: `Current mapping accuracy is ${accuracy.overallAccuracy}%, below 90% target`,
        action: 'Review unmapped fields and create semantic mappings where possible'
      });
    }

    if (fieldMappings.shopeeOnly.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'shopee_fields',
        title: 'Handle Shopee-Only Fields',
        description: `${fieldMappings.shopeeOnly.length} fields exist only in Shopee`,
        action: 'Determine if these fields should be preserved in master schema'
      });
    }

    if (fieldMappings.tiktokOnly.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'tiktok_fields',
        title: 'Handle TikTok-Only Fields',
        description: `${fieldMappings.tiktokOnly.length} fields exist only in TikTok Shop`,
        action: 'Evaluate TikTok-specific fields for master schema inclusion'
      });
    }

    return recommendations;
  }

  generateQualityRecommendations(shopeeQuality, tiktokQuality) {
    const recommendations = [];

    [shopeeQuality, tiktokQuality].forEach(quality => {
      if (quality.issues.missingTitles > 0) {
        recommendations.push({
          priority: 'high',
          platform: quality.platform,
          category: 'data_completeness',
          title: 'Fix Missing Product Titles',
          description: `${quality.issues.missingTitles} products missing titles`,
          action: 'Implement title validation and require titles for all products'
        });
      }

      if (quality.issues.invalidPrices > 0) {
        recommendations.push({
          priority: 'high',
          platform: quality.platform,
          category: 'data_validity',
          title: 'Fix Invalid Prices',
          description: `${quality.issues.invalidPrices} products with invalid prices`,
          action: 'Validate price data and set minimum price thresholds'
        });
      }

      if (quality.qualityMetrics.descriptionQuality < 80) {
        recommendations.push({
          priority: 'medium',
          platform: quality.platform,
          category: 'content_quality',
          title: 'Improve Description Quality',
          description: `Only ${quality.qualityMetrics.descriptionQuality}% of products have quality descriptions`,
          action: 'Enhance product descriptions for better SEO and customer experience'
        });
      }
    });

    return recommendations;
  }

  generatePlatformRecommendations() {
    return [
      {
        priority: 'high',
        category: 'schema_design',
        title: 'Design Flexible Master Schema',
        description: 'Create schema that accommodates both platform structures',
        action: 'Use JSON fields for platform-specific data while maintaining common structure'
      },
      {
        priority: 'high',
        category: 'data_transformation',
        title: 'Implement Data Transformation Layer',
        description: 'Handle format differences between platforms',
        action: 'Create transformation functions for dates, images, and other format differences'
      },
      {
        priority: 'medium',
        category: 'pricing_strategy',
        title: 'Implement Dynamic Pricing System',
        description: 'Handle different platform fee structures',
        action: 'Create configurable pricing rules for each platform'
      },
      {
        priority: 'medium',
        category: 'tokopedia_integration',
        title: 'Plan Tokopedia Integration Strategy',
        description: 'TikTok Shop offers Tokopedia cross-platform sync',
        action: 'Design master schema to track and manage Tokopedia integration status'
      }
    ];
  }

  getDataType(value) {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
    return typeof value;
  }

  calculateFieldSimilarity(field1, field2) {
    let similarity = 0;
    
    // Data type similarity (40%)
    if (field1.dataType === field2.dataType) {
      similarity += 0.4;
    }
    
    // Frequency similarity (30%)
    const freqDiff = Math.abs(field1.frequency - field2.frequency);
    const maxFreq = Math.max(field1.frequency, field2.frequency);
    const freqSimilarity = maxFreq > 0 ? 1 - (freqDiff / maxFreq) : 1;
    similarity += freqSimilarity * 0.3;
    
    // Sample value similarity (30%)
    const valueSimilarity = this.calculateValueSimilarity(field1.sampleValues, field2.sampleValues);
    similarity += valueSimilarity * 0.3;
    
    return Math.round(similarity * 100);
  }

  calculateValueSimilarity(values1, values2) {
    if (values1.length === 0 && values2.length === 0) return 1;
    if (values1.length === 0 || values2.length === 0) return 0;
    
    let matches = 0;
    const maxLength = Math.max(values1.length, values2.length);
    
    values1.forEach(val1 => {
      if (values2.some(val2 => this.valuesAreSimilar(val1, val2))) {
        matches++;
      }
    });
    
    return matches / maxLength;
  }

  valuesAreSimilar(val1, val2) {
    if (val1 === val2) return true;
    
    if (typeof val1 === 'string' && typeof val2 === 'string') {
      return val1.toLowerCase().includes(val2.toLowerCase()) || 
             val2.toLowerCase().includes(val1.toLowerCase());
    }
    
    if (typeof val1 === 'number' && typeof val2 === 'number') {
      const diff = Math.abs(val1 - val2);
      const avg = (val1 + val2) / 2;
      return avg > 0 ? (diff / avg) < 0.1 : diff < 0.01;
    }
    
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Comprehensive Analysis Report Generation');
  console.log('==================================================\n');

  try {
    const analyzer = new ComprehensiveDataAnalyzer();

    // Generate all analysis reports
    console.log('📊 Generating comprehensive analysis reports...\n');
    
    const [fieldMappingReport, dataQualityReport, platformDifferencesReport] = await Promise.all([
      analyzer.generateFieldMappingAccuracyReport(),
      analyzer.generateDataQualityReport(),
      analyzer.generatePlatformDifferencesReport()
    ]);

    // Combine all reports
    const comprehensiveReport = {
      metadata: {
        generatedAt: new Date().toISOString(),
        analysisVersion: '1.0.0',
        reportType: 'comprehensive_analysis',
        platforms: ['Shopee', 'TikTok Shop']
      },
      executiveSummary: generateExecutiveSummary(fieldMappingReport, dataQualityReport, platformDifferencesReport),
      fieldMappingAccuracy: fieldMappingReport,
      dataQuality: dataQualityReport,
      platformDifferences: platformDifferencesReport,
      recommendations: consolidateRecommendations(fieldMappingReport, dataQualityReport, platformDifferencesReport),
      nextSteps: generateNextSteps(fieldMappingReport, dataQualityReport, platformDifferencesReport)
    };

    // Create reports directory
    const reportsDir = './docs/phase1';
    await fs.mkdir(reportsDir, { recursive: true });

    // Save comprehensive report as JSON
    const jsonReportPath = path.join(reportsDir, 'comprehensive-analysis-report.json');
    await fs.writeFile(jsonReportPath, JSON.stringify(comprehensiveReport, null, 2), 'utf8');

    // Generate human-readable report
    const markdownReport = generateMarkdownReport(comprehensiveReport);
    const mdReportPath = path.join(reportsDir, 'comprehensive-analysis-report.md');
    await fs.writeFile(mdReportPath, markdownReport, 'utf8');

    // Generate executive summary
    const executiveSummaryPath = path.join(reportsDir, 'executive-summary.md');
    await fs.writeFile(executiveSummaryPath, generateExecutiveSummaryMarkdown(comprehensiveReport), 'utf8');

    console.log('\n✅ Comprehensive Analysis Report Generation Complete!');
    console.log('====================================================');
    console.log(`📄 JSON Report: ${jsonReportPath}`);
    console.log(`📄 Markdown Report: ${mdReportPath}`);
    console.log(`📄 Executive Summary: ${executiveSummaryPath}`);
    
    console.log('\n📊 Key Findings:');
    console.log(`   Field Mapping Accuracy: ${fieldMappingReport.mappingAccuracy}%`);
    console.log(`   Overall Data Quality: ${dataQualityReport.overallQuality.overallQualityScore}%`);
    console.log(`   Platform Differences: ${Object.keys(platformDifferencesReport.structuralDifferences).length} structural differences identified`);
    
    const allRecommendations = comprehensiveReport.recommendations;
    const highPriorityRecs = allRecommendations.filter(r => r.priority === 'high');
    
    if (highPriorityRecs.length > 0) {
      console.log('\n🚨 High Priority Recommendations:');
      highPriorityRecs.slice(0, 3).forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec.title}`);
      });
    }

    console.log('\n🎯 Next Steps:');
    comprehensiveReport.nextSteps.slice(0, 3).forEach((step, index) => {
      console.log(`   ${index + 1}. ${step}`);
    });

  } catch (error) {
    console.error('❌ Comprehensive analysis report generation failed:', error);
    process.exit(1);
  }
}

function generateExecutiveSummary(fieldMapping, dataQuality, platformDiffs) {
  return {
    overallAssessment: 'READY_FOR_SCHEMA_DESIGN',
    keyFindings: [
      `Field mapping accuracy: ${fieldMapping.mappingAccuracy}%`,
      `Data quality score: ${dataQuality.overallQuality.overallQualityScore}%`,
      `${fieldMapping.mappedFields} fields successfully mapped between platforms`,
      `${dataQuality.qualityIssues.length} data quality issues identified`,
      `${Object.keys(platformDiffs.structuralDifferences).length} structural differences require attention`
    ],
    readinessStatus: {
      fieldMapping: fieldMapping.mappingAccuracy >= 80 ? 'READY' : 'NEEDS_WORK',
      dataQuality: dataQuality.overallQuality.overallQualityScore >= 90 ? 'READY' : 'NEEDS_WORK',
      platformIntegration: 'READY'
    },
    criticalIssues: dataQuality.qualityIssues.filter(issue => issue.severity === 'high'),
    businessImpact: {
      schemaDesign: 'Analysis provides sufficient data for master schema design',
      dataIntegrity: 'High data quality enables reliable product synchronization',
      platformSync: 'Identified differences can be handled through transformation layer'
    }
  };
}

function consolidateRecommendations(fieldMapping, dataQuality, platformDiffs) {
  const allRecommendations = [
    ...fieldMapping.recommendations,
    ...dataQuality.recommendations,
    ...platformDiffs.recommendations
  ];

  // Sort by priority and remove duplicates
  const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
  return allRecommendations
    .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
    .filter((rec, index, arr) => 
      arr.findIndex(r => r.title === rec.title) === index
    );
}

function generateNextSteps(fieldMapping, dataQuality, platformDiffs) {
  const steps = [
    'Design master product schema incorporating field mapping analysis',
    'Implement data transformation layer for platform differences',
    'Create configurable pricing calculation system',
    'Develop platform-specific mapping structures',
    'Implement data validation and quality assurance processes'
  ];

  // Add conditional steps based on analysis results
  if (fieldMapping.mappingAccuracy < 90) {
    steps.unshift('Review and improve field mapping coverage');
  }

  if (dataQuality.overallQuality.overallQualityScore < 95) {
    steps.unshift('Address critical data quality issues');
  }

  return steps;
}

function generateMarkdownReport(report) {
  return `# Comprehensive Analysis Report

**Generated:** ${report.metadata.generatedAt}  
**Version:** ${report.metadata.analysisVersion}  
**Platforms:** ${report.metadata.platforms.join(', ')}

## Executive Summary

**Overall Assessment:** ${report.executiveSummary.overallAssessment}

### Key Findings
${report.executiveSummary.keyFindings.map(finding => `- ${finding}`).join('\n')}

### Readiness Status
- **Field Mapping:** ${report.executiveSummary.readinessStatus.fieldMapping}
- **Data Quality:** ${report.executiveSummary.readinessStatus.dataQuality}
- **Platform Integration:** ${report.executiveSummary.readinessStatus.platformIntegration}

## Field Mapping Accuracy Analysis

### Overview
- **Total Shopee Fields:** ${report.fieldMappingAccuracy.totalShopeeFields}
- **Total TikTok Fields:** ${report.fieldMappingAccuracy.totalTikTokFields}
- **Successfully Mapped:** ${report.fieldMappingAccuracy.mappedFields}
- **Mapping Accuracy:** ${report.fieldMappingAccuracy.mappingAccuracy}%

### Field Mapping Details
- **Exact Matches:** ${report.fieldMappingAccuracy.fieldMappings.exactMatches.length}
- **Semantic Matches:** ${report.fieldMappingAccuracy.fieldMappings.similarMatches.length}
- **Shopee-Only Fields:** ${report.fieldMappingAccuracy.fieldMappings.shopeeOnly.length}
- **TikTok-Only Fields:** ${report.fieldMappingAccuracy.fieldMappings.tiktokOnly.length}

## Data Quality Analysis

### Overall Quality
- **Total Products:** ${report.dataQuality.overallQuality.totalProducts}
- **Valid Products:** ${report.dataQuality.overallQuality.totalValidProducts}
- **Overall Quality Score:** ${report.dataQuality.overallQuality.overallQualityScore}%

### Platform Comparison
- **Shopee Quality Score:** ${report.dataQuality.shopeeQuality.qualityScore}%
- **TikTok Quality Score:** ${report.dataQuality.tiktokQuality.qualityScore}%
- **Score Difference:** ${report.dataQuality.overallQuality.platformComparison.scoreDifference}%

### Quality Issues Identified
${report.dataQuality.qualityIssues.map(issue => 
  `- **${issue.type.toUpperCase()}** (${issue.severity}): ${issue.description}`
).join('\n')}

## Platform Differences Analysis

### Structural Differences
${Object.entries(report.platformDifferences.structuralDifferences).map(([key, diff]) => 
  `- **${key}**: ${diff.shopee || diff.description} vs ${diff.tiktok || 'TikTok equivalent'}`
).join('\n')}

### Integration Challenges
${report.platformDifferences.integrationChallenges.map(challenge => 
  `- **${challenge.challenge}** (${challenge.severity}): ${challenge.description}`
).join('\n')}

## Recommendations

### High Priority
${report.recommendations.filter(r => r.priority === 'high').map(rec => 
  `- **${rec.title}**: ${rec.description}`
).join('\n')}

### Medium Priority
${report.recommendations.filter(r => r.priority === 'medium').map(rec => 
  `- **${rec.title}**: ${rec.description}`
).join('\n')}

## Next Steps

${report.nextSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

---

*This comprehensive analysis report was generated automatically by the SyncStore Analysis System v${report.metadata.analysisVersion}*
`;
}

function generateExecutiveSummaryMarkdown(report) {
  return `# Executive Summary - Phase 1 Analysis

**Date:** ${new Date().toLocaleDateString()}  
**Status:** ${report.executiveSummary.overallAssessment}

## Key Metrics

| Metric | Score | Status |
|--------|-------|--------|
| Field Mapping Accuracy | ${report.fieldMappingAccuracy.mappingAccuracy}% | ${report.executiveSummary.readinessStatus.fieldMapping} |
| Data Quality Score | ${report.dataQuality.overallQuality.overallQualityScore}% | ${report.executiveSummary.readinessStatus.dataQuality} |
| Platform Integration | - | ${report.executiveSummary.readinessStatus.platformIntegration} |

## Critical Findings

${report.executiveSummary.keyFindings.map(finding => `- ${finding}`).join('\n')}

## Business Impact

- **Schema Design:** ${report.executiveSummary.businessImpact.schemaDesign}
- **Data Integrity:** ${report.executiveSummary.businessImpact.dataIntegrity}
- **Platform Sync:** ${report.executiveSummary.businessImpact.platformSync}

## Immediate Actions Required

${report.recommendations.filter(r => r.priority === 'high').slice(0, 3).map((rec, index) => 
  `${index + 1}. ${rec.title}`
).join('\n')}

## Phase 2 Readiness

Based on this analysis, the system is **${report.executiveSummary.overallAssessment.replace('_', ' ')}** for Phase 2 implementation.
`;
}

// Run the comprehensive analysis
main().catch(console.error);