/**
 * ESLint integration and custom rules for StoreSync patterns
 * Provides comprehensive linting with automated fix suggestions
 */

import { ESLint } from 'eslint';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  AnalysisError,
  AnalysisResult,
  AnalysisConfig,
  ErrorCategory,
  ErrorSeverity,
  ErrorSuggestion,
  AnalysisContext,
  FileAnalysisResult,
  AnalysisSummary,
  AnalysisMetrics
} from './types';

export class ESLintAnalyzer {
  private eslint: ESLint;
  private context: AnalysisContext;
  private config: AnalysisConfig;

  constructor(context: AnalysisContext, config: AnalysisConfig) {
    this.context = context;
    this.config = config;
    this.eslint = new ESLint({
      baseConfig: this.getESLintConfig(),
      useEslintrc: true,
      cwd: context.projectRoot,
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      fix: false // We'll handle fixes separately
    });
  }

  /**
   * Get ESLint configuration with custom rules
   */
  private getESLintConfig() {
    return {
      env: {
        browser: true,
        es2021: true,
        node: true,
      },
      extends: [
        'eslint:recommended',
        '@typescript-eslint/recommended',
        'next/core-web-vitals',
      ],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: this.context.tsConfigPath,
      },
      plugins: [
        '@typescript-eslint',
        'react',
        'react-hooks',
        'storesync-custom', // Our custom plugin
      ],
      rules: {
        // TypeScript specific rules
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-non-null-assertion': 'warn',
        '@typescript-eslint/prefer-const': 'error',
        '@typescript-eslint/no-var-requires': 'error',
        
        // Code quality rules
        'no-console': 'warn',
        'no-debugger': 'error',
        'no-alert': 'error',
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-new-func': 'error',
        'no-script-url': 'error',
        
        // React specific rules
        'react/jsx-uses-react': 'off', // Not needed in React 17+
        'react/react-in-jsx-scope': 'off', // Not needed in React 17+
        'react/prop-types': 'off', // Using TypeScript
        'react/display-name': 'warn',
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
        
        // Performance rules
        'no-unused-expressions': 'error',
        'no-unreachable': 'error',
        'no-constant-condition': 'error',
        
        // Security rules
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-new-func': 'error',
        'no-script-url': 'error',
        
        // Custom StoreSync rules
        'storesync-custom/no-hardcoded-credentials': 'error',
        'storesync-custom/require-error-handling': 'warn',
        'storesync-custom/consistent-naming': 'warn',
        'storesync-custom/no-direct-db-access': 'error',
        'storesync-custom/require-input-validation': 'warn',
      },
      settings: {
        react: {
          version: 'detect',
        },
      },
    };
  }

  /**
   * Analyze files using ESLint
   */
  async analyze(): Promise<AnalysisResult> {
    const startTime = Date.now();
    
    try {
      // Get files to analyze
      const filesToAnalyze = await this.getFilesToAnalyze();
      
      // Run ESLint analysis
      const results = await this.eslint.lintFiles(filesToAnalyze);
      
      // Convert ESLint results to our format
      const fileResults: FileAnalysisResult[] = [];
      const allErrors: AnalysisError[] = [];

      for (const result of results) {
        const fileResult = this.convertESLintResult(result);
        fileResults.push(fileResult);
        allErrors.push(...fileResult.errors);
      }

      // Generate summary and metrics
      const summary = this.generateSummary(fileResults, allErrors);
      const metrics = this.generateMetrics(fileResults);

      const analysisResult: AnalysisResult = {
        summary,
        errors: allErrors.filter(e => e.severity === ErrorSeverity.CRITICAL || e.severity === ErrorSeverity.HIGH),
        warnings: allErrors.filter(e => e.severity === ErrorSeverity.MEDIUM),
        suggestions: allErrors.filter(e => e.severity === ErrorSeverity.LOW || e.severity === ErrorSeverity.INFO),
        metrics,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };

      return analysisResult;
    } catch (error) {
      throw new Error(`ESLint analysis failed: ${error}`);
    }
  }

  /**
   * Get files to analyze based on configuration
   */
  private async getFilesToAnalyze(): Promise<string[]> {
    const files: string[] = [];
    
    for (const pattern of this.config.includePatterns) {
      const fullPattern = path.resolve(this.context.projectRoot, pattern);
      
      try {
        const stat = await fs.stat(fullPattern);
        if (stat.isFile()) {
          files.push(fullPattern);
        } else if (stat.isDirectory()) {
          // Add common file extensions for directories
          files.push(`${fullPattern}/**/*.{ts,tsx,js,jsx}`);
        }
      } catch {
        // Pattern might be a glob, add it as-is
        files.push(fullPattern);
      }
    }

    return files.length > 0 ? files : ['src/**/*.{ts,tsx,js,jsx}'];
  }

  /**
   * Convert ESLint result to our analysis format
   */
  private convertESLintResult(result: ESLint.LintResult): FileAnalysisResult {
    const errors: AnalysisError[] = result.messages.map(message => {
      const severity = this.mapESLintSeverity(message.severity);
      const category = this.categorizeESLintRule(message.ruleId || 'unknown');
      const suggestions = this.generateESLintSuggestions(message);

      return {
        id: `eslint-${message.ruleId}-${result.filePath}-${message.line}-${message.column}`,
        category,
        severity,
        message: message.message,
        file: result.filePath,
        line: message.line,
        column: message.column,
        endLine: message.endLine,
        endColumn: message.endColumn,
        code: message.ruleId || undefined,
        source: 'eslint',
        rule: message.ruleId || 'unknown',
        suggestions,
        relatedErrors: [],
        firstSeen: new Date(),
        lastSeen: new Date(),
        occurrenceCount: 1
      };
    });

    // Calculate basic file metrics
    const metrics = {
      linesOfCode: result.source?.split('\n').length || 0,
      complexity: this.estimateComplexityFromErrors(errors),
      maintainabilityIndex: this.calculateMaintainabilityFromErrors(errors)
    };

    return {
      file: result.filePath,
      errors,
      metrics,
      dependencies: [], // Would need AST analysis
      exports: [] // Would need AST analysis
    };
  }

  /**
   * Map ESLint severity to our severity levels
   */
  private mapESLintSeverity(severity: number): ErrorSeverity {
    switch (severity) {
      case 2: // Error
        return ErrorSeverity.HIGH;
      case 1: // Warning
        return ErrorSeverity.MEDIUM;
      default:
        return ErrorSeverity.LOW;
    }
  }

  /**
   * Categorize ESLint rules into our error categories
   */
  private categorizeESLintRule(ruleId: string): ErrorCategory {
    // Security-related rules
    if (ruleId.includes('security') || 
        ruleId.includes('no-eval') || 
        ruleId.includes('no-script-url') ||
        ruleId.includes('no-hardcoded-credentials')) {
      return ErrorCategory.SECURITY_VULNERABILITY;
    }

    // Performance-related rules
    if (ruleId.includes('performance') || 
        ruleId.includes('no-unused') ||
        ruleId.includes('prefer-const')) {
      return ErrorCategory.PERFORMANCE_ISSUE;
    }

    // Type-related rules
    if (ruleId.includes('@typescript-eslint') || 
        ruleId.includes('type')) {
      return ErrorCategory.TYPE_ERROR;
    }

    // Import-related rules
    if (ruleId.includes('import') || 
        ruleId.includes('require')) {
      return ErrorCategory.IMPORT_ERROR;
    }

    // Default to linting issue
    return ErrorCategory.LINTING_ISSUE;
  }

  /**
   * Generate fix suggestions for ESLint messages
   */
  private generateESLintSuggestions(message: ESLint.LintMessage): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [];
    const ruleId = message.ruleId || '';

    // Check if ESLint provides a fix
    if (message.fix) {
      suggestions.push({
        type: 'fix',
        description: 'Apply ESLint auto-fix',
        code: message.fix.text,
        confidence: 0.9,
        automated: true
      });
    }

    // Rule-specific suggestions
    switch (ruleId) {
      case 'no-unused-vars':
      case '@typescript-eslint/no-unused-vars':
        suggestions.push({
          type: 'fix',
          description: 'Remove unused variable or prefix with underscore',
          confidence: 0.8,
          automated: true
        });
        break;

      case 'no-console':
        suggestions.push({
          type: 'fix',
          description: 'Replace console.log with proper logging or remove',
          confidence: 0.7,
          automated: false
        });
        break;

      case '@typescript-eslint/no-explicit-any':
        suggestions.push({
          type: 'fix',
          description: 'Replace "any" with specific type definition',
          confidence: 0.6,
          automated: false
        });
        break;

      case 'react-hooks/exhaustive-deps':
        suggestions.push({
          type: 'fix',
          description: 'Add missing dependencies to useEffect dependency array',
          confidence: 0.8,
          automated: false
        });
        break;

      case 'storesync-custom/no-hardcoded-credentials':
        suggestions.push({
          type: 'fix',
          description: 'Move credentials to environment variables',
          confidence: 0.9,
          automated: false
        });
        break;

      case 'storesync-custom/require-error-handling':
        suggestions.push({
          type: 'fix',
          description: 'Add try-catch block or error handling',
          confidence: 0.7,
          automated: false
        });
        break;

      default:
        if (message.suggestions && message.suggestions.length > 0) {
          message.suggestions.forEach(suggestion => {
            suggestions.push({
              type: 'fix',
              description: suggestion.desc,
              code: suggestion.fix.text,
              confidence: 0.7,
              automated: true
            });
          });
        }
        break;
    }

    return suggestions;
  }

  /**
   * Estimate complexity from linting errors
   */
  private estimateComplexityFromErrors(errors: AnalysisError[]): number {
    // Simple heuristic: more errors = higher complexity
    const complexityIndicators = errors.filter(error => 
      error.rule?.includes('complexity') ||
      error.rule?.includes('max-depth') ||
      error.rule?.includes('max-lines')
    );
    
    return Math.max(1, complexityIndicators.length * 2);
  }

  /**
   * Calculate maintainability from errors
   */
  private calculateMaintainabilityFromErrors(errors: AnalysisError[]): number {
    // Start with perfect score and deduct for errors
    let score = 100;
    
    errors.forEach(error => {
      switch (error.severity) {
        case ErrorSeverity.CRITICAL:
          score -= 10;
          break;
        case ErrorSeverity.HIGH:
          score -= 5;
          break;
        case ErrorSeverity.MEDIUM:
          score -= 2;
          break;
        case ErrorSeverity.LOW:
          score -= 1;
          break;
      }
    });

    return Math.max(0, score);
  }

  /**
   * Generate analysis summary
   */
  private generateSummary(fileResults: FileAnalysisResult[], allErrors: AnalysisError[]): AnalysisSummary {
    const totalFiles = fileResults.length;
    const analyzedFiles = fileResults.filter(r => r.errors.length >= 0).length;
    const skippedFiles = totalFiles - analyzedFiles;

    const severityCounts = allErrors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<ErrorSeverity, number>);

    return {
      totalFiles,
      analyzedFiles,
      skippedFiles,
      totalIssues: allErrors.length,
      criticalIssues: severityCounts[ErrorSeverity.CRITICAL] || 0,
      highIssues: severityCounts[ErrorSeverity.HIGH] || 0,
      mediumIssues: severityCounts[ErrorSeverity.MEDIUM] || 0,
      lowIssues: severityCounts[ErrorSeverity.LOW] || 0,
      infoIssues: severityCounts[ErrorSeverity.INFO] || 0
    };
  }

  /**
   * Generate analysis metrics
   */
  private generateMetrics(fileResults: FileAnalysisResult[]): AnalysisMetrics {
    const totalLinesOfCode = fileResults.reduce((sum, result) => sum + result.metrics.linesOfCode, 0);
    const avgComplexity = fileResults.reduce((sum, result) => sum + result.metrics.complexity, 0) / fileResults.length;
    const avgMaintainability = fileResults.reduce((sum, result) => sum + result.metrics.maintainabilityIndex, 0) / fileResults.length;

    return {
      linesOfCode: totalLinesOfCode,
      typesCoverage: 0, // Not applicable for ESLint
      complexityScore: avgComplexity,
      maintainabilityIndex: avgMaintainability,
      technicalDebt: {
        totalMinutes: Math.round(avgComplexity * 2),
        codeSmells: fileResults.filter(r => r.metrics.maintainabilityIndex < 70).length,
        duplicatedLines: 0,
        cyclomaticComplexity: Math.round(avgComplexity),
        cognitiveComplexity: Math.round(avgComplexity * 1.2)
      }
    };
  }

  /**
   * Get available auto-fixes for a file
   */
  async getAutoFixes(filePath: string): Promise<string | null> {
    try {
      const results = await this.eslint.lintFiles([filePath]);
      if (results.length > 0) {
        const output = await ESLint.outputFixes(results);
        return output;
      }
      return null;
    } catch (error) {
      throw new Error(`Failed to get auto-fixes: ${error}`);
    }
  }

  /**
   * Apply auto-fixes to files
   */
  async applyAutoFixes(filePaths: string[]): Promise<void> {
    try {
      const results = await this.eslint.lintFiles(filePaths);
      await ESLint.outputFixes(results);
    } catch (error) {
      throw new Error(`Failed to apply auto-fixes: ${error}`);
    }
  }
}