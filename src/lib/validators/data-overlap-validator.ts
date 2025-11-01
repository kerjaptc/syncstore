/**
 * Data Overlap Validator for Phase 1
 * Validates that data overlap meets the 90% requirement and identifies discrepancies
 */

import { DataAnalyzer } from '../analytics/data-analyzer';

export interface DataOverlapValidationResult {
  meetsRequirements: boolean;
  actualOverlapPercentage: number;
  requiredOverlapPercentage: number;
  validationStatus: 'PASS' | 'FAIL' | 'WARNING';
  discrepancies: DataDiscrepancy[];
  recommendations: OverlapRecommendation[];
  validationDetails: {
    totalProductsAnalyzed: number;
    commonProductsFound: number;
    platformSpecificProducts: {
      shopeeOnly: number;
      tiktokOnly: number;
    };
    fieldOverlapPercentage: number;
    dataQualityScore: number;
  };
}

export interface DataDiscrepancy {
  type: 'product_mismatch' | 'field_mismatch' | 'data_quality' | 'structural_difference';
  severity: 'critical' | 'major' | 'minor';
  description: string;
  affectedItems: string[];
  impact: string;
  suggestedResolution: string;
}

export interface OverlapRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'data_mapping' | 'schema_design' | 'data_quality' | 'platform_integration';
  title: string;
  description: string;
  actionRequired: string;
  expectedOutcome: string;
  estimatedEffort: 'low' | 'medium' | 'high';
}

export class DataOverlapValidator {
  private analyzer: DataAnalyzer;
  private requiredOverlapPercentage: number;

  constructor(requiredOverlapPercentage = 90) {
    this.analyzer = new DataAnalyzer();
    this.requiredOverlapPercentage = requiredOverlapPercentage;
  }

  /**
   * Validate that data overlap meets requirements
   */
  async validateDataOverlap(): Promise<DataOverlapValidationResult> {
    console.log('🔍 Validating data overlap requirements...');
    console.log(`📊 Required overlap percentage: ${this.requiredOverlapPercentage}%`);

    try {
      // Generate comprehensive analysis
      const analysisReport = await this.analyzer.generateComparisonReport();
      
      const productOverlap = analysisReport.productOverlap;
      const fieldMapping = analysisReport.fieldMapping;
      const dataQuality = analysisReport.dataQuality;

      // Validate product overlap
      const productOverlapMeetsReq = productOverlap.overlapPercentage >= this.requiredOverlapPercentage;
      
      // Validate field overlap (should also be high for effective schema design)
      const fieldOverlapMeetsReq = fieldMapping.fieldOverlapPercentage >= 70; // Lower threshold for fields
      
      // Overall validation status
      const meetsRequirements = productOverlapMeetsReq && fieldOverlapMeetsReq && dataQuality.overallQuality.qualityScore >= 95;
      
      let validationStatus: 'PASS' | 'FAIL' | 'WARNING';
      if (meetsRequirements) {
        validationStatus = 'PASS';
      } else if (productOverlap.overlapPercentage >= 80 || fieldMapping.fieldOverlapPercentage >= 60) {
        validationStatus = 'WARNING';
      } else {
        validationStatus = 'FAIL';
      }

      // Identify discrepancies
      const discrepancies = await this.identifyDiscrepancies(analysisReport);
      
      // Generate recommendations
      const recommendations = this.generateOverlapRecommendations(analysisReport, discrepancies);

      const result: DataOverlapValidationResult = {
        meetsRequirements,
        actualOverlapPercentage: productOverlap.overlapPercentage,
        requiredOverlapPercentage: this.requiredOverlapPercentage,
        validationStatus,
        discrepancies,
        recommendations,
        validationDetails: {
          totalProductsAnalyzed: productOverlap.totalShopeeProducts + productOverlap.totalTikTokProducts,
          commonProductsFound: productOverlap.commonProducts,
          platformSpecificProducts: {
            shopeeOnly: productOverlap.shopeeOnlyProducts.length,
            tiktokOnly: productOverlap.tiktokOnlyProducts.length
          },
          fieldOverlapPercentage: fieldMapping.fieldOverlapPercentage,
          dataQualityScore: dataQuality.overallQuality.qualityScore
        }
      };

      console.log(`📊 Data Overlap Validation Complete:`);
      console.log(`   Status: ${validationStatus}`);
      console.log(`   Product Overlap: ${productOverlap.overlapPercentage}% (Required: ${this.requiredOverlapPercentage}%)`);
      console.log(`   Field Overlap: ${fieldMapping.fieldOverlapPercentage}%`);
      console.log(`   Data Quality: ${dataQuality.overallQuality.qualityScore}%`);
      console.log(`   Discrepancies Found: ${discrepancies.length}`);

      return result;

    } catch (error) {
      console.error('❌ Data overlap validation failed:', error);
      throw error;
    }
  }

