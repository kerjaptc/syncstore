#!/usr/bin/env node

/**
 * Data Analysis Script for Phase 1
 * Analyzes imported Shopee and TikTok Shop data to identify overlaps and differences
 */

import { DataAnalyzer } from '../src/lib/analytics/data-analyzer.ts';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  console.log('🚀 Starting Data Analysis for Phase 1');
  console.log('=====================================\n');

  try {
    // Initialize data analyzer
    const analyzer = new DataAnalyzer();

    // Generate comprehensive analysis report
    console.log('📊 Generating comprehensive analysis report...\n');
    const report = await analyzer.generateComparisonReport();

    // Create reports directory
    const reportsDir = './docs/phase1';
    await fs.mkdir(reportsDir, { recursive: true });

    // Save detailed report as JSON
    const reportPath = path.join(reportsDir, 'data-comparison-analysis.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

    // Generate human-readable report
    const readableReport = generateReadableReport(report);
    const readableReportPath = path.join(reportsDir, 'data-comparison-analysis.md');
    await fs.writeFile(readableReportPath, readableReport, 'utf8');

    console.log('\n✅ Data Analysis Complete!');
    console.log('==========================');
    console.log(`📄 Detailed Report: ${reportPath}`);
    console.log(`📄 Readable Report: ${readableReportPath}`);
    console.log('\n📊 Summary:');
    console.log(`   Product Overlap: ${report.productOverlap.overlapPercentage}%`);
    console.log(`   Field Overlap: ${report.fieldMapping.fieldOverlapPercentage}%`);
    console.log(`   Data Quality: ${report.dataQuality.overallQuality.qualityScore}%`);
    
    if (report.recommendations.length > 0) {
      console.log('\n⚠️  Recommendations:');
      report.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }

    if (report.nextSteps.length > 0) {
      console.log('\n🎯 Next Steps:');
      report.nextSteps.forEach((step, index) => {
        console.log(`   ${index + 1}. ${step}`);
      });
    }

  } catch (error) {
    console.error('❌ Data analysis failed:', error);
    process.exit(1);
  }
}

function generateReadableReport(report) {
  const date = new Date().toISOString().split('T')[0];
  
  return `# Data Comparison Analysis Report

**Generated:** ${report.summary.analysisDate.toISOString()}  
**Analysis Version:** ${report.summary.analysisVersion}

## Executive Summary

This report analyzes the imported product data from Shopee and TikTok Shop platforms to identify overlaps, differences, and data quality metrics. The analysis is crucial for designing the master product schema and ensuring data integrity for the SyncStore system.

## Product Overlap Analysis

### Overview
- **Shopee Products:** ${report.productOverlap.totalShopeeProducts.toLocaleString()}
- **TikTok Shop Products:** ${report.productOverlap.totalTikTokProducts.toLocaleString()}
- **Common Products:** ${report.productOverlap.commonProducts.toLocaleString()}
- **Overlap Percentage:** ${report.productOverlap.overlapPercentage}%

### Platform-Specific Products
- **Shopee Only:** ${report.productOverlap.shopeeOnlyProducts.length.toLocaleString()} products
- **TikTok Shop Only:** ${report.productOverlap.tiktokOnlyProducts.length.toLocaleString()} products

### Similar Products Found
${report.productOverlap.similarProducts.length.toLocaleString()} product pairs were identified as similar based on:
- Title similarity (40% weight)
- Price similarity (20% weight)
- Category matching (20% weight)
- Weight similarity (10% weight)
- Image count similarity (10% weight)

## Field Mapping Analysis

### Overview
- **Common Fields:** ${report.fieldMapping.commonFields.length}
- **Shopee-Only Fields:** ${report.fieldMapping.shopeeOnlyFields.length}
- **TikTok-Only Fields:** ${report.fieldMapping.tiktokOnlyFields.length}
- **Field Overlap Percentage:** ${report.fieldMapping.fieldOverlapPercentage}%

### Top Common Fields
${report.fieldMapping.commonFields.slice(0, 10).map((field, index) => 
  `${index + 1}. **${field.fieldName}** - ${field.matchPercentage}% match (${field.dataType})`
).join('\n')}

### Platform-Specific Fields

#### Shopee-Only Fields (Top 10)
${report.fieldMapping.shopeeOnlyFields.slice(0, 10).map((field, index) => 
  `${index + 1}. **${field.fieldName}** - ${field.dataType} (${field.frequency} products)`
).join('\n')}

#### TikTok-Only Fields (Top 10)
${report.fieldMapping.tiktokOnlyFields.slice(0, 10).map((field, index) => 
  `${index + 1}. **${field.fieldName}** - ${field.dataType} (${field.frequency} products)`
).join('\n')}

## Data Quality Analysis

### Overall Quality
- **Total Products:** ${report.dataQuality.overallQuality.totalProducts.toLocaleString()}
- **Valid Products:** ${report.dataQuality.overallQuality.validProducts.toLocaleString()}
- **Quality Score:** ${report.dataQuality.overallQuality.qualityScore}%

### Shopee Data Quality
- **Total Products:** ${report.dataQuality.shopeeQuality.totalProducts.toLocaleString()}
- **Valid Products:** ${report.dataQuality.shopeeQuality.validProducts.toLocaleString()}
- **Quality Score:** ${report.dataQuality.shopeeQuality.qualityScore}%
- **Missing Required Fields:** ${report.dataQuality.shopeeQuality.missingRequiredFields}
- **Invalid Prices:** ${report.dataQuality.shopeeQuality.invalidPrices}
- **Missing Images:** ${report.dataQuality.shopeeQuality.missingImages}

### TikTok Shop Data Quality
- **Total Products:** ${report.dataQuality.tiktokQuality.totalProducts.toLocaleString()}
- **Valid Products:** ${report.dataQuality.tiktokQuality.validProducts.toLocaleString()}
- **Quality Score:** ${report.dataQuality.tiktokQuality.qualityScore}%
- **Missing Required Fields:** ${report.dataQuality.tiktokQuality.missingRequiredFields}
- **Invalid Prices:** ${report.dataQuality.tiktokQuality.invalidPrices}
- **Missing Images:** ${report.dataQuality.tiktokQuality.missingImages}
- **Tokopedia Enabled:** ${report.dataQuality.tiktokQuality.tokopediaEnabledCount || 0}

## Recommendations

${report.recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}

## Next Steps

${report.nextSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

## Technical Details

### Analysis Configuration
- **Shopee Data Path:** ${report.summary.shopeeDataPath}
- **TikTok Data Path:** ${report.summary.tiktokDataPath}
- **Similarity Threshold:** 70% (for product matching)
- **Field Match Threshold:** 80% (for field compatibility)

### Methodology
1. **Product Matching:** Uses multi-factor similarity scoring including title, price, category, weight, and image count
2. **Field Analysis:** Recursive field extraction with data type detection and frequency analysis
3. **Quality Assessment:** Validates required fields (title, price, images) and data integrity

---

*This report was generated automatically by the SyncStore Data Analyzer v${report.summary.analysisVersion}*
`;
}

// Run the analysis
main().catch(console.error);