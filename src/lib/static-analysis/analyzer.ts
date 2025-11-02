/**
 * Main static analysis orchestrator
 * Combines TypeScript, ESLint, and Security analyzers
 */

import * as path from 'path';
import { TypeScriptAnalyzer } from './typescript-analyzer';
import { ESLintAnalyzer } from './eslint-analyzer';
import { SecurityScanner } from './security-scanner';
import {
  AnalysisResult,
  AnalysisConfig,
  AnalysisContext,
  AnalysisError,
  ErrorSeverity,
  ErrorCategory,
  AnalysisSummary,
  AnalysisMetrics,
  FileAnalysisResult
} from './types';

export interface StaticAnalysisOptions {
  enableTypeScript?: boolean;
  enableESLint?: boolean;
  enableSecurity?: boolean;
  parallel?: boolean;
  maxErrors?: number;
  timeout?: number;
}

export class StaticAnalyzer {
  private context: AnalysisContext;
  private config: AnalysisConfig;
  private options: StaticAnalysisOptions;

  constructor(
    projectRoot: string,
    options: StaticAnalysisOptions = {}
  ) {
    this.options = {
      enableTypeScript: true,
      enableESLint: true,
      enableSecurity: true,
      parallel: true,
      maxErrors: 1000,
      timeout: 300000, // 5 minutes
      ...options
    };

    this.context = {
      projectRoot: path.resolve(projectRoot),
      tsConfigPath: 'tsconfig.json',
      eslintConfigPath: 'eslint.config.mjs',
      packageJsonPath: 'package.json',
      gitIgnorePath: '.gitignore'
    };

    this.config = {
      includePatterns: [
        'src/**/*.ts',
        'src/**/*.tsx',
        'src/**/*.js',
        'src/**/*.jsx',
        'package.json',
        '.env*'
      ],
      excludePatterns: [
        'node_modules',
        '.next',
        'dist',
        'build',
        'coverage',
        '*.test.ts',
        '*.test.tsx',
        '*.spec.ts',
        '*.spec.tsx',
        '__tests__'
      ],
      enabledAnalyzers: [
        ...(this.options.enableTypeScript ? ['typescript'] : []),
        ...(this.options.enableESLint ? ['eslint'] : []),
        ...(this.options.enableSecurity ? ['security'] : [])
      ],
      severityThresholds: {
        [ErrorCategory.SYNTAX_ERROR]: ErrorSeverity.HIGH,
        [ErrorCategory.TYPE_ERROR]: ErrorSeverity.HIGH,
        [ErrorCategory.LOGIC_ERROR]: ErrorSeverity.MEDIUM,
        [ErrorCategory.SECURITY_VULNERABILITY]: ErrorSeverity.CRITICAL,
        [ErrorCategory.PERFORMANCE_ISSUE]: ErrorSeverity.MEDIUM,
        [ErrorCategory.COMPLIANCE_VIOLATION]: ErrorSeverity.MEDIUM,
        [ErrorCategory.LINTING_ISSUE]: ErrorSeverity.LOW,
        [ErrorCategory.IMPORT_ERROR]: ErrorSeverity.HIGH
      },
      maxErrors: this.options.maxErrors || 1000,
      timeout: this.options.timeout || 300000,
      parallel: this.options.parallel !== false
    };
  }

