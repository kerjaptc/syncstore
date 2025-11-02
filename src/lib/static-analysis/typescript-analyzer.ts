/**
 * TypeScript error scanner and analyzer
 * Integrates with TypeScript compiler API for comprehensive error detection
 */

import * as ts from 'typescript';
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
  AnalysisMetrics,
  TechnicalDebtMetrics
} from './types';

export class TypeScriptAnalyzer {
  private program: ts.Program | null = null;
  private typeChecker: ts.TypeChecker | null = null;
  private context: AnalysisContext;
  private config: AnalysisConfig;

  constructor(context: AnalysisContext, config: AnalysisConfig) {
    this.context = context;
    this.config = config;
  }

  /**
   * Initialize TypeScript program and type checker
   */
  private async initializeProgram(): Promise<void> {
    try {
      // Read TypeScript configuration
      const tsConfigPath = path.resolve(this.context.projectRoot, this.context.tsConfigPath);
      const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
      
      if (configFile.error) {
        throw new Error(`Failed to read tsconfig.json: ${configFile.error.messageText}`);
      }

      const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(tsConfigPath)
      );

      if (parsedConfig.errors.length > 0) {
        const errors = parsedConfig.errors.map(err => err.messageText).join(', ');
        throw new Error(`TypeScript config errors: ${errors}`);
      }

      // Create program
      this.program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
      this.typeChecker = this.program.getTypeChecker();
    } catch (error) {
      throw new Error(`Failed to initialize TypeScript program: ${error}`);
    }
  }

  /**
   * Analyze TypeScript files for errors and issues
   */
  async analyze(): Promise<AnalysisResult> {
    const startTime = Date.now();
    
    try {
      await this.initializeProgram();
      
      if (!this.program) {
        throw new Error('TypeScript program not initialized');
      }

      const sourceFiles = this.program.getSourceFiles()
        .filter(file => this.shouldAnalyzeFile(file.fileName));

      const fileResults: FileAnalysisResult[] = [];
      const allErrors: AnalysisError[] = [];

      // Analyze each file
      for (const sourceFile of sourceFiles) {
        if (this.config.parallel) {
          // For now, analyze sequentially. Could be parallelized later
          const result = await this.analyzeFile(sourceFile);
          fileResults.push(result);
          allErrors.push(...result.errors);
        } else {
          const result = await this.analyzeFile(sourceFile);
          fileResults.push(result);
          allErrors.push(...result.errors);
        }
      }

      // Generate summary and metrics
      const summary = this.generateSummary(fileResults, allErrors);
      const metrics = this.generateMetrics(fileResults);

      const result: AnalysisResult = {
        summary,
        errors: allErrors.filter(e => e.severity === ErrorSeverity.CRITICAL || e.severity === ErrorSeverity.HIGH),
        warnings: allErrors.filter(e => e.severity === ErrorSeverity.MEDIUM),
        suggestions: allErrors.filter(e => e.severity === ErrorSeverity.LOW || e.severity === ErrorSeverity.INFO),
        metrics,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };

      return result;
    } catch (error) {
      throw new Error(`TypeScript analysis failed: ${error}`);
    }
  }

  /**
   * Analyze a single TypeScript file
   */
  private async analyzeFile(sourceFile: ts.SourceFile): Promise<FileAnalysisResult> {
    const errors: AnalysisError[] = [];
    
    if (!this.program || !this.typeChecker) {
      throw new Error('TypeScript program not initialized');
    }

    // Get semantic diagnostics (type errors)
    const semanticDiagnostics = this.program.getSemanticDiagnostics(sourceFile);
    errors.push(...this.convertDiagnosticsToErrors(semanticDiagnostics, 'semantic'));

    // Get syntactic diagnostics (syntax errors)
    const syntacticDiagnostics = this.program.getSyntacticDiagnostics(sourceFile);
    errors.push(...this.convertDiagnosticsToErrors(syntacticDiagnostics, 'syntactic'));

    // Analyze code complexity and patterns
    const complexityErrors = this.analyzeComplexity(sourceFile);
    errors.push(...complexityErrors);

    // Analyze imports and dependencies
    const importErrors = this.analyzeImports(sourceFile);
    errors.push(...importErrors);

    // Calculate file metrics
    const metrics = this.calculateFileMetrics(sourceFile);

    // Extract dependencies and exports
    const dependencies = this.extractDependencies(sourceFile);
    const exports = this.extractExports(sourceFile);

    return {
      file: sourceFile.fileName,
      errors,
      metrics,
      dependencies,
      exports
    };
  }

  /**
   * Convert TypeScript diagnostics to analysis errors
   */
  private convertDiagnosticsToErrors(
    diagnostics: readonly ts.Diagnostic[], 
    type: 'semantic' | 'syntactic'
  ): AnalysisError[] {
    return diagnostics.map(diagnostic => {
      const file = diagnostic.file?.fileName || 'unknown';
      const start = diagnostic.start || 0;
      const length = diagnostic.length || 0;
      
      let line: number | undefined;
      let column: number | undefined;
      let endLine: number | undefined;
      let endColumn: number | undefined;

      if (diagnostic.file) {
        const startPos = diagnostic.file.getLineAndCharacterOfPosition(start);
        const endPos = diagnostic.file.getLineAndCharacterOfPosition(start + length);
        
        line = startPos.line + 1;
        column = startPos.character + 1;
        endLine = endPos.line + 1;
        endColumn = endPos.character + 1;
      }

      const message = typeof diagnostic.messageText === 'string' 
        ? diagnostic.messageText 
        : diagnostic.messageText.messageText;

      const severity = this.mapDiagnosticSeverity(diagnostic.category);
      const category = type === 'syntactic' ? ErrorCategory.SYNTAX_ERROR : ErrorCategory.TYPE_ERROR;

      const suggestions = this.generateSuggestions(diagnostic, type);

      return {
        id: `ts-${diagnostic.code}-${file}-${line}-${column}`,
        category,
        severity,
        message,
        file,
        line,
        column,
        endLine,
        endColumn,
        code: diagnostic.code?.toString(),
        source: 'typescript',
        rule: `TS${diagnostic.code}`,
        suggestions,
        relatedErrors: [],
        firstSeen: new Date(),
        lastSeen: new Date(),
        occurrenceCount: 1
      };
    });
  }

  /**
   * Map TypeScript diagnostic category to error severity
   */
  private mapDiagnosticSeverity(category: ts.DiagnosticCategory): ErrorSeverity {
    switch (category) {
      case ts.DiagnosticCategory.Error:
        return ErrorSeverity.HIGH;
      case ts.DiagnosticCategory.Warning:
        return ErrorSeverity.MEDIUM;
      case ts.DiagnosticCategory.Suggestion:
        return ErrorSeverity.LOW;
      case ts.DiagnosticCategory.Message:
        return ErrorSeverity.INFO;
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * Generate fix suggestions for TypeScript diagnostics
   */
  private generateSuggestions(diagnostic: ts.Diagnostic, type: string): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [];
    
    // Common TypeScript error patterns and their fixes
    const code = diagnostic.code;
    const message = typeof diagnostic.messageText === 'string' 
      ? diagnostic.messageText 
      : diagnostic.messageText.messageText;

    // Type assertion suggestions
    if (code === 2322 || code === 2339) { // Type assignment or property errors
      suggestions.push({
        type: 'fix',
        description: 'Add type assertion or update type definition',
        confidence: 0.7,
        automated: false
      });
    }

    // Import suggestions
    if (code === 2307 || code === 2304) { // Cannot find module or name
      suggestions.push({
        type: 'fix',
        description: 'Check import path or install missing dependency',
        confidence: 0.8,
        automated: false
      });
    }

    // Unused variable suggestions
    if (code === 6133) { // Unused variable
      suggestions.push({
        type: 'fix',
        description: 'Remove unused variable or prefix with underscore',
        confidence: 0.9,
        automated: true
      });
    }

    return suggestions;
  }

  /**
   * Analyze code complexity and patterns
   */
  private analyzeComplexity(sourceFile: ts.SourceFile): AnalysisError[] {
    const errors: AnalysisError[] = [];
    
    const visit = (node: ts.Node) => {
      // Check for overly complex functions
      if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node)) {
        const complexity = this.calculateCyclomaticComplexity(node);
        if (complexity > 10) {
          const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          errors.push({
            id: `complexity-${sourceFile.fileName}-${start.line}-${start.character}`,
            category: ErrorCategory.PERFORMANCE_ISSUE,
            severity: complexity > 20 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
            message: `Function has high cyclomatic complexity (${complexity}). Consider refactoring.`,
            file: sourceFile.fileName,
            line: start.line + 1,
            column: start.character + 1,
            source: 'typescript',
            rule: 'complexity',
            suggestions: [{
              type: 'refactor',
              description: 'Break down function into smaller, more focused functions',
              confidence: 0.8,
              automated: false
            }],
            relatedErrors: [],
            firstSeen: new Date(),
            lastSeen: new Date(),
            occurrenceCount: 1
          });
        }
      }

      // Check for deeply nested code
      const depth = this.calculateNestingDepth(node);
      if (depth > 4) {
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        errors.push({
          id: `nesting-${sourceFile.fileName}-${start.line}-${start.character}`,
          category: ErrorCategory.LOGIC_ERROR,
          severity: ErrorSeverity.MEDIUM,
          message: `Code is deeply nested (depth: ${depth}). Consider refactoring.`,
          file: sourceFile.fileName,
          line: start.line + 1,
          column: start.character + 1,
          source: 'typescript',
          rule: 'max-depth',
          suggestions: [{
            type: 'refactor',
            description: 'Extract nested logic into separate functions or use early returns',
            confidence: 0.7,
            automated: false
          }],
          relatedErrors: [],
          firstSeen: new Date(),
          lastSeen: new Date(),
          occurrenceCount: 1
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return errors;
  }

  /**
   * Calculate cyclomatic complexity of a function
   */
  private calculateCyclomaticComplexity(node: ts.Node): number {
    let complexity = 1; // Base complexity

    const visit = (child: ts.Node) => {
      // Decision points that increase complexity
      if (ts.isIfStatement(child) ||
          ts.isWhileStatement(child) ||
          ts.isForStatement(child) ||
          ts.isForInStatement(child) ||
          ts.isForOfStatement(child) ||
          ts.isDoStatement(child) ||
          ts.isSwitchStatement(child) ||
          ts.isConditionalExpression(child) ||
          ts.isCatchClause(child)) {
        complexity++;
      }

      // Case statements in switch
      if (ts.isCaseClause(child)) {
        complexity++;
      }

      // Logical operators
      if (ts.isBinaryExpression(child) && 
          (child.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
           child.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
        complexity++;
      }

      ts.forEachChild(child, visit);
    };

    ts.forEachChild(node, visit);
    return complexity;
  }

  /**
   * Calculate nesting depth of a node
   */
  private calculateNestingDepth(node: ts.Node): number {
    let maxDepth = 0;
    let currentDepth = 0;

    const visit = (child: ts.Node) => {
      if (ts.isBlock(child) || 
          ts.isIfStatement(child) ||
          ts.isWhileStatement(child) ||
          ts.isForStatement(child) ||
          ts.isForInStatement(child) ||
          ts.isForOfStatement(child) ||
          ts.isDoStatement(child) ||
          ts.isTryStatement(child)) {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      }

      ts.forEachChild(child, visit);

      if (ts.isBlock(child) || 
          ts.isIfStatement(child) ||
          ts.isWhileStatement(child) ||
          ts.isForStatement(child) ||
          ts.isForInStatement(child) ||
          ts.isForOfStatement(child) ||
          ts.isDoStatement(child) ||
          ts.isTryStatement(child)) {
        currentDepth--;
      }
    };

    visit(node);
    return maxDepth;
  }

  /**
   * Analyze imports and dependencies
   */
  private analyzeImports(sourceFile: ts.SourceFile): AnalysisError[] {
    const errors: AnalysisError[] = [];
    const imports = new Set<string>();

    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const moduleName = node.moduleSpecifier.text;
        
        // Check for duplicate imports
        if (imports.has(moduleName)) {
          const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          errors.push({
            id: `duplicate-import-${sourceFile.fileName}-${start.line}-${start.character}`,
            category: ErrorCategory.LOGIC_ERROR,
            severity: ErrorSeverity.LOW,
            message: `Duplicate import of module '${moduleName}'`,
            file: sourceFile.fileName,
            line: start.line + 1,
            column: start.character + 1,
            source: 'typescript',
            rule: 'no-duplicate-imports',
            suggestions: [{
              type: 'fix',
              description: 'Combine imports from the same module',
              confidence: 0.9,
              automated: true
            }],
            relatedErrors: [],
            firstSeen: new Date(),
            lastSeen: new Date(),
            occurrenceCount: 1
          });
        }
        
        imports.add(moduleName);

        // Check for unused imports (simplified check)
        if (node.importClause && node.importClause.namedBindings && 
            ts.isNamedImports(node.importClause.namedBindings)) {
          // This would require more sophisticated analysis to determine actual usage
          // For now, we'll skip this check
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return errors;
  }

  /**
   * Calculate metrics for a file
   */
  private calculateFileMetrics(sourceFile: ts.SourceFile) {
    const text = sourceFile.getFullText();
    const lines = text.split('\n');
    const linesOfCode = lines.filter(line => line.trim() && !line.trim().startsWith('//')).length;
    
    let complexity = 0;
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node)) {
        complexity += this.calculateCyclomaticComplexity(node);
      }
      ts.forEachChild(node, visit);
    };
    
    visit(sourceFile);

    // Simple maintainability index calculation
    const maintainabilityIndex = Math.max(0, 171 - 5.2 * Math.log(linesOfCode) - 0.23 * complexity);

    return {
      linesOfCode,
      complexity,
      maintainabilityIndex
    };
  }

  /**
   * Extract dependencies from a file
   */
  private extractDependencies(sourceFile: ts.SourceFile): string[] {
    const dependencies: string[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        dependencies.push(node.moduleSpecifier.text);
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return dependencies;
  }

  /**
   * Extract exports from a file
   */
  private extractExports(sourceFile: ts.SourceFile): string[] {
    const exports: string[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
        // Simplified export extraction
        exports.push('export');
      } else if (ts.isFunctionDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        if (node.name) {
          exports.push(node.name.text);
        }
      } else if (ts.isVariableStatement(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        node.declarationList.declarations.forEach(decl => {
          if (ts.isIdentifier(decl.name)) {
            exports.push(decl.name.text);
          }
        });
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return exports;
  }

  /**
   * Check if file should be analyzed
   */
  private shouldAnalyzeFile(fileName: string): boolean {
    const relativePath = path.relative(this.context.projectRoot, fileName);
    
    // Check include patterns
    const included = this.config.includePatterns.some(pattern => 
      relativePath.includes(pattern) || fileName.endsWith(pattern)
    );
    
    // Check exclude patterns
    const excluded = this.config.excludePatterns.some(pattern => 
      relativePath.includes(pattern) || fileName.includes(pattern)
    );

    return included && !excluded && !fileName.includes('node_modules');
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

    const technicalDebt: TechnicalDebtMetrics = {
      totalMinutes: Math.round(avgComplexity * 2), // Simplified calculation
      codeSmells: fileResults.filter(r => r.metrics.maintainabilityIndex < 50).length,
      duplicatedLines: 0, // Would need more sophisticated analysis
      cyclomaticComplexity: Math.round(avgComplexity),
      cognitiveComplexity: Math.round(avgComplexity * 1.2)
    };

    return {
      linesOfCode: totalLinesOfCode,
      typesCoverage: 85, // Would need actual type coverage analysis
      complexityScore: avgComplexity,
      maintainabilityIndex: avgMaintainability,
      technicalDebt
    };
  }
}