/**
 * Pricing and SEO Functionality Test Script for Task 8.2
 * Validates pricing calculations for multiple product samples
 * Tests SEO title generation for different product types
 * Verifies platform-specific variations are appropriate
 * 
 * Requirements: 3.3, 3.5, 4.4
 */

import { pricingSEOTester } from '../src/lib/testers/pricing-seo-tester';
import type { PricingSEOTestResult } from '../src/lib/testers/pricing-seo-tester';

class TestReportGenerator {
  generateReport(result: PricingSEOTestResult): string {
    const report = `# Pricing and SEO Functionality Test Report

**Generated:** ${result.overview.testEndTime.toISOString()}
**Test Duration:** ${Math.round(result.overview.testDuration / 1000)}s
**Overall Status:** ${result.status}
**Overall Score:** ${result.overallScore}/100

## Executive Summary

${this.generateExecutiveSummary(result)}

## Test Overview

- **Total Tests Run:** ${result.overview.totalTestsRun.toLocaleString()}
- **Platforms Tested:** ${result.overview.platformsTested.join(', ')}
- **Product Sample Size:** ${result.overview.productSampleSize}
- **Test Start Time:** ${result.overview.testStartTime.toISOString()}
- **Test End Time:** ${result.overview.testEndTime.toISOString()}

## Pricing Functionality Tests

### Summary
- **Total Pricing Tests:** ${result.pricingTests.totalPricingTests}
- **Passed Tests:** ${result.pricingTests.passedPricingTests}
- **Failed Tests:** ${result.pricingTests.failedPricingTests}
- **Accuracy Rate:** ${result.pricingTests.accuracyRate}%

### Platform Pricing Tests
${this.generatePlatformPricingSection(result.pricingTests.platformTests)}

### Bulk Pricing Tests
${result.pricingTests.bulkPricingTests.map((test, index) => `
#### Bulk Test ${index + 1} (${test.productCount} products)
- **Base Price:** ${test.basePrice.toLocaleString()} IDR
- **Total Duration:** ${test.totalDuration}ms
- **Average Duration per Product:** ${Math.round(test.averageDurationPerProduct)}ms
- **Platform Results:**
${test.platformResults.map(pr => `  - **${pr.platform}:** ${pr.price.toLocaleString()} IDR ${pr.isAccurate ? '✅' : '❌'}`).join('\n')}
`).join('\n')}

### Edge Case Tests
${result.pricingTests.edgeCaseTests.map((test, index) => `
#### ${index + 1}. ${test.testName}
- **Input:** ${JSON.stringify(test.input)}
- **Expected:** ${test.expectedBehavior}
- **Actual:** ${test.actualBehavior}
- **Result:** ${test.passed ? '✅ PASS' : '❌ FAIL'}
${test.error ? `- **Error:** ${test.error}` : ''}
`).join('\n')}

### Pricing Performance Metrics
- **Average Single Calculation Time:** ${Math.round(result.pricingTests.performanceMetrics.singleCalculationTime)}ms
- **Average Bulk Calculation Time:** ${Math.round(result.pricingTests.performanceMetrics.bulkCalculationTime)}ms
- **Memory Usage per Calculation:** ${result.pricingTests.performanceMetrics.memoryUsagePerCalculation} bytes

## SEO Functionality Tests

### Summary
- **Total SEO Tests:** ${result.seoTests.totalSEOTests}
- **Passed Tests:** ${result.seoTests.passedSEOTests}
- **Failed Tests:** ${result.seoTests.failedSEOTests}
- **Average Similarity:** ${result.seoTests.averageSimilarity}%
- **Average Quality Score:** ${result.seoTests.averageQualityScore}/100

### Platform SEO Tests
${this.generatePlatformSEOSection(result.seoTests.platformTests)}

### Title Variation Tests
${result.seoTests.titleVariationTests.slice(0, 5).map((test, index) => `
#### ${index + 1}. "${test.originalTitle}"
- **Average Similarity:** ${Math.round(test.averageSimilarity)}%
- **Variation Quality:** ${Math.round(test.variationQuality)}/100
- **Platform Variations:**
${test.variations.map(v => `  - **${v.platform}:** "${v.title}" (${Math.round(v.similarity)}% similar, ${Math.round(v.uniqueness)}% unique)`).join('\n')}
`).join('\n')}

### Keyword Optimization Tests
${result.seoTests.keywordOptimizationTests.slice(0, 5).map((test, index) => `
#### ${index + 1}. ${test.platform.toUpperCase()} - "${test.originalTitle}"
- **Generated Title:** "${test.generatedTitle}"
- **Keywords Added:** ${test.keywordsAdded.join(', ') || 'None'}
- **Keyword Density:** ${Math.round(test.keywordDensity)}%
- **SEO Score:** ${Math.round(test.seoScore)}/100
- **Platform Optimization:** ${test.platformSpecificOptimization ? '✅ Yes' : '❌ No'}
`).join('\n')}

### SEO Performance Metrics
- **Average Single Generation Time:** ${Math.round(result.seoTests.performanceMetrics.singleGenerationTime)}ms
- **Average Bulk Generation Time:** ${Math.round(result.seoTests.performanceMetrics.bulkGenerationTime)}ms
- **Memory Usage per Generation:** ${result.seoTests.performanceMetrics.memoryUsagePerGeneration} bytes
- **Pattern Matching Time:** ${Math.round(result.seoTests.performanceMetrics.patternMatchingTime)}ms

## Integration Tests

### Master Product Integration Tests
${result.integrationTests.masterProductTests.slice(0, 5).map((test, index) => `
#### ${index + 1}. ${test.masterSku}
- **Pricing Integration:** ${test.pricingIntegration.calculationAccuracy ? '✅ PASS' : '❌ FAIL'}
  - Base Price: ${test.pricingIntegration.basePrice.toLocaleString()} IDR
  - Platform Prices: ${Object.entries(test.pricingIntegration.platformPrices).map(([p, price]) => `${p}: ${price.toLocaleString()}`).join(', ')}
- **SEO Integration:** ${test.seoIntegration.titleQuality ? '✅ PASS' : '❌ FAIL'}
  - Original: "${test.seoIntegration.originalTitle}"
  - Platform Titles: ${Object.keys(test.seoIntegration.platformTitles).length} generated
- **Overall Integration:** ${test.overallIntegration ? '✅ PASS' : '❌ FAIL'}
`).join('\n')}

### End-to-End Tests
${result.integrationTests.endToEndTests.map((test, index) => `
#### ${index + 1}. ${test.testName}
- **Result:** ${test.result === 'PASS' ? '✅ PASS' : '❌ FAIL'}
- **Duration:** ${test.duration}ms
- **Steps:** ${test.steps.join(' → ')}
${test.error ? `- **Error:** ${test.error}` : ''}
`).join('\n')}

### Data Consistency Tests
${result.integrationTests.dataConsistencyTests.map((test, index) => `
#### ${index + 1}. ${test.testName}
- **Result:** ${test.isConsistent ? '✅ CONSISTENT' : '❌ INCONSISTENT'}
- **Expected:** ${JSON.stringify(test.expectedValue)}
- **Actual:** ${JSON.stringify(test.actualValue)}
${test.variance ? `- **Variance:** ${test.variance}` : ''}
`).join('\n')}

## Performance Tests

### Pricing Performance
- **Average Calculation Time:** ${Math.round(result.performanceTests.pricingPerformance.averageCalculationTime)}ms
- **Max Calculation Time:** ${Math.round(result.performanceTests.pricingPerformance.maxCalculationTime)}ms
- **Calculations per Second:** ${result.performanceTests.pricingPerformance.calculationsPerSecond}

### SEO Performance
- **Average Generation Time:** ${Math.round(result.performanceTests.seoPerformance.averageGenerationTime)}ms
- **Max Generation Time:** ${Math.round(result.performanceTests.seoPerformance.maxGenerationTime)}ms
- **Generations per Second:** ${result.performanceTests.seoPerformance.generationsPerSecond}

### Memory Usage
- **Initial Memory:** ${result.performanceTests.memoryUsage.initialMemory} MB
- **Peak Memory:** ${result.performanceTests.memoryUsage.peakMemory} MB
- **Final Memory:** ${result.performanceTests.memoryUsage.finalMemory} MB
- **Memory Growth:** ${result.performanceTests.memoryUsage.finalMemory - result.performanceTests.memoryUsage.initialMemory} MB

## Recommendations

${result.recommendations.length === 0 ? 'No recommendations - all tests passed successfully!' : ''}
${result.recommendations.map((rec, index) => `
### ${index + 1}. ${rec.title} (${rec.priority.toUpperCase()} PRIORITY)

**Category:** ${rec.category.replace('_', ' ').toUpperCase()}
**Description:** ${rec.description}
**Action Required:** ${rec.actionRequired}
**Expected Outcome:** ${rec.expectedOutcome}
${rec.affectedTests ? `**Affected Tests:** ${rec.affectedTests}` : ''}
`).join('\n')}

## Test Summary

${this.generateTestSummary(result)}

---

*This test report was generated automatically by the SyncStore Pricing and SEO Functionality Tester*
`;

    return report;
  }

