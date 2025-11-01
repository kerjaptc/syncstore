/**
 * Comprehensive Data Validation Script for Task 8.1
 * Execute comprehensive data validation on all imported products
 * Verify required fields are present and valid
 * Check image URL accessibility for sample products
 * 
 * Requirements: 4.1, 4.2, 4.3
 */

import { comprehensiveDataValidator } from '../src/lib/validators/comprehensive-data-validator';
import type { ComprehensiveValidationResult } from '../src/lib/validators/comprehensive-data-validator';

class ValidationReportGenerator {
  generateReport(result: ComprehensiveValidationResult): string {
    const report = `# Comprehensive Data Validation Report

**Generated:** ${result.overview.validationEndTime.toISOString()}
**Validation Duration:** ${Math.round(result.overview.validationDuration / 1000)}s
**Overall Status:** ${result.status}
**Overall Score:** ${result.overallScore}/100

## Executive Summary

${this.generateExecutiveSummary(result)}

## Validation Overview

- **Total Products Validated:** ${result.overview.totalProductsValidated.toLocaleString()}
- **Platforms Covered:** ${result.overview.platformsCovered.join(', ')}
- **Validation Types:** ${result.overview.validationTypes.length}
- **Start Time:** ${result.overview.validationStartTime.toISOString()}
- **End Time:** ${result.overview.validationEndTime.toISOString()}

## Master Catalog Validation

### Summary
- **Total Master Products:** ${result.masterCatalogValidation.totalMasterProducts.toLocaleString()}
- **Valid Products:** ${result.masterCatalogValidation.validProducts.toLocaleString()}
- **Invalid Products:** ${result.masterCatalogValidation.invalidProducts.toLocaleString()}
- **Products with Errors:** ${result.masterCatalogValidation.productsWithErrors.toLocaleString()}
- **Products with Warnings:** ${result.masterCatalogValidation.productsWithWarnings.toLocaleString()}
- **Average Data Quality Score:** ${result.masterCatalogValidation.averageDataQualityScore}/100

### Status Breakdown
${Object.entries(result.masterCatalogValidation.statusBreakdown)
  .map(([status, count]) => `- **${status}:** ${count.toLocaleString()} products`)
  .join('\n')}

### Required Fields Validation
${result.masterCatalogValidation.requiredFieldsValidation
  .map(field => `- **${field.fieldName}:** ${field.completenessPercentage}% complete (${field.presentCount}/${field.presentCount + field.missingCount})`)
  .join('\n')}

### Sample Validation Results
${result.masterCatalogValidation.sampleValidationResults.slice(0, 5)
  .map((sample, index) => `
#### ${index + 1}. ${sample.name} (${sample.masterSku})
- **Status:** ${sample.isValid ? '✅ Valid' : '❌ Invalid'}
- **Data Quality Score:** ${sample.dataQualityScore}/100
- **Errors:** ${sample.errors.length > 0 ? sample.errors.join(', ') : 'None'}
- **Warnings:** ${sample.warnings.length > 0 ? sample.warnings.join(', ') : 'None'}`)
  .join('\n')}

## Raw Data Validation

### Summary
- **Total Raw Products:** ${result.rawDataValidation.totalRawProducts.toLocaleString()}
- **Valid Raw Products:** ${result.rawDataValidation.validRawProducts.toLocaleString()}
- **Invalid Raw Products:** ${result.rawDataValidation.invalidRawProducts.toLocaleString()}
- **Overall Validation Rate:** ${result.rawDataValidation.totalRawProducts > 0 
  ? Math.round((result.rawDataValidation.validRawProducts / result.rawDataValidation.totalRawProducts) * 100) 
  : 0}%

### Platform Breakdown
${Object.entries(result.rawDataValidation.platformBreakdown)
  .map(([platform, data]) => `
#### ${platform.toUpperCase()}
- **Total Products:** ${data.totalProducts.toLocaleString()}
- **Valid Products:** ${data.validProducts.toLocaleString()}
- **Invalid Products:** ${data.invalidProducts.toLocaleString()}
- **Validation Rate:** ${data.validationRate}%
- **Common Errors:**
${data.commonErrors.map(error => `  - ${error.error} (${error.count} times)`).join('\n')}`)
  .join('\n')}

## Image Validation

### Summary
- **Total Images Checked:** ${result.imageValidation.totalImagesChecked.toLocaleString()}
- **Valid Images:** ${result.imageValidation.validImages.toLocaleString()}
- **Invalid Images:** ${result.imageValidation.invalidImages.toLocaleString()}
- **Accessibility Rate:** ${result.imageValidation.accessibilityRate}%

### Common Issues
${result.imageValidation.commonIssues
  .map(issue => `- **${issue.issue}:** ${issue.count} occurrences`)
  .join('\n')}

### Sample Results
${result.imageValidation.sampleResults.slice(0, 5)
  .map((sample, index) => `${index + 1}. ${sample.isAccessible ? '✅' : '❌'} ${sample.imageUrl.substring(0, 60)}... ${sample.responseCode ? `(${sample.responseCode})` : ''} ${sample.error ? `- ${sample.error}` : ''}`)
  .join('\n')}

## Field Validation

### Summary
- **Required Fields Present:** ${result.fieldValidation.requiredFieldsPresent.toLocaleString()}
- **Required Fields Missing:** ${result.fieldValidation.requiredFieldsMissing.toLocaleString()}
- **Field Completeness Rate:** ${result.fieldValidation.requiredFieldsPresent + result.fieldValidation.requiredFieldsMissing > 0 
  ? Math.round((result.fieldValidation.requiredFieldsPresent / (result.fieldValidation.requiredFieldsPresent + result.fieldValidation.requiredFieldsMissing)) * 100) 
  : 0}%

### Field Completeness Details
${Object.entries(result.fieldValidation.fieldCompleteness)
  .map(([fieldName, info]) => `- **${fieldName}:** ${info.completenessPercentage}% (${info.presentCount}/${info.totalProducts})`)
  .join('\n')}

### Data Type Validation
${result.fieldValidation.dataTypeValidation
  .map(validation => `- **${validation.fieldName}** (${validation.expectedType}): ${validation.validCount} valid, ${validation.invalidCount} invalid`)
  .join('\n')}

### Value Range Validation
${result.fieldValidation.valueRangeValidation
  .map(validation => `- **${validation.fieldName}**: ${validation.validCount} in range, ${validation.outOfRangeCount} out of range`)
  .join('\n')}

## Data Integrity Validation

### Summary
- **Duplicate Products:** ${result.dataIntegrityValidation.duplicateProducts}
- **Orphaned Mappings:** ${result.dataIntegrityValidation.orphanedMappings}
- **Missing Mappings:** ${result.dataIntegrityValidation.missingMappings}
- **Inconsistent Pricing:** ${result.dataIntegrityValidation.inconsistentPricing}

### Referential Integrity
${result.dataIntegrityValidation.referentialIntegrity
  .map(integrity => `
#### ${integrity.relationship}
- **Valid References:** ${integrity.validReferences}
- **Invalid References:** ${integrity.invalidReferences}
- **Orphaned Records:** ${integrity.orphanedRecords}
- **Missing References:** ${integrity.missingReferences}`)
  .join('\n')}

## Recommendations

${result.recommendations.length === 0 ? 'No recommendations - validation passed successfully!' : ''}
${result.recommendations
  .map((rec, index) => `
### ${index + 1}. ${rec.title} (${rec.priority.toUpperCase()} PRIORITY)

**Category:** ${rec.category.replace('_', ' ').toUpperCase()}
**Description:** ${rec.description}
**Action Required:** ${rec.actionRequired}
**Expected Outcome:** ${rec.expectedOutcome}
${rec.affectedCount ? `**Affected Count:** ${rec.affectedCount.toLocaleString()}` : ''}`)
  .join('\n')}

## Validation Summary

${this.generateValidationSummary(result)}

---

*This validation report was generated automatically by the SyncStore Comprehensive Data Validator*
`;

    return report;
  }

