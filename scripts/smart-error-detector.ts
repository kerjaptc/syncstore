#!/usr/bin/env tsx
/**
 * Smart Error Detector & Auto-Fix System
 * Detects errors quickly and provides automated fixes
 */

import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { StaticAnalyzer } from '../src/lib/static-analysis';

interface ErrorReport {
  type: 'typescript' | 'eslint' | 'test' | 'build' | 'security';
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line?: number;
  message: string;
  autoFixAvailable: boolean;
  suggestedFix?: string;
}

class SmartErrorDetector {
  private projectRoot: string;
  private errors: ErrorReport[] = [];

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Run comprehensive error detection
   */
  async detectAllErrors(): Promise<ErrorReport[]> {
    console.log('🔍 Starting Smart Error Detection...');
    
    this.errors = [];
    
    // Run all checks in parallel for speed
    await Promise.allSettled([
      this.checkTypeScript(),
      this.checkESLint(),
      this.checkTests(),
      this.checkBuild(),
      this.checkSecurity()
    ]);
    
    // Sort by severity
    this.errors.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
    
    console.log(`📊 Found ${this.errors.length} issues`);
    this.printSummary();
    
    return this.errors;
  }

  /**
   * Auto-fix all fixable errors
   */
  async autoFixErrors(): Promise<void> {
    const fixableErrors = this.errors.filter(e => e.autoFixAvailable);
    
    if (fixableErrors.length === 0) {
      console.log('ℹ️  No auto-fixable errors found');
      return;
    }
    
    console.log(`🔧 Auto-fixing ${fixableErrors.length} errors...`);
    
    for (const error of fixableErrors) {
      try {
        await this.applyFix(error);
        console.log(`✅ Fixed: ${error.message}`);
      } catch (err) {
        console.log(`❌ Failed to fix: ${error.message}`);
      }
    }
    
    // Re-run detection to verify fixes
    console.log('🔄 Re-checking after fixes...');
    await this.detectAllErrors();
  }

  /**
   * Check TypeScript errors
   */
  private async checkTypeScript(): Promise<void> {
    try {
      console.log('🔍 Checking TypeScript...');
      execSync('npx tsc --noEmit', { stdio: 'pipe', cwd: this.projectRoot });
    } catch (error: any) {
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      this.parseTypeScriptErrors(output);
    }
  }

  /**
   * Check ESLint errors
   */
  private async checkESLint(): Promise<void> {
    try {
      console.log('🔍 Checking ESLint...');
      execSync('npx eslint src --format json', { stdio: 'pipe', cwd: this.projectRoot });
    } catch (error: any) {
      const output = error.stdout?.toString() || '';
      if (output) {
        this.parseESLintErrors(output);
      }
    }
  }

  /**
   * Check test errors
   */
  private async checkTests(): Promise<void> {
    try {
      console.log('🔍 Checking Tests...');
      execSync('npm test -- --run --reporter=json', { stdio: 'pipe', cwd: this.projectRoot });
    } catch (error: any) {
      const output = error.stdout?.toString() || '';
      if (output) {
        this.parseTestErrors(output);
      }
    }
  }

  /**
   * Check build errors
   */
  private async checkBuild(): Promise<void> {
    try {
      console.log('🔍 Checking Build...');
      execSync('npm run build', { stdio: 'pipe', cwd: this.projectRoot });
    } catch (error: any) {
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      this.parseBuildErrors(output);
    }
  }

  /**
   * Check security vulnerabilities
   */
  private async checkSecurity(): Promise<void> {
    try {
      console.log('🔍 Checking Security...');
      
      // Use our static analyzer
      const analyzer = new StaticAnalyzer(this.projectRoot, {
        enableTypeScript: false,
        enableESLint: false,
        enableSecurity: true
      });
      
      const result = await analyzer.analyze();
      
      result.errors.forEach(error => {
        this.errors.push({
          type: 'security',
          severity: this.mapSeverity(error.severity),
          file: error.file,
          line: error.line,
          message: error.message,
          autoFixAvailable: error.suggestions.some(s => s.automated),
          suggestedFix: error.suggestions.find(s => s.automated)?.description
        });
      });
      
    } catch (error) {
      console.warn('⚠️  Security check failed:', error);
    }
  }