  private generateExecutiveSummary(result: PricingSEOTestResult): string {
    const criticalIssues = result.recommendations.filter(r => r.priority === 'critical').length;
    const highIssues = result.recommendations.filter(r => r.priority === 'high').length;
    
    if (result.status === 'PASS') {
      return `✅ **ALL TESTS PASSED**: Pricing and SEO functionality tests completed successfully. Pricing accuracy is ${result.pricingTests.accuracyRate}% and SEO quality score is ${result.seoTests.averageQualityScore}/100. All ${result.overview.platformsTested.length} platforms are working correctly with ${result.overview.productSampleSize} product samples tested.`;
    } else if (result.status === 'WARNING') {
      return `⚠️ **TESTS PASSED WITH WARNINGS**: Most functionality tests passed but ${highIssues} high-priority issues were identified. Overall score is ${result.overallScore}/100. The system is functional but addressing these issues will improve reliability.`;
    } else {
      return `❌ **TESTS FAILED**: Critical issues found in pricing and/or SEO functionality. ${criticalIssues} critical and ${highIssues} high-priority issues detected. Overall score is ${result.overallScore}/100. These issues must be addressed before production use.`;
    }
  }

  private generatePlatformPricingSection(platformTests: any[]): string {
    const platformGroups = platformTests.reduce((groups, test) => {
      if (!groups[test.platform]) {
        groups[test.platform] = [];
      }
      groups[test.platform].push(test);
      return groups;
    }, {} as Record<string, any[]>);

    return Object.entries(platformGroups).map(([platform, tests]) => {
      const accurateTests = tests.filter(t => t.isAccurate).length;
      const accuracyRate = Math.round((accurateTests / tests.length) * 100);
      const avgDuration = Math.round(tests.reduce((sum, t) => sum + t.testDuration, 0) / tests.length);
      
      const sampleTests = tests.slice(0, 3);
      
      return `
#### ${platform.toUpperCase()}
- **Tests Run:** ${tests.length}
- **Accuracy Rate:** ${accuracyRate}%
- **Average Duration:** ${avgDuration}ms

**Sample Results:**
${sampleTests.map((test, index) => `${index + 1}. Base: ${test.basePrice.toLocaleString()} → Expected: ${test.expectedPrice.toLocaleString()} → Actual: ${test.actualPrice.toLocaleString()} ${test.isAccurate ? '✅' : '❌'} (${test.feePercentage}% fee)`).join('\n')}`;
    }).join('\n');
  }