  /**
   * Identify significant discrepancies in data overlap
   */
  private async identifyDiscrepancies(analysisReport: any): Promise<DataDiscrepancy[]> {
    const discrepancies: DataDiscrepancy[] = [];
    
    const { productOverlap, fieldMapping, dataQuality } = analysisReport;

    // Product overlap discrepancies
    if (productOverlap.overlapPercentage < this.requiredOverlapPercentage) {
      discrepancies.push({
        type: 'product_mismatch',
        severity: 'critical',
        description: `Product overlap (${productOverlap.overlapPercentage}%) is below required ${this.requiredOverlapPercentage}%`,
        affectedItems: [
          ...productOverlap.shopeeOnlyProducts.slice(0, 5),
          ...productOverlap.tiktokOnlyProducts.slice(0, 5)
        ],
        impact: 'May indicate incomplete product catalog or poor matching algorithm',
        suggestedResolution: 'Review product matching criteria and improve similarity detection algorithm'
      });
    }

    // Field mapping discrepancies
    if (fieldMapping.fieldOverlapPercentage < 70) {
      discrepancies.push({
        type: 'field_mismatch',
        severity: 'major',
        description: `Field overlap (${fieldMapping.fieldOverlapPercentage}%) indicates significant structural differences`,
        affectedItems: [
          ...fieldMapping.shopeeOnlyFields.slice(0, 3).map((f: any) => `Shopee: ${f.fieldName}`),
          ...fieldMapping.tiktokOnlyFields.slice(0, 3).map((f: any) => `TikTok: ${f.fieldName}`)
        ],
        impact: 'Complicates master schema design and data transformation',
        suggestedResolution: 'Create comprehensive field mapping strategy and transformation layer'
      });
    }

    // Data quality discrepancies
    if (dataQuality.overallQuality.qualityScore < 95) {
      discrepancies.push({
        type: 'data_quality',
        severity: 'major',
        description: `Data quality score (${dataQuality.overallQuality.qualityScore}%) is below 95% target`,
        affectedItems: dataQuality.overallQuality.recommendations,
        impact: 'Poor data quality affects master catalog reliability and synchronization accuracy',
        suggestedResolution: 'Implement data cleaning and validation processes before schema population'
      });
    }

    // Platform-specific structural differences
    const structuralDifferences = this.analyzeStructuralDifferences(productOverlap.similarProducts);
    if (structuralDifferences.length > 0) {
      discrepancies.push({
        type: 'structural_difference',
        severity: 'minor',
        description: `${structuralDifferences.length} structural differences found between platforms`,
        affectedItems: structuralDifferences,
        impact: 'Requires platform-specific handling in master schema',
        suggestedResolution: 'Design flexible schema with platform-specific JSON fields'
      });
    }

    return discrepancies;
  }