  private generateExecutiveSummary(result: ComprehensiveValidationResult): string {
    const criticalIssues = result.recommendations.filter(r => r.priority === 'critical').length;
    const highIssues = result.recommendations.filter(r => r.priority === 'high').length;
    
    if (result.status === 'PASS') {
      return `✅ **VALIDATION PASSED**: All data validation checks completed successfully. The system has ${result.masterCatalogValidation.totalMasterProducts.toLocaleString()} master products with an average data quality score of ${result.masterCatalogValidation.averageDataQualityScore}/100. Image accessibility rate is ${result.imageValidation.accessibilityRate}%. The system is ready for Phase 2 implementation.`;
    } else if (result.status === 'WARNING') {
      return `⚠️ **VALIDATION WARNING**: Data validation completed with ${highIssues} high-priority issues that should be addressed. Overall score is ${result.overallScore}/100. While the system is functional, addressing these issues will improve reliability and performance.`;
    } else {
      return `❌ **VALIDATION FAILED**: Critical issues found that must be addressed before proceeding. ${criticalIssues} critical and ${highIssues} high-priority issues detected. Overall score is ${result.overallScore}/100. Please review and fix all critical issues.`;
    }
  }

  private generateValidationSummary(result: ComprehensiveValidationResult): string {
    const totalIssues = result.recommendations.length;
    const criticalIssues = result.recommendations.filter(r => r.priority === 'critical').length;
    const highIssues = result.recommendations.filter(r => r.priority === 'high').length;

    let summary = `**Overall Validation Status:** ${result.status}\n`;
    summary += `**Overall Score:** ${result.overallScore}/100\n`;
    summary += `**Total Issues Found:** ${totalIssues}\n`;
    
    if (criticalIssues > 0) {
      summary += `**Critical Issues:** ${criticalIssues} (must be fixed immediately)\n`;
    }
    
    if (highIssues > 0) {
      summary += `**High Priority Issues:** ${highIssues} (should be addressed soon)\n`;
    }

    summary += '\n**Key Metrics:**\n';
    summary += `- Master Products: ${result.masterCatalogValidation.totalMasterProducts.toLocaleString()}\n`;
    summary += `- Data Quality Score: ${result.masterCatalogValidation.averageDataQualityScore}/100\n`;
    summary += `- Image Accessibility: ${result.imageValidation.accessibilityRate}%\n`;
    summary += `- Field Completeness: ${result.fieldValidation.requiredFieldsPresent + result.fieldValidation.requiredFieldsMissing > 0 
      ? Math.round((result.fieldValidation.requiredFieldsPresent / (result.fieldValidation.requiredFieldsPresent + result.fieldValidation.requiredFieldsMissing)) * 100) 
      : 0}%\n`;

    if (result.status === 'PASS') {
      summary += '\n🎉 **Ready for Phase 2**: All validation checks passed successfully!';
    } else if (result.status === 'WARNING') {
      summary += '\n📝 **Action Required**: Address high-priority issues for optimal performance.';
    } else {
      summary += '\n🚨 **Critical Action Required**: Fix all critical issues before proceeding.';
    }

    return summary;
  }
}