  private generatePlatformSEOSection(platformTests: any[]): string {
    const platformGroups = platformTests.reduce((groups, test) => {
      if (!groups[test.platform]) {
        groups[test.platform] = [];
      }
      groups[test.platform].push(test);
      return groups;
    }, {} as Record<string, any[]>);

    return Object.entries(platformGroups).map(([platform, tests]) => {
      const appropriateTests = tests.filter(t => t.isAppropriate).length;
      const appropriatenessRate = Math.round((appropriateTests / tests.length) * 100);
      const avgSimilarity = Math.round(tests.reduce((sum, t) => sum + t.similarity, 0) / tests.length);
      const avgQuality = Math.round(tests.reduce((sum, t) => sum + t.qualityScore, 0) / tests.length);
      const avgDuration = Math.round(tests.reduce((sum, t) => sum + t.testDuration, 0) / tests.length);
      
      const sampleTests = tests.slice(0, 3);
      
      return `
#### ${platform.toUpperCase()}
- **Tests Run:** ${tests.length}
- **Appropriateness Rate:** ${appropriatenessRate}%
- **Average Similarity:** ${avgSimilarity}%
- **Average Quality Score:** ${avgQuality}/100
- **Average Duration:** ${avgDuration}ms

**Sample Results:**
${sampleTests.map((test, index) => `${index + 1}. "${test.originalTitle}" → "${test.generatedTitle}" (${Math.round(test.similarity)}% similar, ${Math.round(test.qualityScore)}/100 quality) ${test.isAppropriate ? '✅' : '❌'}`).join('\n')}`;
    }).join('\n');
  }

