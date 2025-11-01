/**
 * Data Overlap Validation Script
 * Validates that data overlap meets the 90% requirement
 * Task 5.3: Validate data overlap meets requirements
 */

import { DataOverlapValidator } from '../src/lib/validators/data-overlap-validator';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  console.log('🔍 Starting Data Overlap Validation...');
  console.log('=' .repeat(60));

  try {
    // Initialize validator with 90% requirement
    const validator = new DataOverlapValidator(90);

    // Run comprehensive validation
    console.log('📊 Running comprehensive data overlap analysis...');
    const validationResult = await validator.validateDataOverlap();

    // Display validation results
    console.log('\n📋 VALIDATION RESULTS');
    console.log('=' .repeat(40));
    console.log(`Status: ${validationResult.validationStatus}`);
    console.log(`Requirements Met: ${validationResult.meetsRequirements ? '✅ YES' : '❌ NO'}`);
    console.log(`Actual Overlap: ${validationResult.actualOverlapPercentage}%`);
    console.log(`Required Overlap: ${validationResult.requiredOverlapPercentage}%`);

    // Display detailed analysis
    console.log('\n📊 DETAILED ANALYSIS');
    console.log('=' .repeat(40));
    const details = validationResult.validationDetails;
    console.log(`Total Products Analyzed: ${details.totalProductsAnalyzed}`);
    console.log(`Common Products Found: ${details.commonProductsFound}`);
    console.log(`Shopee-Only Products: ${details.platformSpecificProducts.shopeeOnly}`);
    console.log(`TikTok-Only Products: ${details.platformSpecificProducts.tiktokOnly}`);
    console.log(`Field Overlap: ${details.fieldOverlapPercentage}%`);
    console.log(`Data Quality Score: ${details.dataQualityScore}%`);

    // Display discrepancies
    if (validationResult.discrepancies.length > 0) {
      console.log('\n⚠️  SIGNIFICANT DISCREPANCIES');
      console.log('=' .repeat(40));
      validationResult.discrepancies.forEach((disc, index) => {
        console.log(`\n${index + 1}. ${disc.type.toUpperCase()} (${disc.severity.toUpperCase()})`);
        console.log(`   Description: ${disc.description}`);
        console.log(`   Impact: ${disc.impact}`);
        console.log(`   Affected Items: ${disc.affectedItems.slice(0, 3).join(', ')}${disc.affectedItems.length > 3 ? ` and ${disc.affectedItems.length - 3} more` : ''}`);
        console.log(`   Resolution: ${disc.suggestedResolution}`);
      });
    } else {
      console.log('\n✅ No significant discrepancies found');
    }

    // Display recommendations
    if (validationResult.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS FOR PLATFORM DIFFERENCES');
      console.log('=' .repeat(50));
      validationResult.recommendations.forEach((rec, index) => {
        console.log(`\n${index + 1}. ${rec.title} (${rec.priority.toUpperCase()} PRIORITY)`);
        console.log(`   Category: ${rec.category.replace('_', ' ').toUpperCase()}`);
        console.log(`   Description: ${rec.description}`);
        console.log(`   Action: ${rec.actionRequired}`);
        console.log(`   Expected Outcome: ${rec.expectedOutcome}`);
        console.log(`   Effort: ${rec.estimatedEffort.toUpperCase()}`);
      });
    }

    // Generate and save validation report
    console.log('\n📄 Generating validation report...');
    const report = await validator.generateValidationReport();
    const reportPath = path.join('docs', 'phase1', 'data-overlap-validation-report.md');
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, report, 'utf8');
    console.log(`✅ Validation report saved to: ${reportPath}`);

    // Summary and next steps
    console.log('\n🎯 VALIDATION SUMMARY');
    console.log('=' .repeat(40));
    
    if (validationResult.validationStatus === 'PASS') {
      console.log('✅ VALIDATION PASSED');
      console.log('   Data overlap meets requirements');
      console.log('   System is ready for master schema design');
      console.log('\n📋 NEXT STEPS:');
      console.log('   1. Proceed with master schema design (Task 6.1)');
      console.log('   2. Implement platform mapping structures (Task 6.2)');
      console.log('   3. Create pricing calculation system (Task 6.2)');
    } else if (validationResult.validationStatus === 'WARNING') {
      console.log('⚠️  VALIDATION WARNING');
      console.log('   Data overlap is acceptable but below optimal');
      console.log('   Consider implementing recommended improvements');
      console.log('\n📋 NEXT STEPS:');
      console.log('   1. Address high-priority recommendations');
      console.log('   2. Improve product matching algorithm');
      console.log('   3. Proceed with master schema design with caution');
    } else {
      console.log('❌ VALIDATION FAILED');
      console.log('   Data overlap does not meet requirements');
      console.log('   Critical issues must be addressed');
      console.log('\n📋 NEXT STEPS:');
      console.log('   1. Address all critical discrepancies');
      console.log('   2. Improve data overlap to meet 90% requirement');
      console.log('   3. Re-run validation before proceeding');
    }

    // Create summary for task completion
    const summaryData = {
      validationDate: new Date().toISOString(),
      requirementsMet: validationResult.meetsRequirements,
      actualOverlap: validationResult.actualOverlapPercentage,
      requiredOverlap: validationResult.requiredOverlapPercentage,
      validationStatus: validationResult.validationStatus,
      discrepanciesCount: validationResult.discrepancies.length,
      recommendationsCount: validationResult.recommendations.length,
      criticalIssues: validationResult.discrepancies.filter(d => d.severity === 'critical').length,
      majorIssues: validationResult.discrepancies.filter(d => d.severity === 'major').length,
      minorIssues: validationResult.discrepancies.filter(d => d.severity === 'minor').length
    };

    const summaryPath = path.join('docs', 'phase1', 'data-overlap-validation-summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(summaryData, null, 2), 'utf8');
    console.log(`📊 Validation summary saved to: ${summaryPath}`);

    console.log('\n' + '=' .repeat(60));
    console.log('✅ Data Overlap Validation Complete');
    
    // Exit with appropriate code
    process.exit(validationResult.meetsRequirements ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Validation failed with error:', error);
    if (error instanceof Error) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the validation
main();