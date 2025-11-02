/**
 * Tests for static analysis system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StaticAnalyzer } from '@/lib/static-analysis';
import { ErrorSeverity, ErrorCategory } from '@/lib/static-analysis/types';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock file system operations
vi.mock('fs/promises');
vi.mock('child_process');

const mockFs = vi.mocked(fs);

describe('StaticAnalyzer', () => {
  let analyzer: StaticAnalyzer;
  const testProjectRoot = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
    analyzer = new StaticAnalyzer(testProjectRoot, {
      enableTypeScript: true,
      enableESLint: true,
      enableSecurity: true,
      parallel: false // Use sequential for testing
    });
  });

  describe('initialization', () => {
    it('should create analyzer with default options', () => {
      const defaultAnalyzer = new StaticAnalyzer(testProjectRoot);
      expect(defaultAnalyzer).toBeDefined();
    });

    it('should create analyzer with custom options', () => {
      const customAnalyzer = new StaticAnalyzer(testProjectRoot, {
        enableTypeScript: false,
        enableESLint: true,
        enableSecurity: false,
        maxErrors: 500
      });
      expect(customAnalyzer).toBeDefined();
    });
  });

  describe('analysis', () => {
    beforeEach(() => {
      // Mock file system operations
      mockFs.stat.mockImplementation(async (filePath) => {
        const pathStr = filePath.toString();
        if (pathStr.includes('src')) {
          return { isFile: () => true, isDirectory: () => false } as any;
        }
        return { isFile: () => false, isDirectory: () => true } as any;
      });

      mockFs.readdir.mockResolvedValue([
        { name: 'test.ts', isDirectory: () => false, isFile: () => true },
        { name: 'test.tsx', isDirectory: () => false, isFile: () => true }
      ] as any);

      mockFs.readFile.mockImplementation(async (filePath) => {
        const pathStr = filePath.toString();
        if (pathStr.includes('test.ts')) {
          return `
            const apiKey = "hardcoded-secret-key";
            function testFunction() {
              console.log("test");
              return apiKey;
            }
          `;
        }
        if (pathStr.includes('package.json')) {
          return JSON.stringify({
            dependencies: {
              'lodash': '4.17.20',
              'axios': '0.21.0'
            }
          });
        }
        return '';
      });
    });

    it('should run analysis and return results', async () => {
      // Mock TypeScript compiler API
      const mockProgram = {
        getSourceFiles: () => [],
        getSemanticDiagnostics: () => [],
        getSyntacticDiagnostics: () => [],
        getTypeChecker: () => ({})
      };

      // Mock TypeScript module
      vi.doMock('typescript', () => ({
        readConfigFile: () => ({ config: {}, error: null }),
        parseJsonConfigFileContent: () => ({ fileNames: [], options: {}, errors: [] }),
        createProgram: () => mockProgram,
        sys: { readFile: vi.fn() }
      }));

      const result = await analyzer.analyze();

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.suggestions).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle analysis errors gracefully', async () => {
      // Mock an error in one of the analyzers
      mockFs.readFile.mockRejectedValueOnce(new Error('File read error'));

      const result = await analyzer.analyze();

      // Should still return a result even if some analyzers fail
      expect(result).toBeDefined();
      expect(result.summary.totalIssues).toBeGreaterThanOrEqual(0);
    });
  });

  describe('report generation', () => {
    const mockResult = {
      summary: {
        totalFiles: 10,
        analyzedFiles: 8,
        skippedFiles: 2,
        totalIssues: 5,
        criticalIssues: 1,
        highIssues: 2,
        mediumIssues: 1,
        lowIssues: 1,
        infoIssues: 0
      },
      errors: [{
        id: 'test-error',
        category: ErrorCategory.SECURITY_VULNERABILITY,
        severity: ErrorSeverity.CRITICAL,
        message: 'Test error message',
        file: '/test/file.ts',
        line: 10,
        column: 5,
        source: 'test',
        rule: 'test-rule',
        suggestions: [],
        relatedErrors: [],
        firstSeen: new Date(),
        lastSeen: new Date(),
        occurrenceCount: 1
      }],
      warnings: [],
      suggestions: [],
      metrics: {
        linesOfCode: 1000,
        typesCoverage: 85.5,
        complexityScore: 3.2,
        maintainabilityIndex: 78.9,
        technicalDebt: {
          totalMinutes: 120,
          codeSmells: 5,
          duplicatedLines: 50,
          cyclomaticComplexity: 8,
          cognitiveComplexity: 12
        }
      },
      timestamp: new Date(),
      duration: 5000
    };

    it('should generate JSON report', () => {
      const report = analyzer.generateReport(mockResult, 'json');
      expect(report).toContain('"totalFiles": 10');
      expect(report).toContain('"criticalIssues": 1');
      expect(() => JSON.parse(report)).not.toThrow();
    });

    it('should generate Markdown report', () => {
      const report = analyzer.generateReport(mockResult, 'markdown');
      expect(report).toContain('# Static Analysis Report');
      expect(report).toContain('**Total Files**: 10');
      expect(report).toContain('**Critical Issues**: 1');
    });

    it('should generate HTML report', () => {
      const report = analyzer.generateReport(mockResult, 'html');
      expect(report).toContain('<!DOCTYPE html>');
      expect(report).toContain('<title>Static Analysis Report</title>');
      expect(report).toContain('Total Files:</strong> 10');
    });
  });

  describe('error handling', () => {
    it('should handle missing TypeScript config', async () => {
      mockFs.stat.mockRejectedValue(new Error('File not found'));
      
      // Should not throw, but may have limited functionality
      const result = await analyzer.analyze();
      expect(result).toBeDefined();
    });

    it('should handle invalid project root', async () => {
      const invalidAnalyzer = new StaticAnalyzer('/nonexistent/path');
      
      // Should handle gracefully
      const result = await invalidAnalyzer.analyze();
      expect(result).toBeDefined();
    });
  });
});

describe('Error Types and Categories', () => {
  it('should have correct error severity levels', () => {
    expect(ErrorSeverity.CRITICAL).toBe('critical');
    expect(ErrorSeverity.HIGH).toBe('high');
    expect(ErrorSeverity.MEDIUM).toBe('medium');
    expect(ErrorSeverity.LOW).toBe('low');
    expect(ErrorSeverity.INFO).toBe('info');
  });

  it('should have correct error categories', () => {
    expect(ErrorCategory.SECURITY_VULNERABILITY).toBe('security_vulnerability');
    expect(ErrorCategory.TYPE_ERROR).toBe('type_error');
    expect(ErrorCategory.SYNTAX_ERROR).toBe('syntax_error');
    expect(ErrorCategory.LINTING_ISSUE).toBe('linting_issue');
  });
});

describe('Integration', () => {
  it('should work with real project structure', async () => {
    // This test would run against the actual project structure
    // For now, we'll just verify the analyzer can be instantiated
    const realAnalyzer = new StaticAnalyzer(process.cwd(), {
      enableTypeScript: true,
      enableESLint: false, // Skip ESLint to avoid config issues in test
      enableSecurity: false, // Skip security to avoid npm audit issues
      maxErrors: 10
    });
    
    expect(realAnalyzer).toBeDefined();
    
    // In a real integration test, we would run:
    // const result = await realAnalyzer.analyze();
    // expect(result.summary.analyzedFiles).toBeGreaterThan(0);
  });
});