  private generateTestSummary(result: PricingSEOTestResult): string {
    const totalIssues = result.recommendations.length;
    const criticalIssues = result.recommendations.filter(r => r.priority === 'critical').length;
    const highIssues = result.recommendations.filter(r => r.priority === 'high').length;

    let summary = `**Overall Test Status:** ${result.status}\n`;
    summary += `**Overall Score:** ${result.overallScore}/100\n`;
    summary += `**Total Tests Run:** ${result.overview.totalTestsRun}\n`;
    summary += `**Test Duration:** ${Math.round(result.overview.testDuration / 1000)}s\n`;
    
    if (criticalIssues > 0) {
      summary += `**Critical Issues:** ${criticalIssues} (must be fixed immediately)\n`;
    }
    
    if (highIssues > 0) {
      summary += `**High Priority Issues:** ${highIssues} (should be addressed soon)\n`;
    }

    summary += '\n**Key Metrics:**\n';
    summary += `- Pricing Accuracy: ${result.pricingTests.accuracyRate}%\n`;
    summary += `- SEO Quality Score: ${result.seoTests.averageQualityScore}/100\n`;
    summary += `- SEO Similarity: ${result.seoTests.averageSimilarity}%\n`;
    summary += `- Pricing Performance: ${Math.round(result.performanceTests.pricingPerformance.averageCalculationTime)}ms avg\n`;
    summary += `- SEO Performance: ${Math.round(result.performanceTests.seoPerformance.averageGenerationTime)}ms avg\n`;

    if (result.status === 'PASS') {
      summary += '\n🎉 **All Tests Passed**: Pricing and SEO functionality is working correctly!';
    } else if (result.status === 'WARNING') {
      summary += '\n📝 **Action Recommended**: Address high-priority issues for optimal performance.';
    } else {
      summary += '\n🚨 **Critical Action Required**: Fix all critical issues before production use.';
    }

    return summary;
  }
}

