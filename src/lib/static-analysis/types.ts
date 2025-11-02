/**
 * Core types for the static analysis system
 */

export enum ErrorSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export enum ErrorCategory {
  SYNTAX_ERROR = 'syntax_error',
  TYPE_ERROR = 'type_error',
  LOGIC_ERROR = 'logic_error',
  SECURITY_VULNERABILITY = 'security_vulnerability',
  PERFORMANCE_ISSUE = 'performance_issue',
  COMPLIANCE_VIOLATION = 'compliance_violation',
  LINTING_ISSUE = 'linting_issue',
  IMPORT_ERROR = 'import_error'
}

export interface AnalysisError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  file: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  code?: string;
  source: string; // 'typescript' | 'eslint' | 'security'
  rule?: string;
  suggestions: ErrorSuggestion[];
  relatedErrors: string[];
  firstSeen: Date;
  lastSeen: Date;
  occurrenceCount: number;
}

export interface ErrorSuggestion {
  type: 'fix' | 'refactor' | 'ignore';
  description: string;
  code?: string;
  confidence: number; // 0-1
  automated: boolean;
}

export interface AnalysisResult {
  summary: AnalysisSummary;
  errors: AnalysisError[];
  warnings: AnalysisError[];
  suggestions: AnalysisError[];
  metrics: AnalysisMetrics;
  timestamp: Date;
  duration: number; // milliseconds
}

export interface AnalysisSummary {
  totalFiles: number;
  analyzedFiles: number;
  skippedFiles: number;
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  infoIssues: number;
}

export interface AnalysisMetrics {
  linesOfCode: number;
  typesCoverage: number;
  complexityScore: number;
  maintainabilityIndex: number;
  technicalDebt: TechnicalDebtMetrics;
}

export interface TechnicalDebtMetrics {
  totalMinutes: number;
  codeSmells: number;
  duplicatedLines: number;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
}

export interface AnalysisConfig {
  includePatterns: string[];
  excludePatterns: string[];
  enabledAnalyzers: string[];
  severityThresholds: Record<ErrorCategory, ErrorSeverity>;
  maxErrors: number;
  timeout: number; // milliseconds
  parallel: boolean;
}

export interface FileAnalysisResult {
  file: string;
  errors: AnalysisError[];
  metrics: FileMetrics;
  dependencies: string[];
  exports: string[];
}

export interface FileMetrics {
  linesOfCode: number;
  complexity: number;
  maintainabilityIndex: number;
  testCoverage?: number;
}

export interface AnalysisContext {
  projectRoot: string;
  tsConfigPath: string;
  eslintConfigPath?: string;
  packageJsonPath: string;
  gitIgnorePath?: string;
}