  /**
   * Generate recommendations for handling platform differences
   */
  private generateOverlapRecommendations(analysisReport: any, _discrepancies: DataDiscrepancy[]): OverlapRecommendation[] {
    const recommendations: OverlapRecommendation[] = [];
    
    const { productOverlap, fieldMapping, dataQuality } = analysisReport;

    // Product overlap recommendations
    if (productOverlap.overlapPercentage < this.requiredOverlapPercentage) {
      recommendations.push({
        priority: 'high',
        category: 'data_mapping',
        title: 'Improve Product Matching Algorithm',
        description: `Current product overlap (${productOverlap.overlapPercentage}%) is below ${this.requiredOverlapPercentage}% requirement`,
        actionRequired: 'Enhance similarity detection algorithm with additional matching criteria (SKU, brand, specifications)',
        expectedOutcome: `Achieve ${this.requiredOverlapPercentage}%+ product overlap`,
        estimatedEffort: 'medium'
      });

      recommendations.push({
        priority: 'high',
        category: 'data_quality',
        title: 'Standardize Product Naming Convention',
        description: 'Inconsistent product names reduce matching accuracy',
        actionRequired: 'Implement product name normalization and standardization process',
        expectedOutcome: 'Improved product matching through consistent naming',
        estimatedEffort: 'low'
      });
    }

    // Field mapping recommendations
    if (fieldMapping.fieldOverlapPercentage < 80) {
      recommendations.push({
        priority: 'high',
        category: 'schema_design',
        title: 'Create Comprehensive Field Mapping Strategy',
        description: `Field overlap (${fieldMapping.fieldOverlapPercentage}%) requires strategic mapping approach`,
        actionRequired: 'Design master schema with universal fields and platform-specific extensions',
        expectedOutcome: 'Unified schema that accommodates all platform data',
        estimatedEffort: 'high'
      });
    }

    // Data quality recommendations
    if (dataQuality.overallQuality.qualityScore < 95) {
      recommendations.push({
        priority: 'medium',
        category: 'data_quality',
        title: 'Implement Data Quality Assurance',
        description: `Data quality (${dataQuality.overallQuality.qualityScore}%) needs improvement`,
        actionRequired: 'Create data validation and cleaning processes',
        expectedOutcome: 'Achieve 95%+ data quality score',
        estimatedEffort: 'medium'
      });
    }

    // Platform integration recommendations
    recommendations.push({
      priority: 'medium',
      category: 'platform_integration',
      title: 'Design Platform-Agnostic Data Layer',
      description: 'Handle platform differences through abstraction layer',
      actionRequired: 'Create data transformation and mapping services',
      expectedOutcome: 'Seamless integration of platform-specific data',
      estimatedEffort: 'high'
    });

    // Tokopedia integration recommendation
    const tokopediaProducts = productOverlap.similarProducts.filter((p: any) => 
      p.tiktokProduct.include_tokopedia === true
    );
    
    if (tokopediaProducts.length > 0) {
      recommendations.push({
        priority: 'low',
        category: 'platform_integration',
        title: 'Plan Tokopedia Integration Strategy',
        description: `${tokopediaProducts.length} products have Tokopedia integration enabled`,
        actionRequired: 'Design master schema to track and manage Tokopedia sync status',
        expectedOutcome: 'Support for TikTok-Tokopedia cross-platform synchronization',
        estimatedEffort: 'low'
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Analyze structural differences in similar products
   */
  private analyzeStructuralDifferences(similarProducts: any[]): string[] {
    const differences: string[] = [];
    
    if (similarProducts.length === 0) return differences;

    // Analyze common structural patterns
    const sampleProduct = similarProducts[0];
    const shopeeProduct = sampleProduct.shopeeProduct;
    const tiktokProduct = sampleProduct.tiktokProduct;

    // Check ID field differences
    if (shopeeProduct.item_id && tiktokProduct.product_id) {
      differences.push('ID field naming: item_id vs product_id');
    }

    // Check name field differences
    if (shopeeProduct.item_name && tiktokProduct.product_name) {
      differences.push('Name field naming: item_name vs product_name');
    }

    // Check image structure differences
    const shopeeImages = shopeeProduct.images || [];
    const tiktokImages = tiktokProduct.images || [];
    
    if (shopeeImages.length > 0 && tiktokImages.length > 0) {
      const shopeeImageType = typeof shopeeImages[0];
      const tiktokImageType = typeof tiktokImages[0];
      
      if (shopeeImageType !== tiktokImageType) {
        differences.push('Image structure: string arrays vs object arrays');
      }
    }

    // Check timestamp format differences
    if (shopeeProduct.created_at && tiktokProduct.created_time) {
      differences.push('Timestamp format: ISO strings vs Unix timestamps');
    }

    // Check inventory field differences
    if (shopeeProduct.stock !== undefined && tiktokProduct.inventory !== undefined) {
      differences.push('Inventory field naming: stock vs inventory');
    }

    return differences;
  }

  /**
   * Generate validation report
   */
  async generateValidationReport(): Promise<string> {
    const validation = await this.validateDataOverlap();
    
    const report = `# Data Overlap Validation Report

**Generated:** ${new Date().toISOString()}
**Validation Status:** ${validation.validationStatus}
**Requirements Met:** ${validation.meetsRequirements ? 'YES' : 'NO'}

## Validation Results

### Overlap Requirements
- **Required Product Overlap:** ${validation.requiredOverlapPercentage}%
- **Actual Product Overlap:** ${validation.actualOverlapPercentage}%
- **Status:** ${validation.actualOverlapPercentage >= validation.requiredOverlapPercentage ? '✅ PASS' : '❌ FAIL'}

### Analysis Details
- **Total Products Analyzed:** ${validation.validationDetails.totalProductsAnalyzed}
- **Common Products Found:** ${validation.validationDetails.commonProductsFound}
- **Shopee-Only Products:** ${validation.validationDetails.platformSpecificProducts.shopeeOnly}
- **TikTok-Only Products:** ${validation.validationDetails.platformSpecificProducts.tiktokOnly}
- **Field Overlap Percentage:** ${validation.validationDetails.fieldOverlapPercentage}%
- **Data Quality Score:** ${validation.validationDetails.dataQualityScore}%

## Significant Discrepancies

${validation.discrepancies.length === 0 ? 'No significant discrepancies found.' : ''}
${validation.discrepancies.map((disc, index) => `
### ${index + 1}. ${disc.type.toUpperCase()} (${disc.severity.toUpperCase()})
**Description:** ${disc.description}
**Impact:** ${disc.impact}
**Affected Items:** ${disc.affectedItems.slice(0, 3).join(', ')}${disc.affectedItems.length > 3 ? ` and ${disc.affectedItems.length - 3} more` : ''}
**Suggested Resolution:** ${disc.suggestedResolution}
`).join('')}

## Recommendations for Platform Differences

${validation.recommendations.map((rec, index) => `
### ${index + 1}. ${rec.title} (${rec.priority.toUpperCase()} PRIORITY)
**Category:** ${rec.category.replace('_', ' ').toUpperCase()}
**Description:** ${rec.description}
**Action Required:** ${rec.actionRequired}
**Expected Outcome:** ${rec.expectedOutcome}
**Estimated Effort:** ${rec.estimatedEffort.toUpperCase()}
`).join('')}

## Validation Summary

${validation.validationStatus === 'PASS' 
  ? '✅ **VALIDATION PASSED**: Data overlap meets requirements. System is ready for master schema design.'
  : validation.validationStatus === 'WARNING'
  ? '⚠️ **VALIDATION WARNING**: Data overlap is acceptable but below optimal. Consider implementing recommended improvements.'
  : '❌ **VALIDATION FAILED**: Data overlap does not meet requirements. Critical issues must be addressed before proceeding.'
}

## Next Steps

Based on validation results, the following actions are recommended:

${validation.validationStatus === 'PASS' 
  ? `1. Proceed with master schema design
2. Implement platform mapping structures
3. Create data transformation layer for identified differences`
  : validation.validationStatus === 'WARNING'
  ? `1. Address high-priority recommendations
2. Improve product matching algorithm
3. Proceed with master schema design with caution`
  : `1. Address all critical discrepancies
2. Improve data overlap to meet 90% requirement
3. Re-run validation before proceeding to schema design`
}

---

*This validation report was generated automatically by the SyncStore Data Overlap Validator*
`;

    return report;
  }

  /**
   * Quick validation check
   */
  async quickValidation(): Promise<{
    passed: boolean;
    overlapPercentage: number;
    message: string;
  }> {
    try {
      const validation = await this.validateDataOverlap();
      
      return {
        passed: validation.meetsRequirements,
        overlapPercentage: validation.actualOverlapPercentage,
        message: validation.meetsRequirements 
          ? `✅ Data overlap validation passed (${validation.actualOverlapPercentage}%)`
          : `❌ Data overlap validation failed (${validation.actualOverlapPercentage}% < ${validation.requiredOverlapPercentage}%)`
      };
    } catch (error) {
      return {
        passed: false,
        overlapPercentage: 0,
        message: `❌ Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}