async function main() {
  console.log('🧪 Starting pricing and SEO functionality tests (Task 8.2)...');
  console.log('=======================================================');

  try {
    const startTime = Date.now();
    
    // Run comprehensive tests
    const result = await pricingSEOTester.runAllTests();
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    // Display results summary
    console.log('\n📊 Test Results Summary');
    console.log('=======================');
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📈 Overall Score: ${result.overallScore}/100`);
    console.log(`🎯 Status: ${result.status}`);
    console.log(`🧪 Total Tests: ${result.overview.totalTestsRun}`);

    // Pricing test summary
    console.log('\n💰 Pricing Tests:');
    console.log(`   Total Tests: ${result.pricingTests.totalPricingTests}`);
    console.log(`   Passed: ${result.pricingTests.passedPricingTests}`);
    console.log(`   Failed: ${result.pricingTests.failedPricingTests}`);
    console.log(`   Accuracy Rate: ${result.pricingTests.accuracyRate}%`);
    console.log(`   Avg Calculation Time: ${Math.round(result.pricingTests.performanceMetrics.singleCalculationTime)}ms`);

    // SEO test summary
    console.log('\n🔍 SEO Tests:');
    console.log(`   Total Tests: ${result.seoTests.totalSEOTests}`);
    console.log(`   Passed: ${result.seoTests.passedSEOTests}`);
    console.log(`   Failed: ${result.seoTests.failedSEOTests}`);
    console.log(`   Avg Similarity: ${result.seoTests.averageSimilarity}%`);
    console.log(`   Avg Quality Score: ${result.seoTests.averageQualityScore}/100`);
    console.log(`   Avg Generation Time: ${Math.round(result.seoTests.performanceMetrics.singleGenerationTime)}ms`);

    // Integration test summary
    console.log('\n🔗 Integration Tests:');
    const integrationPassRate = result.integrationTests.masterProductTests.length > 0
      ? Math.round((result.integrationTests.masterProductTests.filter(t => t.overallIntegration).length / result.integrationTests.masterProductTests.length) * 100)
      : 0;
    console.log(`   Master Product Tests: ${result.integrationTests.masterProductTests.length}`);
    console.log(`   Integration Pass Rate: ${integrationPassRate}%`);
    console.log(`   End-to-End Tests: ${result.integrationTests.endToEndTests.length}`);
    console.log(`   Data Consistency Tests: ${result.integrationTests.dataConsistencyTests.length}`);

    // Performance summary
    console.log('\n⚡ Performance:');
    console.log(`   Pricing: ${result.performanceTests.pricingPerformance.calculationsPerSecond} calc/sec`);
    console.log(`   SEO: ${result.performanceTests.seoPerformance.generationsPerSecond} gen/sec`);
    console.log(`   Memory Growth: ${result.performanceTests.memoryUsage.finalMemory - result.performanceTests.memoryUsage.initialMemory} MB`);

    // Platform-specific results
    console.log('\n🏪 Platform Results:');
    const platforms = [...new Set(result.pricingTests.platformTests.map(t => t.platform))];
    for (const platform of platforms) {
      const pricingTests = result.pricingTests.platformTests.filter(t => t.platform === platform);
      const seoTests = result.seoTests.platformTests.filter(t => t.platform === platform);
      
      const pricingAccuracy = pricingTests.length > 0 
        ? Math.round((pricingTests.filter(t => t.isAccurate).length / pricingTests.length) * 100)
        : 0;
      
      const seoAppropriateness = seoTests.length > 0
        ? Math.round((seoTests.filter(t => t.isAppropriate).length / seoTests.length) * 100)
        : 0;

      console.log(`   ${platform.toUpperCase()}: Pricing ${pricingAccuracy}%, SEO ${seoAppropriateness}%`);
    }

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
      console.log('\n✅ No recommendations - all tests passed successfully!');
    }

    // Sample test results
    console.log('\n📋 Sample Test Results:');
    
    // Show sample pricing test
    if (result.pricingTests.platformTests.length > 0) {
      const samplePricing = result.pricingTests.platformTests[0];
      console.log(`   Pricing: ${samplePricing.basePrice.toLocaleString()} IDR → ${samplePricing.actualPrice.toLocaleString()} IDR (${samplePricing.platform}) ${samplePricing.isAccurate ? '✅' : '❌'}`);
    }

    // Show sample SEO test
    if (result.seoTests.platformTests.length > 0) {
      const sampleSEO = result.seoTests.platformTests[0];
      console.log(`   SEO: "${sampleSEO.originalTitle}" → "${sampleSEO.generatedTitle}" (${Math.round(sampleSEO.similarity)}% similar) ${sampleSEO.isAppropriate ? '✅' : '❌'}`);
    }

    // Generate detailed report
    const reportGenerator = new TestReportGenerator();
    const detailedReport = reportGenerator.generateReport(result);
    
    // Save report to file
    const fs = await import('fs/promises');
    const reportPath = `./docs/phase1/pricing-seo-test-report-${new Date().toISOString().split('T')[0]}.md`;
    await fs.writeFile(reportPath, detailedReport, 'utf8');
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    // Final status
    console.log('\n🎯 Final Status');
    console.log('===============');
    
    if (result.status === 'PASS') {
      console.log('✅ ALL TESTS PASSED');
      console.log('🎉 Pricing and SEO functionality is working correctly!');
      console.log('🚀 System is ready for production use.');
      process.exit(0);
    } else if (result.status === 'WARNING') {
      console.log('⚠️  TESTS PASSED WITH WARNINGS');
      console.log('📝 Some issues found but functionality is working.');
      console.log('🔧 Consider addressing high-priority recommendations.');
      process.exit(0);
    } else {
      console.log('❌ TESTS FAILED');
      console.log('🚨 Critical issues found in pricing and/or SEO functionality.');
      console.log('🔧 Please review and fix all critical recommendations.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Pricing and SEO tests failed:', error);
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