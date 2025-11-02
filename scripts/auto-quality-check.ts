#!/usr/bin/env tsx
/**
 * One-Command Quality Check & Auto-Fix
 * The ultimate automation script - does everything in one go
 */

import { AutoTestGenerator } from './auto-test-generator';
import { SmartErrorDetector } from './smart-error-detector';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

interface QualityReport {
  timestamp: Date;
  testsGenerated: number;
  errorsFound: number;
  errorsFixed: number;
  coveragePercent: number;
  qualityScore: number;
  recommendations: string[];
}

class AutoQualityChecker {
  private projectRoot: string;
  private report: QualityReport;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.report = {
      timestamp: new Date(),
      testsGenerated: 0,
      errorsFound: 0,
      errorsFixed: 0,
      coveragePercent: 0,
      qualityScore: 0,
      recommendations: []
    };
  }

  /**
   * Run complete quality check and auto-fix
   */
  async runComplete(): Promise<QualityReport> {
    console.log('🚀 Starting Complete Quality Check & Auto-Fix...\n');

    try {
      // Step 1: Generate missing tests
      await this.generateTests();

      // Step 2: Detect and fix errors
      await this.detectAndFixErrors();

      // Step 3: Run tests and get coverage
      await this.runTestsAndCoverage();

      // Step 4: Calculate quality score
      this.calculateQualityScore();

      // Step 5: Generate recommendations
      this.generateRecommendations();

      // Step 6: Save report
      await this.saveReport();

      console.log('\n🎉 Quality check completed!');
      this.printFinalReport();

      return this.report;

    } catch (error) {
      console.error('❌ Quality check failed:', error);
      throw error;
    }
  }

  /**
   * Step 1: Generate missing tests
   */
  private async generateTests(): Promise<void> {
    console.log('📝 Step 1: Generating missing tests...');
    
    try {
      const generator = new AutoTestGenerator(this.projectRoot);
      await generator.run();
      
      // Count generated tests (simplified)
      const testDir = path.join(this.projectRoot, 'src/test/auto-generated');
      try {
        const files = await this.countFilesRecursively(testDir);
        this.report.testsGenerated = files;
        console.log(`✅ Generated ${files} test files`);
      } catch {
        this.report.testsGenerated = 0;
      }
      
    } catch (error) {
      console.warn('⚠️  Test generation failed:', error);
      this.report.recommendations.push('Manual test creation needed');
    }
  }

  /**
   * Step 2: Detect and fix errors
   */
  private async detectAndFixErrors(): Promise<void> {
    console.log('\n🔍 Step 2: Detecting and fixing errors...');
    
    try {
      const detector = new SmartErrorDetector(this.projectRoot);
      
      // Detect errors
      const errors = await detector.detectAllErrors();
      this.report.errorsFound = errors.length;
      
      // Auto-fix what we can
      await detector.autoFixErrors();
      
      // Re-detect to see what's left
      const remainingErrors = await detector.detectAllErrors();
      this.report.errorsFixed = errors.length - remainingErrors.length;
      
      console.log(`✅ Fixed ${this.report.errorsFixed}/${this.report.errorsFound} errors`);
      
    } catch (error) {
      console.warn('⚠️  Error detection failed:', error);
      this.report.recommendations.push('Manual error review needed');
    }
  }

  /**
   * Step 3: Run tests and get coverage
   */
  private async runTestsAndCoverage(): Promise<void> {
    console.log('\n🧪 Step 3: Running tests and calculating coverage...');
    
    try {
      // Run tests with coverage
      const result = execSync('npm run test:coverage -- --run --reporter=json', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      // Parse coverage (simplified)
      try {
        const coverageData = JSON.parse(result);
        this.report.coveragePercent = coverageData.coverageMap?.total?.statements?.pct || 0;
      } catch {
        // Fallback: check coverage files
        const coveragePath = path.join(this.projectRoot, 'coverage/coverage-summary.json');
        try {
          const coverageFile = await fs.readFile(coveragePath, 'utf8');
          const coverage = JSON.parse(coverageFile);
          this.report.coveragePercent = coverage.total?.statements?.pct || 0;
        } catch {
          this.report.coveragePercent = 0;
        }
      }
      
      console.log(`✅ Test coverage: ${this.report.coveragePercent.toFixed(1)}%`);
      
    } catch (error) {
      console.warn('⚠️  Test execution failed:', error);
      this.report.coveragePercent = 0;
      this.report.recommendations.push('Fix failing tests');
    }
  }

  /**
   * Step 4: Calculate quality score
   */
  private calculateQualityScore(): void {
    console.log('\n📊 Step 4: Calculating quality score...');
    
    // Quality score calculation (0-100)
    let score = 100;
    
    // Deduct for errors
    const errorPenalty = Math.min(50, (this.report.errorsFound - this.report.errorsFixed) * 5);
    score -= errorPenalty;
    
    // Deduct for low coverage
    const coveragePenalty = Math.max(0, (80 - this.report.coveragePercent) * 0.5);
    score -= coveragePenalty;
    
    // Bonus for generated tests
    const testBonus = Math.min(10, this.report.testsGenerated * 0.5);
    score += testBonus;
    
    this.report.qualityScore = Math.max(0, Math.round(score));
    
    console.log(`✅ Quality Score: ${this.report.qualityScore}/100`);
  }

  /**
   * Step 5: Generate recommendations
   */
  private generateRecommendations(): void {
    console.log('\n💡 Step 5: Generating recommendations...');
    
    // Coverage recommendations
    if (this.report.coveragePercent < 80) {
      this.report.recommendations.push(`Increase test coverage to 80%+ (currently ${this.report.coveragePercent.toFixed(1)}%)`);
    }
    
    // Error recommendations
    const remainingErrors = this.report.errorsFound - this.report.errorsFixed;
    if (remainingErrors > 0) {
      this.report.recommendations.push(`Fix ${remainingErrors} remaining errors`);
    }
    
    // Quality recommendations
    if (this.report.qualityScore < 70) {
      this.report.recommendations.push('Focus on code quality improvements');
    }
    
    // Test recommendations
    if (this.report.testsGenerated === 0) {
      this.report.recommendations.push('Add unit tests for core functionality');
    }
    
    // Security recommendations
    this.report.recommendations.push('Run security audit regularly');
    this.report.recommendations.push('Keep dependencies updated');
    
    console.log(`✅ Generated ${this.report.recommendations.length} recommendations`);
  }

  /**
   * Step 6: Save report
   */
  private async saveReport(): Promise<void> {
    const reportPath = path.join(this.projectRoot, 'quality-report.json');
    await fs.writeFile(reportPath, JSON.stringify(this.report, null, 2));
    
    // Also create a markdown report
    const markdownReport = this.generateMarkdownReport();
    const markdownPath = path.join(this.projectRoot, 'QUALITY-REPORT.md');
    await fs.writeFile(markdownPath, markdownReport);
    
    console.log(`📄 Reports saved: ${reportPath}, ${markdownPath}`);
  }

  /**
   * Generate markdown report
   */
  private generateMarkdownReport(): string {
    return `# Quality Report

Generated: ${this.report.timestamp.toISOString()}

## Summary

- **Quality Score**: ${this.report.qualityScore}/100
- **Test Coverage**: ${this.report.coveragePercent.toFixed(1)}%
- **Tests Generated**: ${this.report.testsGenerated}
- **Errors Found**: ${this.report.errorsFound}
- **Errors Fixed**: ${this.report.errorsFixed}

## Quality Grade

${this.getQualityGrade()}

## Recommendations

${this.report.recommendations.map(rec => `- ${rec}`).join('\n')}

## Next Steps

1. Address remaining errors
2. Improve test coverage
3. Run quality check regularly
4. Monitor security vulnerabilities

---
*Generated by AutoQualityChecker*
`;
  }

  /**
   * Get quality grade based on score
   */
  private getQualityGrade(): string {
    const score = this.report.qualityScore;
    
    if (score >= 90) return '🟢 **A** - Excellent';
    if (score >= 80) return '🟡 **B** - Good';
    if (score >= 70) return '🟠 **C** - Fair';
    if (score >= 60) return '🔴 **D** - Poor';
    return '⚫ **F** - Critical';
  }

  /**
   * Print final report
   */
  private printFinalReport(): void {
    console.log('\n' + '='.repeat(50));
    console.log('📊 FINAL QUALITY REPORT');
    console.log('='.repeat(50));
    console.log(`🎯 Quality Score: ${this.report.qualityScore}/100 ${this.getQualityGrade()}`);
    console.log(`📈 Test Coverage: ${this.report.coveragePercent.toFixed(1)}%`);
    console.log(`🧪 Tests Generated: ${this.report.testsGenerated}`);
    console.log(`🔧 Errors Fixed: ${this.report.errorsFixed}/${this.report.errorsFound}`);
    console.log('\n💡 Top Recommendations:');
    this.report.recommendations.slice(0, 3).forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`);
    });
    console.log('='.repeat(50));
  }

  /**
   * Utility: Count files recursively
   */
  private async countFilesRecursively(dir: string): Promise<number> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      let count = 0;
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          count += await this.countFilesRecursively(path.join(dir, entry.name));
        } else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) {
          count++;
        }
      }
      
      return count;
    } catch {
      return 0;
    }
  }

  /**
   * Quick check mode - faster execution
   */
  async runQuickCheck(): Promise<QualityReport> {
    console.log('⚡ Running Quick Quality Check...\n');

    // Skip test generation, just check existing
    await this.detectAndFixErrors();
    
    // Quick test run without coverage
    try {
      execSync('npm test -- --run --passWithNoTests', {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      console.log('✅ Tests passing');
    } catch {
      console.log('❌ Tests failing');
      this.report.recommendations.push('Fix failing tests');
    }

    this.calculateQualityScore();
    this.generateRecommendations();
    
    console.log(`⚡ Quick check completed - Score: ${this.report.qualityScore}/100`);
    
    return this.report;
  }
}

// CLI interface
if (require.main === module) {
  const checker = new AutoQualityChecker();
  
  const mode = process.argv[2] || 'complete';
  
  switch (mode) {
    case 'quick':
      checker.runQuickCheck().catch(console.error);
      break;
    case 'complete':
    default:
      checker.runComplete().catch(console.error);
      break;
  }
}

export { AutoQualityChecker };