async function main() {
  console.log('🔍 Starting comprehensive data validation (Task 8.1)...');
  console.log('=====================================');

  try {
    const startTime = Date.now();
    
    // Run comprehensive validation
    const result = await comprehensiveDataValidator.validateAllData();
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    // Display results
    console.log('\n📊 Validation Results Summary');
    console.log('============================');
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📈 Overall Score: ${result.overallScore}/100`);
    console.log(`🎯 Status: ${result.status}`);
    console.log(`📦 Products Validated: ${result.overview.totalProductsValidated.toLocaleString()}`);

    // Master catalog summary
    console.log('\n🏪 Master Catalog:');
    console.log(`   Total Products: ${result.masterCatalogValidation.totalMasterProducts.toLocaleString()}`);
    console.log(`   Valid Products: ${result.masterCatalogValidation.validProducts.toLocaleString()}`);
    console.log(`   Data Quality: ${result.masterCatalogValidation.averageDataQualityScore}/100`);
    console.log(`   With Errors: ${result.masterCatalogValidation.productsWithErrors}`);

    // Raw data summary
    console.log('\n📊 Raw Data:');
    console.log(`   Total Products: ${result.rawDataValidation.totalRawProducts.toLocaleString()}`);
    console.log(`   Valid Products: ${result.rawDataValidation.validRawProducts.toLocaleString()}`);
    console.log(`   Validation Rate: ${result.rawDataValidation.totalRawProducts > 0 
      ? Math.round((result.rawDataValidation.validRawProducts / result.rawDataValidation.totalRawProducts) * 100) 
      : 0}%`);

    // Image validation summary
    console.log('\n🖼️  Images:');
    console.log(`   Images Checked: ${result.imageValidation.totalImagesChecked}`);
    console.log(`   Accessibility Rate: ${result.imageValidation.accessibilityRate}%`);
    console.log(`   Valid Images: ${result.imageValidation.validImages}`);

    // Field validation summary
    console.log('\n📝 Fields:');
    const fieldCompleteness = result.fieldValidation.requiredFieldsPresent + result.fieldValidation.requiredFieldsMissing > 0 
      ? Math.round((result.fieldValidation.requiredFieldsPresent / (result.fieldValidation.requiredFieldsPresent + result.fieldValidation.requiredFieldsMissing)) * 100) 
      : 0;
    console.log(`   Field Completeness: ${fieldCompleteness}%`);
    console.log(`   Required Fields Present: ${result.fieldValidation.requiredFieldsPresent}`);
    console.log(`   Required Fields Missing: ${result.fieldValidation.requiredFieldsMissing}`);

    // Data integrity summary
    console.log('\n🔗 Data Integrity:');
    console.log(`   Duplicate Products: ${result.dataIntegrityValidation.duplicateProducts}`);
    console.log(`   Orphaned Mappings: ${result.dataIntegrityValidation.orphanedMappings}`);
    console.log(`   Missing Mappings: ${result.dataIntegrityValidation.missingMappings}`);

    // Recommendations summary
    if (result.recommendations.length > 0) {
      console.log('\n📝 Recommendations:');
      const criticalCount = result.recommendations.filter(r => r.priority === 'critical').length;
      const highCount = result.recommendations.filter(r => r.priority === 'high').length;
      const mediumCount = result.recommendations.filter(r => r.priority === 'medium').length;
      const lowCount = result.recommendations.filter(r => r.priority === 'low').length;

      if (criticalCount > 0) console.log(`   🚨 Critical: ${criticalCount}`);
      if (highCount > 0) console.log(`   ⚠️  High: ${highCount}`);
      if (mediumCount > 0) console.log(`   📋 Medium: ${mediumCount}`);
      if (lowCount > 0) console.log(`   ℹ️  Low: ${lowCount}`);

      console.log('\n   Top 3 Recommendations:');
      result.recommendations.slice(0, 3).forEach((rec, index) => {
        const icon = rec.priority === 'critical' ? '🚨' : rec.priority === 'high' ? '⚠️' : '📋';
        console.log(`   ${index + 1}. ${icon} ${rec.title}`);
        console.log(`      ${rec.description}`);
      });
    } else {
      console.log('\n✅ No recommendations - validation passed successfully!');
    }

    // Generate detailed report
    const reportGenerator = new ValidationReportGenerator();
    const detailedReport = reportGenerator.generateReport(result);
    
    // Save report to file
    const fs = await import('fs/promises');
    const reportPath = `./docs/phase1/comprehensive-validation-report-${new Date().toISOString().split('T')[0]}.md`;
    await fs.writeFile(reportPath, detailedReport, 'utf8');
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    // Final status
    console.log('\n🎯 Final Status');
    console.log('===============');
    
    if (result.status === 'PASS') {
      console.log('✅ VALIDATION PASSED');
      console.log('🎉 All validation checks completed successfully!');
      console.log('🚀 System is ready for Phase 2 implementation.');
      process.exit(0);
    } else if (result.status === 'WARNING') {
      console.log('⚠️  VALIDATION WARNING');
      console.log('📝 Some issues found but system is functional.');
      console.log('🔧 Consider addressing high-priority recommendations.');
      process.exit(0);
    } else {
      console.log('❌ VALIDATION FAILED');
      console.log('🚨 Critical issues must be addressed before proceeding.');
      console.log('🔧 Please review and fix all critical recommendations.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Comprehensive validation failed:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}

export { main };