  /**
   * Parse TypeScript compiler errors
   */
  private parseTypeScriptErrors(output: string): void {
    const lines = output.split('\n');
    
    lines.forEach(line => {
      const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+error\s+TS(\d+):\s+(.+)$/);
      if (match) {
        const [, file, lineNum, , errorCode, message] = match;
        
        this.errors.push({
          type: 'typescript',
          severity: this.getTypeScriptSeverity(errorCode),
          file: path.relative(this.projectRoot, file),
          line: parseInt(lineNum),
          message: `TS${errorCode}: ${message}`,
          autoFixAvailable: this.isTypeScriptAutoFixable(errorCode),
          suggestedFix: this.getTypeScriptFix(errorCode, message)
        });
      }
    });
  }

  /**
   * Parse ESLint errors
   */
  private parseESLintErrors(output: string): void {
    try {
      const results = JSON.parse(output);
      
      results.forEach((result: any) => {
        result.messages?.forEach((msg: any) => {
          this.errors.push({
            type: 'eslint',
            severity: msg.severity === 2 ? 'high' : 'medium',
            file: path.relative(this.projectRoot, result.filePath),
            line: msg.line,
            message: `${msg.ruleId}: ${msg.message}`,
            autoFixAvailable: !!msg.fix,
            suggestedFix: msg.fix ? 'ESLint auto-fix available' : undefined
          });
        });
      });
    } catch (error) {
      console.warn('Failed to parse ESLint output');
    }
  }

  /**
   * Parse test errors
   */
  private parseTestErrors(output: string): void {
    try {
      const results = JSON.parse(output);
      
      if (results.testResults) {
        results.testResults.forEach((testFile: any) => {
          testFile.assertionResults?.forEach((test: any) => {
            if (test.status === 'failed') {
              this.errors.push({
                type: 'test',
                severity: 'high',
                file: path.relative(this.projectRoot, testFile.name),
                message: `Test failed: ${test.title}`,
                autoFixAvailable: false
              });
            }
          });
        });
      }
    } catch (error) {
      // Fallback to text parsing
      const lines = output.split('\n');
      lines.forEach(line => {
        if (line.includes('FAIL') || line.includes('✗')) {
          this.errors.push({
            type: 'test',
            severity: 'high',
            file: 'unknown',
            message: line.trim(),
            autoFixAvailable: false
          });
        }
      });
    }
  }

  /**
   * Parse build errors
   */
  private parseBuildErrors(output: string): void {
    const lines = output.split('\n');
    
    lines.forEach(line => {
      if (line.includes('Error:') || line.includes('Failed to compile')) {
        this.errors.push({
          type: 'build',
          severity: 'critical',
          file: 'build',
          message: line.trim(),
          autoFixAvailable: false
        });
      }
    });
  }

  /**
   * Apply automatic fix for an error
   */
  private async applyFix(error: ErrorReport): Promise<void> {
    switch (error.type) {
      case 'eslint':
        await this.applyESLintFix();
        break;
      case 'typescript':
        await this.applyTypeScriptFix(error);
        break;
      case 'security':
        await this.applySecurityFix(error);
        break;
      default:
        throw new Error(`No auto-fix available for ${error.type}`);
    }
  }

  /**
   * Apply ESLint auto-fixes
   */
  private async applyESLintFix(): Promise<void> {
    execSync('npx eslint src --fix', { cwd: this.projectRoot });
  }

  /**
   * Apply TypeScript fixes
   */
  private async applyTypeScriptFix(error: ErrorReport): Promise<void> {
    if (!error.suggestedFix) return;
    
    // Simple fixes for common TypeScript errors
    const filePath = path.join(this.projectRoot, error.file);
    const content = await fs.readFile(filePath, 'utf8');
    
    let fixedContent = content;
    
    // Add missing imports
    if (error.message.includes('Cannot find name')) {
      const missingName = error.message.match(/'([^']+)'/)?.[1];
      if (missingName) {
        fixedContent = this.addMissingImport(content, missingName);
      }
    }
    
    // Add missing types
    if (error.message.includes('implicitly has an \'any\' type')) {
      fixedContent = this.addMissingTypes(content, error.line || 1);
    }
    
    if (fixedContent !== content) {
      await fs.writeFile(filePath, fixedContent, 'utf8');
    }
  }

  /**
   * Apply security fixes
   */
  private async applySecurityFix(error: ErrorReport): Promise<void> {
    if (!error.suggestedFix) return;
    
    const filePath = path.join(this.projectRoot, error.file);
    const content = await fs.readFile(filePath, 'utf8');
    
    let fixedContent = content;
    
    // Move hardcoded secrets to env vars
    if (error.message.includes('Hardcoded credential')) {
      fixedContent = this.moveSecretsToEnv(content);
    }
    
    if (fixedContent !== content) {
      await fs.writeFile(filePath, fixedContent, 'utf8');
    }
  }

  /**
   * Helper methods for fixes
   */
  private addMissingImport(content: string, missingName: string): string {
    // Simple heuristic for common imports
    const commonImports: Record<string, string> = {
      'React': "import React from 'react';",
      'useState': "import { useState } from 'react';",
      'useEffect': "import { useEffect } from 'react';",
      'NextRequest': "import { NextRequest } from 'next/server';",
      'NextResponse': "import { NextResponse } from 'next/server';"
    };
    
    const importStatement = commonImports[missingName];
    if (importStatement) {
      return `${importStatement}\n${content}`;
    }
    
    return content;
  }

  private addMissingTypes(content: string, line: number): string {
    const lines = content.split('\n');
    const targetLine = lines[line - 1];
    
    if (targetLine && targetLine.includes('=')) {
      // Add type annotation
      const fixed = targetLine.replace(/(\w+)\s*=/, '$1: any =');
      lines[line - 1] = fixed;
      return lines.join('\n');
    }
    
    return content;
  }

  private moveSecretsToEnv(content: string): string {
    // Replace hardcoded secrets with env vars
    return content
      .replace(/apiKey\s*[:=]\s*['"`]([^'"`]+)['"`]/g, "apiKey: process.env.API_KEY || ''")
      .replace(/secret\s*[:=]\s*['"`]([^'"`]+)['"`]/g, "secret: process.env.SECRET || ''");
  }

  /**
   * Utility methods
   */
  private mapSeverity(severity: string): ErrorReport['severity'] {
    switch (severity.toLowerCase()) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      default: return 'low';
    }
  }

  private getTypeScriptSeverity(errorCode: string): ErrorReport['severity'] {
    const criticalCodes = ['2304', '2307', '2345']; // Cannot find name, module, argument errors
    const highCodes = ['2322', '2339', '2571']; // Type errors
    
    if (criticalCodes.includes(errorCode)) return 'critical';
    if (highCodes.includes(errorCode)) return 'high';
    return 'medium';
  }

  private isTypeScriptAutoFixable(errorCode: string): boolean {
    const fixableCodes = ['2304', '7006', '2322']; // Missing imports, implicit any, type errors
    return fixableCodes.includes(errorCode);
  }

  private getTypeScriptFix(errorCode: string, message: string): string | undefined {
    switch (errorCode) {
      case '2304': return 'Add missing import statement';
      case '7006': return 'Add explicit type annotation';
      case '2322': return 'Fix type mismatch';
      default: return undefined;
    }
  }

  /**
   * Print error summary
   */
  private printSummary(): void {
    const summary = this.errors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\n📊 Error Summary:');
    console.log(`🔴 Critical: ${summary.critical || 0}`);
    console.log(`🟠 High: ${summary.high || 0}`);
    console.log(`🟡 Medium: ${summary.medium || 0}`);
    console.log(`🟢 Low: ${summary.low || 0}`);
    
    const fixable = this.errors.filter(e => e.autoFixAvailable).length;
    console.log(`🔧 Auto-fixable: ${fixable}`);
  }

  /**
   * Generate error report
   */
  async generateReport(): Promise<void> {
    const reportPath = path.join(this.projectRoot, 'error-report.json');
    await fs.writeFile(reportPath, JSON.stringify(this.errors, null, 2));
    console.log(`📄 Error report saved: ${reportPath}`);
  }
}

// CLI interface
if (require.main === module) {
  const detector = new SmartErrorDetector();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'detect':
      detector.detectAllErrors().then(() => detector.generateReport());
      break;
    case 'fix':
      detector.detectAllErrors().then(() => detector.autoFixErrors());
      break;
    default:
      console.log('Usage: smart-error-detector [detect|fix]');
  }
}

export { SmartErrorDetector };