  /**
   * Run comprehensive static analysis
   */
  async analyze(): Promise<AnalysisResult> {
    const startTime = Date.now();
    
    try {
      console.log('Starting static analysis...');
      
      const results: AnalysisResult[] = [];
      
      if (this.options.parallel) {
        // Run analyzers in parallel
        const promises: Promise<AnalysisResult>[] = [];
        
        if (this.options.enableTypeScript) {
          console.log('Running TypeScript analysis...');
          const tsAnalyzer = new TypeScriptAnalyzer(this.context, this.config);
          promises.push(tsAnalyzer.analyze());
        }
        
        if (this.options.enableESLint) {
          console.log('Running ESLint analysis...');
          const eslintAnalyzer = new ESLintAnalyzer(this.context, this.config);
          promises.push(eslintAnalyzer.analyze());
        }
        
        if (this.options.enableSecurity) {
          console.log('Running security analysis...');
          const securityScanner = new SecurityScanner(this.context, this.config);
          promises.push(securityScanner.analyze());
        }
        
        const parallelResults = await Promise.allSettled(promises);
        
        parallelResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.error(`Analyzer ${index} failed:`, result.reason);
          }
        });
      } else {
        // Run analyzers sequentially
        if (this.options.enableTypeScript) {
          console.log('Running TypeScript analysis...');
          try {
            const tsAnalyzer = new TypeScriptAnalyzer(this.context, this.config);
            const tsResult = await tsAnalyzer.analyze();
            results.push(tsResult);
          } catch (error) {
            console.error('TypeScript analysis failed:', error);
          }
        }
        
        if (this.options.enableESLint) {
          console.log('Running ESLint analysis...');
          try {
            const eslintAnalyzer = new ESLintAnalyzer(this.context, this.config);
            const eslintResult = await eslintAnalyzer.analyze();
            results.push(eslintResult);
          } catch (error) {
            console.error('ESLint analysis failed:', error);
          }
        }
        
        if (this.options.enableSecurity) {
          console.log('Running security analysis...');
          try {
            const securityScanner = new SecurityScanner(this.context, this.config);
            const securityResult = await securityScanner.analyze();
            results.push(securityResult);
          } catch (error) {
            console.error('Security analysis failed:', error);
          }
        }
      }
      
      // Combine results
      const combinedResult = this.combineResults(results);
      combinedResult.duration = Date.now() - startTime;
      
      console.log(`Static analysis completed in ${combinedResult.duration}ms`);
      console.log(`Found ${combinedResult.summary.totalIssues} issues across ${combinedResult.summary.analyzedFiles} files`);
      
      return combinedResult;
    } catch (error) {
      throw new Error(`Static analysis failed: ${error}`);
    }
  }

  /**
   * Combine results from multiple analyzers
   */
  private combineResults(results: AnalysisResult[]): AnalysisResult {
    if (results.length === 0) {
      return this.createEmptyResult();
    }
    
    if (results.length === 1) {
      return results[0];
    }
    
    // Combine all errors
    const allErrors: AnalysisError[] = [];
    const allWarnings: AnalysisError[] = [];
    const allSuggestions: AnalysisError[] = [];
    
    results.forEach(result => {
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
      allSuggestions.push(...result.suggestions);
    });
    
    // Remove duplicates based on file, line, column, and message
    const uniqueErrors = this.deduplicateErrors(allErrors);
    const uniqueWarnings = this.deduplicateErrors(allWarnings);
    const uniqueSuggestions = this.deduplicateErrors(allSuggestions);
    
    // Limit errors if configured
    const limitedErrors = uniqueErrors.slice(0, this.config.maxErrors);
    const limitedWarnings = uniqueWarnings.slice(0, this.config.maxErrors);
    const limitedSuggestions = uniqueSuggestions.slice(0, this.config.maxErrors);
    
    // Combine summaries
    const summary = this.combineSummaries(results.map(r => r.summary));
    
    // Combine metrics
    const metrics = this.combineMetrics(results.map(r => r.metrics));
    
    return {
      summary,
      errors: limitedErrors,
      warnings: limitedWarnings,
      suggestions: limitedSuggestions,
      metrics,
      timestamp: new Date(),
      duration: Math.max(...results.map(r => r.duration))
    };
  }

  /**
   * Remove duplicate errors
   */
  private deduplicateErrors(errors: AnalysisError[]): AnalysisError[] {
    const seen = new Set<string>();
    const unique: AnalysisError[] = [];
    
    errors.forEach(error => {
      const key = `${error.file}:${error.line}:${error.column}:${error.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(error);
      }
    });
    
    return unique;
  }

  /**
   * Combine summaries from multiple results
   */
  private combineSummaries(summaries: AnalysisSummary[]): AnalysisSummary {
    return {
      totalFiles: Math.max(...summaries.map(s => s.totalFiles)),
      analyzedFiles: Math.max(...summaries.map(s => s.analyzedFiles)),
      skippedFiles: Math.max(...summaries.map(s => s.skippedFiles)),
      totalIssues: summaries.reduce((sum, s) => sum + s.totalIssues, 0),
      criticalIssues: summaries.reduce((sum, s) => sum + s.criticalIssues, 0),
      highIssues: summaries.reduce((sum, s) => sum + s.highIssues, 0),
      mediumIssues: summaries.reduce((sum, s) => sum + s.mediumIssues, 0),
      lowIssues: summaries.reduce((sum, s) => sum + s.lowIssues, 0),
      infoIssues: summaries.reduce((sum, s) => sum + s.infoIssues, 0)
    };
  }

  /**
   * Combine metrics from multiple results
   */
  private combineMetrics(metrics: AnalysisMetrics[]): AnalysisMetrics {
    const totalLinesOfCode = Math.max(...metrics.map(m => m.linesOfCode));
    const avgTypesCoverage = metrics.reduce((sum, m) => sum + m.typesCoverage, 0) / metrics.length;
    const avgComplexity = metrics.reduce((sum, m) => sum + m.complexityScore, 0) / metrics.length;
    const avgMaintainability = metrics.reduce((sum, m) => sum + m.maintainabilityIndex, 0) / metrics.length;
    
    return {
      linesOfCode: totalLinesOfCode,
      typesCoverage: avgTypesCoverage,
      complexityScore: avgComplexity,
      maintainabilityIndex: avgMaintainability,
      technicalDebt: {
        totalMinutes: metrics.reduce((sum, m) => sum + m.technicalDebt.totalMinutes, 0),
        codeSmells: metrics.reduce((sum, m) => sum + m.technicalDebt.codeSmells, 0),
        duplicatedLines: metrics.reduce((sum, m) => sum + m.technicalDebt.duplicatedLines, 0),
        cyclomaticComplexity: Math.max(...metrics.map(m => m.technicalDebt.cyclomaticComplexity)),
        cognitiveComplexity: Math.max(...metrics.map(m => m.technicalDebt.cognitiveComplexity))
      }
    };
  }

  /**
   * Create empty result for when no analyzers run
   */
  private createEmptyResult(): AnalysisResult {
    return {
      summary: {
        totalFiles: 0,
        analyzedFiles: 0,
        skippedFiles: 0,
        totalIssues: 0,
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0,
        infoIssues: 0
      },
      errors: [],
      warnings: [],
      suggestions: [],
      metrics: {
        linesOfCode: 0,
        typesCoverage: 0,
        complexityScore: 0,
        maintainabilityIndex: 100,
        technicalDebt: {
          totalMinutes: 0,
          codeSmells: 0,
          duplicatedLines: 0,
          cyclomaticComplexity: 0,
          cognitiveComplexity: 0
        }
      },
      timestamp: new Date(),
      duration: 0
    };
  }

  /**
   * Generate analysis report
   */
  generateReport(result: AnalysisResult, format: 'json' | 'html' | 'markdown' = 'json'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(result, null, 2);
      
      case 'markdown':
        return this.generateMarkdownReport(result);
      
      case 'html':
        return this.generateHtmlReport(result);
      
      default:
        return JSON.stringify(result, null, 2);
    }
  }

  /**
   * Generate markdown report
   */
  private generateMarkdownReport(result: AnalysisResult): string {
    const { summary, errors, warnings, suggestions, metrics } = result;
    
    return `# Static Analysis Report

## Summary
- **Total Files**: ${summary.totalFiles}
- **Analyzed Files**: ${summary.analyzedFiles}
- **Total Issues**: ${summary.totalIssues}
- **Critical Issues**: ${summary.criticalIssues}
- **High Issues**: ${summary.highIssues}
- **Medium Issues**: ${summary.mediumIssues}
- **Low Issues**: ${summary.lowIssues}

## Metrics
- **Lines of Code**: ${metrics.linesOfCode}
- **Types Coverage**: ${metrics.typesCoverage.toFixed(1)}%
- **Complexity Score**: ${metrics.complexityScore.toFixed(1)}
- **Maintainability Index**: ${metrics.maintainabilityIndex.toFixed(1)}
- **Technical Debt**: ${metrics.technicalDebt.totalMinutes} minutes

## Critical & High Issues
${errors.map(error => `
### ${error.file}:${error.line}:${error.column}
**${error.severity.toUpperCase()}**: ${error.message}
- **Category**: ${error.category}
- **Rule**: ${error.rule}
${error.suggestions.length > 0 ? `- **Suggestions**: ${error.suggestions.map(s => s.description).join(', ')}` : ''}
`).join('\n')}

## Warnings
${warnings.slice(0, 10).map(warning => `
- **${warning.file}:${warning.line}**: ${warning.message}
`).join('\n')}
${warnings.length > 10 ? `\n... and ${warnings.length - 10} more warnings` : ''}

## Analysis completed in ${result.duration}ms
`;
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(result: AnalysisResult): string {
    const { summary, errors, warnings, suggestions, metrics } = result;
    
    return `<!DOCTYPE html>
<html>
<head>
    <title>Static Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; }
        .error { background: #ffebee; padding: 10px; margin: 10px 0; border-left: 4px solid #f44336; }
        .warning { background: #fff3e0; padding: 10px; margin: 10px 0; border-left: 4px solid #ff9800; }
        .suggestion { background: #e8f5e8; padding: 10px; margin: 10px 0; border-left: 4px solid #4caf50; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #e3f2fd; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Static Analysis Report</h1>
    
    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Total Files:</strong> ${summary.totalFiles}</p>
        <p><strong>Analyzed Files:</strong> ${summary.analyzedFiles}</p>
        <p><strong>Total Issues:</strong> ${summary.totalIssues}</p>
        <p><strong>Critical Issues:</strong> ${summary.criticalIssues}</p>
        <p><strong>High Issues:</strong> ${summary.highIssues}</p>
        <p><strong>Medium Issues:</strong> ${summary.mediumIssues}</p>
        <p><strong>Low Issues:</strong> ${summary.lowIssues}</p>
    </div>
    
    <h2>Metrics</h2>
    <div class="metric"><strong>Lines of Code:</strong> ${metrics.linesOfCode}</div>
    <div class="metric"><strong>Types Coverage:</strong> ${metrics.typesCoverage.toFixed(1)}%</div>
    <div class="metric"><strong>Complexity:</strong> ${metrics.complexityScore.toFixed(1)}</div>
    <div class="metric"><strong>Maintainability:</strong> ${metrics.maintainabilityIndex.toFixed(1)}</div>
    <div class="metric"><strong>Technical Debt:</strong> ${metrics.technicalDebt.totalMinutes} min</div>
    
    <h2>Critical & High Issues</h2>
    ${errors.map(error => `
    <div class="error">
        <h3>${error.file}:${error.line}:${error.column}</h3>
        <p><strong>${error.severity.toUpperCase()}:</strong> ${error.message}</p>
        <p><strong>Category:</strong> ${error.category}</p>
        <p><strong>Rule:</strong> ${error.rule}</p>
        ${error.suggestions.length > 0 ? `<p><strong>Suggestions:</strong> ${error.suggestions.map(s => s.description).join(', ')}</p>` : ''}
    </div>
    `).join('')}
    
    <h2>Warnings</h2>
    ${warnings.slice(0, 20).map(warning => `
    <div class="warning">
        <p><strong>${warning.file}:${warning.line}:</strong> ${warning.message}</p>
    </div>
    `).join('')}
    
    <p><em>Analysis completed in ${result.duration}ms</em></p>
</body>
</html>`;
  }
}