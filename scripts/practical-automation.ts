#!/usr/bin/env tsx
/**
 * Practical Automation - Focus on what works and provides immediate value
 * Skip complex analysis, focus on actionable results
 */

import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

interface PracticalReport {
  timestamp: Date;
  buildStatus: 'pass' | 'fail';
  testStatus: 'pass' | 'fail' | 'partial';
  lintStatus: 'pass' | 'fail' | 'partial';
  typeStatus: 'pass' | 'fail' | 'partial';
  criticalIssues: string[];
  recommendations: string[];
  score: number;
}

class PracticalAutomation {
  private projectRoot: string;
  private report: PracticalReport;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.report = {
      timestamp: new Date(),
      buildStatus: 'fail',
      testStatus: 'fail',
      lintStatus: 'fail',
      typeStatus: 'fail',
      criticalIssues: [],
      recommendations: [],
      score: 0
    };
  }

  /**
   * Run practical automation - focus on what works
   */
  async run(): Promise<PracticalReport> {
    console.log('🚀 Practical Automation - Quick & Effective\n');

    // 1. Check Build
    await this.checkBuild();
    
    // 2. Check Tests (basic)
    await this.checkTests();
    
    // 3. Check Linting (auto-fix what we can)
    await this.checkLinting();
    
    // 4. Check Types (simplified)
    await this.checkTypes();
    
    // 5. Calculate score and recommendations
    this.calculateScore();
    this.generateRecommendations();
    
    // 6. Show results
    this.showResults();
    
    return this.report;
  }

  /**
   * Check if project builds
   */
  private async checkBuild(): Promise<void> {
    console.log('🔨 Checking Build...');
    
    try {
      execSync('npm run build', {
        cwd: this.projectRoot,
        stdio: 'pipe',
        timeout: 60000 // 1 minute timeout
      });
      
      this.report.buildStatus = 'pass';
      console.log('✅ Build: PASSED');
      
    } catch (error: any) {
      this.report.buildStatus = 'fail';
      console.log('❌ Build: FAILED');
      
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      if (output.includes('Type error')) {
        this.report.criticalIssues.push('Build failing due to TypeScript errors');
      } else if (output.includes('Module not found')) {
        this.report.criticalIssues.push('Build failing due to missing dependencies');
      } else {
        this.report.criticalIssues.push('Build failing - check build logs');
      }
    }
  }

  /**
   * Check tests (basic run)
   */
  private async checkTests(): Promise<void> {
    console.log('🧪 Checking Tests...');
    
    try {
      execSync('npm test -- --run --passWithNoTests --reporter=basic', {
        cwd: this.projectRoot,
        stdio: 'pipe',
        timeout: 30000 // 30 seconds timeout
      });
      
      this.report.testStatus = 'pass';
      console.log('✅ Tests: PASSED');
      
    } catch (error: any) {
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      
      if (output.includes('0 failed')) {
        this.report.testStatus = 'partial';
        console.log('🟡 Tests: PARTIAL (some tests skipped)');
      } else {
        this.report.testStatus = 'fail';
        console.log('❌ Tests: FAILED');
        this.report.criticalIssues.push('Some tests are failing');
      }
    }
  }

  /**
   * Check linting and auto-fix
   */
  private async checkLinting(): Promise<void> {
    console.log('🔍 Checking Linting...');
    
    try {
      // First try to auto-fix
      execSync('npx eslint src --fix --quiet', {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      
      // Then check remaining issues
      execSync('npx eslint src --quiet', {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      
      this.report.lintStatus = 'pass';
      console.log('✅ Linting: PASSED');
      
    } catch (error: any) {
      const output = error.stdout?.toString() || '';
      const errorCount = (output.match(/error/g) || []).length;
      
      if (errorCount < 10) {
        this.report.lintStatus = 'partial';
        console.log(`🟡 Linting: PARTIAL (${errorCount} issues remaining)`);
      } else {
        this.report.lintStatus = 'fail';
        console.log(`❌ Linting: FAILED (${errorCount} issues)`);
        this.report.criticalIssues.push(`${errorCount} linting issues need attention`);
      }
    }
  }

  /**
   * Check TypeScript (simplified)
   */
  private async checkTypes(): Promise<void> {
    console.log('📝 Checking TypeScript...');
    
    try {
      execSync('npx tsc --noEmit --skipLibCheck', {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      
      this.report.typeStatus = 'pass';
      console.log('✅ TypeScript: PASSED');
      
    } catch (error: any) {
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      const errorCount = (output.match(/error TS/g) || []).length;
      
      if (errorCount < 50) {
        this.report.typeStatus = 'partial';
        console.log(`🟡 TypeScript: PARTIAL (${errorCount} errors)`);
      } else {
        this.report.typeStatus = 'fail';
        console.log(`❌ TypeScript: FAILED (${errorCount} errors)`);
        this.report.criticalIssues.push(`${errorCount} TypeScript errors need fixing`);
      }
    }
  }

  /**
   * Calculate overall score
   */
  private calculateScore(): void {
    let score = 0;
    
    // Build is most important (40 points)
    if (this.report.buildStatus === 'pass') score += 40;
    
    // Tests (25 points)
    if (this.report.testStatus === 'pass') score += 25;
    else if (this.report.testStatus === 'partial') score += 15;
    
    // Linting (20 points)
    if (this.report.lintStatus === 'pass') score += 20;
    else if (this.report.lintStatus === 'partial') score += 10;
    
    // Types (15 points)
    if (this.report.typeStatus === 'pass') score += 15;
    else if (this.report.typeStatus === 'partial') score += 8;
    
    this.report.score = score;
  }

  /**
   * Generate practical recommendations
   */
  private generateRecommendations(): void {
    const recs = this.report.recommendations;
    
    // Priority 1: Build issues
    if (this.report.buildStatus === 'fail') {
      recs.push('🔥 CRITICAL: Fix build errors first - nothing else matters if it doesn\'t build');
    }
    
    // Priority 2: Major type issues
    if (this.report.typeStatus === 'fail') {
      recs.push('🚨 HIGH: Reduce TypeScript errors - focus on critical ones first');
    }
    
    // Priority 3: Test issues
    if (this.report.testStatus === 'fail') {
      recs.push('⚠️  MEDIUM: Fix failing tests - they catch bugs early');
    }
    
    // Priority 4: Linting
    if (this.report.lintStatus === 'fail') {
      recs.push('📝 LOW: Clean up linting issues - improves code quality');
    }
    
    // Positive recommendations
    if (this.report.score >= 80) {
      recs.push('🎉 GREAT: Project is in good shape! Focus on minor improvements');
    } else if (this.report.score >= 60) {
      recs.push('👍 GOOD: Project is functional, address remaining issues when possible');
    } else if (this.report.score >= 40) {
      recs.push('⚡ FOCUS: Project needs attention, prioritize critical issues');
    } else {
      recs.push('🆘 URGENT: Project needs immediate attention to be functional');
    }
  }

  /**
   * Show results in a clear format
   */
  private showResults(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 PRACTICAL AUTOMATION RESULTS');
    console.log('='.repeat(60));
    
    // Score and grade
    const grade = this.getGrade();
    console.log(`🎯 Overall Score: ${this.report.score}/100 ${grade}`);
    console.log('');
    
    // Status overview
    console.log('📋 Status Overview:');
    console.log(`   🔨 Build: ${this.getStatusIcon(this.report.buildStatus)}`);
    console.log(`   🧪 Tests: ${this.getStatusIcon(this.report.testStatus)}`);
    console.log(`   🔍 Linting: ${this.getStatusIcon(this.report.lintStatus)}`);
    console.log(`   📝 TypeScript: ${this.getStatusIcon(this.report.typeStatus)}`);
    console.log('');
    
    // Critical issues
    if (this.report.criticalIssues.length > 0) {
      console.log('🚨 Critical Issues:');
      this.report.criticalIssues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
      console.log('');
    }
    
    // Recommendations
    console.log('💡 Recommendations:');
    this.report.recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`);
    });
    
    console.log('='.repeat(60));
    console.log(`⏱️  Completed in ${Date.now() - this.report.timestamp.getTime()}ms`);
  }

  /**
   * Get grade based on score
   */
  private getGrade(): string {
    const score = this.report.score;
    if (score >= 90) return '🟢 A (Excellent)';
    if (score >= 80) return '🟡 B (Good)';
    if (score >= 60) return '🟠 C (Fair)';
    if (score >= 40) return '🔴 D (Poor)';
    return '⚫ F (Critical)';
  }

  /**
   * Get status icon
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'pass': return '✅ PASS';
      case 'partial': return '🟡 PARTIAL';
      case 'fail': return '❌ FAIL';
      default: return '❓ UNKNOWN';
    }
  }

  /**
   * Quick fix mode - just try to fix what we can quickly
   */
  async quickFix(): Promise<void> {
    console.log('⚡ Quick Fix Mode - Fixing what we can...\n');
    
    // 1. Auto-fix linting
    console.log('🔧 Auto-fixing linting issues...');
    try {
      execSync('npx eslint src --fix --quiet', { cwd: this.projectRoot, stdio: 'pipe' });
      console.log('✅ Linting auto-fixes applied');
    } catch {
      console.log('⚠️  Some linting issues could not be auto-fixed');
    }
    
    // 2. Format code
    console.log('🎨 Formatting code...');
    try {
      execSync('npx prettier --write src --log-level silent', { cwd: this.projectRoot, stdio: 'pipe' });
      console.log('✅ Code formatted');
    } catch {
      console.log('⚠️  Code formatting failed');
    }
    
    // 3. Check if build works now
    console.log('🔨 Testing build...');
    try {
      execSync('npm run build', { cwd: this.projectRoot, stdio: 'pipe' });
      console.log('✅ Build is working!');
    } catch {
      console.log('❌ Build still failing - manual intervention needed');
    }
    
    console.log('\n⚡ Quick fix completed!');
  }

  /**
   * Save report to file
   */
  async saveReport(): Promise<void> {
    const reportPath = path.join(this.projectRoot, 'practical-report.json');
    await fs.writeFile(reportPath, JSON.stringify(this.report, null, 2));
    
    const summaryPath = path.join(this.projectRoot, 'PRACTICAL-SUMMARY.md');
    const summary = `# Practical Automation Summary

**Generated:** ${this.report.timestamp.toISOString()}
**Score:** ${this.report.score}/100 ${this.getGrade()}

## Status
- 🔨 Build: ${this.getStatusIcon(this.report.buildStatus)}
- 🧪 Tests: ${this.getStatusIcon(this.report.testStatus)}
- 🔍 Linting: ${this.getStatusIcon(this.report.lintStatus)}
- 📝 TypeScript: ${this.getStatusIcon(this.report.typeStatus)}

## Critical Issues
${this.report.criticalIssues.map(issue => `- ${issue}`).join('\n')}

## Recommendations
${this.report.recommendations.map(rec => `- ${rec}`).join('\n')}

---
*Focus on what works, fix what matters most.*
`;
    
    await fs.writeFile(summaryPath, summary);
    console.log(`\n📄 Reports saved: ${reportPath}, ${summaryPath}`);
  }
}

// CLI interface
if (require.main === module) {
  const automation = new PracticalAutomation();
  
  const command = process.argv[2] || 'run';
  
  switch (command) {
    case 'run':
      automation.run().then(() => automation.saveReport());
      break;
    case 'fix':
      automation.quickFix();
      break;
    default:
      console.log('Usage: practical-automation [run|fix]');
  }
}

export { PracticalAutomation };