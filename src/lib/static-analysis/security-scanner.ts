/**
 * Security vulnerability scanner
 * Integrates dependency scanning, credential detection, and OWASP validation
 */

import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
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

interface VulnerabilityReport {
  advisories: Record<string, Advisory>;
  metadata: {
    vulnerabilities: VulnerabilityCount;
    dependencies: number;
    devDependencies: number;
    totalDependencies: number;
  };
}

interface Advisory {
  id: number;
  title: string;
  module_name: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  overview: string;
  recommendation: string;
  references: string[];
  vulnerable_versions: string;
  patched_versions: string;
  cves: string[];
}

interface VulnerabilityCount {
  info: number;
  low: number;
  moderate: number;
  high: number;
  critical: number;
  total: number;
}

interface SecurityRule {
  id: string;
  name: string;
  description: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  pattern: RegExp;
  filePatterns?: RegExp[];
  check: (content: string, filePath: string) => SecurityFinding[];
}

interface SecurityFinding {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  evidence: string;
  confidence: number;
}

const OWASP_SECURITY_RULES: SecurityRule[] = [
  {
    id: 'A01-broken-access-control',
    name: 'Broken Access Control',
    description: 'Detect potential access control issues',
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.SECURITY_VULNERABILITY,
    pattern: /(req\.user|req\.session|auth|authorization|permission)/i,
    check: (content: string, filePath: string) => {
      const findings: SecurityFinding[] = [];
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Check for missing authorization checks
        if (line.includes('req.user') && !line.includes('auth') && !line.includes('permission')) {
          findings.push({
            line: index + 1,
            column: line.indexOf('req.user'),
            message: 'Potential missing authorization check',
            evidence: line.trim(),
            confidence: 0.6
          });
        }
        
        // Check for hardcoded roles
        if (/role\s*===?\s*['"`](admin|root|superuser)['"`]/i.test(line)) {
          findings.push({
            line: index + 1,
            column: line.indexOf('role'),
            message: 'Hardcoded role check detected',
            evidence: line.trim(),
            confidence: 0.8
          });
        }
      });
      
      return findings;
    }
  },
  {
    id: 'A02-cryptographic-failures',
    name: 'Cryptographic Failures',
    description: 'Detect weak cryptographic implementations',
    severity: ErrorSeverity.CRITICAL,
    category: ErrorCategory.SECURITY_VULNERABILITY,
    pattern: /(crypto|encrypt|decrypt|hash|md5|sha1)/i,
    check: (content: string, filePath: string) => {
      const findings: SecurityFinding[] = [];
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Check for weak hashing algorithms
        if (/\b(md5|sha1)\b/i.test(line)) {
          findings.push({
            line: index + 1,
            column: line.search(/\b(md5|sha1)\b/i),
            message: 'Weak hashing algorithm detected',
            evidence: line.trim(),
            confidence: 0.9
          });
        }
        
        // Check for hardcoded encryption keys
        if (/key\s*[:=]\s*['"`][a-zA-Z0-9+/]{16,}['"`]/i.test(line)) {
          findings.push({
            line: index + 1,
            column: line.indexOf('key'),
            message: 'Hardcoded encryption key detected',
            evidence: line.trim(),
            confidence: 0.8
          });
        }
        
        // Check for weak random number generation
        if (/Math\.random\(\)/i.test(line) && /password|token|key|secret/i.test(line)) {
          findings.push({
            line: index + 1,
            column: line.indexOf('Math.random'),
            message: 'Weak random number generation for security-sensitive operation',
            evidence: line.trim(),
            confidence: 0.7
          });
        }
      });
      
      return findings;
    }
  },
  {
    id: 'A03-injection',
    name: 'Injection',
    description: 'Detect potential injection vulnerabilities',
    severity: ErrorSeverity.CRITICAL,
    category: ErrorCategory.SECURITY_VULNERABILITY,
    pattern: /(sql|query|execute|eval|innerHTML|document\.write)/i,
    check: (content: string, filePath: string) => {
      const findings: SecurityFinding[] = [];
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Check for SQL injection
        if (/query\s*\(\s*['"`][^'"`]*\$\{[^}]+\}[^'"`]*['"`]/i.test(line)) {
          findings.push({
            line: index + 1,
            column: line.indexOf('query'),
            message: 'Potential SQL injection vulnerability',
            evidence: line.trim(),
            confidence: 0.8
          });
        }
        
        // Check for XSS vulnerabilities
        if (/innerHTML\s*=\s*[^;]+\+|innerHTML\s*=\s*.*\$\{/i.test(line)) {
          findings.push({
            line: index + 1,
            column: line.indexOf('innerHTML'),
            message: 'Potential XSS vulnerability via innerHTML',
            evidence: line.trim(),
            confidence: 0.7
          });
        }
        
        // Check for code injection
        if (/eval\s*\(/i.test(line) || /Function\s*\(/i.test(line)) {
          findings.push({
            line: index + 1,
            column: line.search(/eval\s*\(|Function\s*\(/i),
            message: 'Code injection vulnerability via eval/Function',
            evidence: line.trim(),
            confidence: 0.9
          });
        }
        
        // Check for command injection
        if (/exec\s*\(\s*['"`][^'"`]*\$\{[^}]+\}[^'"`]*['"`]/i.test(line)) {
          findings.push({
            line: index + 1,
            column: line.indexOf('exec'),
            message: 'Potential command injection vulnerability',
            evidence: line.trim(),
            confidence: 0.8
          });
        }
      });
      
      return findings;
    }
  },
  {
    id: 'A04-insecure-design',
    name: 'Insecure Design',
    description: 'Detect insecure design patterns',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.SECURITY_VULNERABILITY,
    pattern: /(password|secret|token|key)/i,
    check: (content: string, filePath: string) => {
      const findings: SecurityFinding[] = [];
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Check for passwords in logs
        if (/console\.log.*password|logger.*password/i.test(line)) {
          findings.push({
            line: index + 1,
            column: line.search(/console\.log|logger/i),
            message: 'Password potentially logged',
            evidence: line.trim(),
            confidence: 0.8
          });
        }
        
        // Check for missing rate limiting
        if (/\/api\/.*login|\/api\/.*auth/i.test(line) && !content.includes('rateLimit')) {
          findings.push({
            line: index + 1,
            column: 0,
            message: 'Authentication endpoint may be missing rate limiting',
            evidence: line.trim(),
            confidence: 0.5
          });
        }
      });
      
      return findings;
    }
  },
  {
    id: 'A05-security-misconfiguration',
    name: 'Security Misconfiguration',
    description: 'Detect security misconfigurations',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.SECURITY_VULNERABILITY,
    pattern: /(cors|helmet|security|config)/i,
    check: (content: string, filePath: string) => {
      const findings: SecurityFinding[] = [];
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Check for permissive CORS
        if (/cors.*origin.*\*/i.test(line)) {
          findings.push({
            line: index + 1,
            column: line.indexOf('cors'),
            message: 'Permissive CORS configuration detected',
            evidence: line.trim(),
            confidence: 0.8
          });
        }
        
        // Check for debug mode in production
        if (/debug.*true|NODE_ENV.*development/i.test(line) && filePath.includes('prod')) {
          findings.push({
            line: index + 1,
            column: line.search(/debug|NODE_ENV/i),
            message: 'Debug mode enabled in production',
            evidence: line.trim(),
            confidence: 0.9
          });
        }
      });
      
      return findings;
    }
  },
  {
    id: 'A06-vulnerable-components',
    name: 'Vulnerable and Outdated Components',
    description: 'Detect usage of vulnerable components',
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.SECURITY_VULNERABILITY,
    pattern: /(import|require|from)/i,
    filePatterns: [/package\.json$/],
    check: (content: string, filePath: string) => {
      const findings: SecurityFinding[] = [];
      
      if (filePath.endsWith('package.json')) {
        try {
          const packageJson = JSON.parse(content);
          const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
          
          // Check for known vulnerable packages (simplified list)
          const vulnerablePackages = [
            'lodash@4.17.20',
            'axios@0.21.0',
            'express@4.17.0',
            'jsonwebtoken@8.5.0'
          ];
          
          Object.entries(dependencies).forEach(([name, version]) => {
            const packageSpec = `${name}@${version}`;
            if (vulnerablePackages.some(vuln => packageSpec.includes(vuln))) {
              findings.push({
                line: 1,
                column: 1,
                message: `Potentially vulnerable package: ${name}@${version}`,
                evidence: packageSpec,
                confidence: 0.6
              });
            }
          });
        } catch (error) {
          // Invalid JSON, skip
        }
      }
      
      return findings;
    }
  },
  {
    id: 'A07-identification-failures',
    name: 'Identification and Authentication Failures',
    description: 'Detect authentication and session management issues',
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.SECURITY_VULNERABILITY,
    pattern: /(session|jwt|token|auth|login|password)/i,
    check: (content: string, filePath: string) => {
      const findings: SecurityFinding[] = [];
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Check for weak session configuration
        if (/session.*secure.*false|session.*httpOnly.*false/i.test(line)) {
          findings.push({
            line: index + 1,
            column: line.search(/session/i),
            message: 'Insecure session configuration',
            evidence: line.trim(),
            confidence: 0.8
          });
        }
        
        // Check for JWT without expiration
        if (/jwt\.sign\(/i.test(line) && !line.includes('expiresIn')) {
          findings.push({
            line: index + 1,
            column: line.indexOf('jwt.sign'),
            message: 'JWT token without expiration',
            evidence: line.trim(),
            confidence: 0.7
          });
        }
        
        // Check for weak password validation
        if (/password.*length.*[1-5]/i.test(line)) {
          findings.push({
            line: index + 1,
            column: line.search(/password/i),
            message: 'Weak password length requirement',
            evidence: line.trim(),
            confidence: 0.8
          });
        }
      });
      
      return findings;
    }
  },
  {
    id: 'A08-software-integrity-failures',
    name: 'Software and Data Integrity Failures',
    description: 'Detect integrity validation issues',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.SECURITY_VULNERABILITY,
    pattern: /(integrity|hash|checksum|signature)/i,
    check: (content: string, filePath: string) => {
      const findings: SecurityFinding[] = [];
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Check for missing integrity checks on external resources
        if (/<script.*src.*https?:\/\/[^>]*>/i.test(line) && !line.includes('integrity')) {
          findings.push({
            line: index + 1,
            column: line.indexOf('<script'),
            message: 'External script without integrity check',
            evidence: line.trim(),
            confidence: 0.6
          });
        }
      });
      
      return findings;
    }
  },
  {
    id: 'A09-logging-failures',
    name: 'Security Logging and Monitoring Failures',
    description: 'Detect insufficient logging and monitoring',
    severity: ErrorSeverity.LOW,
    category: ErrorCategory.SECURITY_VULNERABILITY,
    pattern: /(log|audit|monitor|alert)/i,
    check: (content: string, filePath: string) => {
      const findings: SecurityFinding[] = [];
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Check for authentication events without logging
        if (/login|logout|auth/i.test(line) && !/log|audit/i.test(line)) {
          findings.push({
            line: index + 1,
            column: line.search(/login|logout|auth/i),
            message: 'Authentication event without logging',
            evidence: line.trim(),
            confidence: 0.4
          });
        }
      });
      
      return findings;
    }
  },
  {
    id: 'A10-ssrf',
    name: 'Server-Side Request Forgery',
    description: 'Detect potential SSRF vulnerabilities',
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.SECURITY_VULNERABILITY,
    pattern: /(fetch|axios|request|http|url)/i,
    check: (content: string, filePath: string) => {
      const findings: SecurityFinding[] = [];
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Check for user-controlled URLs in requests
        if (/fetch\s*\(\s*req\.|axios\s*\(\s*req\.|request\s*\(\s*req\./i.test(line)) {
          findings.push({
            line: index + 1,
            column: line.search(/fetch|axios|request/i),
            message: 'Potential SSRF vulnerability with user-controlled URL',
            evidence: line.trim(),
            confidence: 0.7
          });
        }
      });
      
      return findings;
    }
  }
];

export class SecurityScanner {
  private context: AnalysisContext;
  private config: AnalysisConfig;

  constructor(context: AnalysisContext, config: AnalysisConfig) {
    this.context = context;
    this.config = config;
  }

  /**
   * Run comprehensive security analysis
   */
  async analyze(): Promise<AnalysisResult> {
    const startTime = Date.now();
    
    try {
      const allErrors: AnalysisError[] = [];
      const fileResults: FileAnalysisResult[] = [];

      // Run dependency vulnerability scan
      const dependencyErrors = await this.scanDependencyVulnerabilities();
      allErrors.push(...dependencyErrors);

      // Run OWASP security rules scan
      const owaspErrors = await this.scanOWASPVulnerabilities();
      allErrors.push(...owaspErrors);

      // Run credential exposure scan
      const credentialErrors = await this.scanCredentialExposure();
      allErrors.push(...credentialErrors);

      // Generate file results (simplified for security scanner)
      const uniqueFiles = [...new Set(allErrors.map(e => e.file))];
      uniqueFiles.forEach(file => {
        const fileErrors = allErrors.filter(e => e.file === file);
        fileResults.push({
          file,
          errors: fileErrors,
          metrics: {
            linesOfCode: 0, // Not applicable for security scan
            complexity: 0,
            maintainabilityIndex: 100 - (fileErrors.length * 5)
          },
          dependencies: [],
          exports: []
        });
      });

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
      throw new Error(`Security analysis failed: ${error}`);
    }
  }

  /**
   * Scan for dependency vulnerabilities using npm audit
   */
  private async scanDependencyVulnerabilities(): Promise<AnalysisError[]> {
    const errors: AnalysisError[] = [];
    
    try {
      // Run npm audit
      const auditResult = execSync('npm audit --json', {
        cwd: this.context.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      const report: VulnerabilityReport = JSON.parse(auditResult);
      
      // Convert advisories to errors
      Object.values(report.advisories).forEach(advisory => {
        const severity = this.mapNpmSeverity(advisory.severity);
        const suggestions = this.generateVulnerabilitySuggestions(advisory);
        
        errors.push({
          id: `npm-audit-${advisory.id}`,
          category: ErrorCategory.SECURITY_VULNERABILITY,
          severity,
          message: `${advisory.title} in ${advisory.module_name}`,
          file: 'package.json',
          source: 'npm-audit',
          rule: `CVE-${advisory.id}`,
          suggestions,
          relatedErrors: [],
          firstSeen: new Date(),
          lastSeen: new Date(),
          occurrenceCount: 1
        });
      });
    } catch (error) {
      // npm audit might fail if no vulnerabilities found or if npm is not available
      // This is not necessarily an error condition
      console.warn('npm audit failed:', error);
    }
    
    return errors;
  }

  /**
   * Scan for OWASP Top 10 vulnerabilities
   */
  private async scanOWASPVulnerabilities(): Promise<AnalysisError[]> {
    const errors: AnalysisError[] = [];
    
    // Get files to scan
    const filesToScan = await this.getFilesToScan();
    
    for (const filePath of filesToScan) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        
        // Apply each security rule
        for (const rule of OWASP_SECURITY_RULES) {
          // Check if rule applies to this file type
          if (rule.filePatterns && !rule.filePatterns.some(pattern => pattern.test(filePath))) {
            continue;
          }
          
          // Check if content matches rule pattern
          if (!rule.pattern.test(content)) {
            continue;
          }
          
          // Run rule check
          const findings = rule.check(content, filePath);
          
          // Convert findings to errors
          findings.forEach(finding => {
            const suggestions = this.generateSecuritySuggestions(rule, finding);
            
            errors.push({
              id: `${rule.id}-${filePath}-${finding.line}-${finding.column}`,
              category: rule.category,
              severity: rule.severity,
              message: `${rule.name}: ${finding.message}`,
              file: filePath,
              line: finding.line,
              column: finding.column,
              endLine: finding.endLine,
              endColumn: finding.endColumn,
              source: 'owasp-scanner',
              rule: rule.id,
              suggestions,
              relatedErrors: [],
              firstSeen: new Date(),
              lastSeen: new Date(),
              occurrenceCount: 1
            });
          });
        }
      } catch (error) {
        console.warn(`Failed to scan file ${filePath}:`, error);
      }
    }
    
    return errors;
  }

  /**
   * Scan for credential exposure
   */
  private async scanCredentialExposure(): Promise<AnalysisError[]> {
    const errors: AnalysisError[] = [];
    
    const credentialPatterns = [
      {
        name: 'AWS Access Key',
        pattern: /AKIA[0-9A-Z]{16}/g,
        severity: ErrorSeverity.CRITICAL
      },
      {
        name: 'AWS Secret Key',
        pattern: /[0-9a-zA-Z/+]{40}/g,
        severity: ErrorSeverity.CRITICAL
      },
      {
        name: 'API Key',
        pattern: /api[_-]?key\s*[:=]\s*['"`]([a-zA-Z0-9_-]{20,})['"`]/gi,
        severity: ErrorSeverity.HIGH
      },
      {
        name: 'Private Key',
        pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
        severity: ErrorSeverity.CRITICAL
      },
      {
        name: 'Database URL',
        pattern: /(postgres|mysql|mongodb):\/\/[^\s'"]+/gi,
        severity: ErrorSeverity.HIGH
      },
      {
        name: 'JWT Secret',
        pattern: /jwt[_-]?secret\s*[:=]\s*['"`]([a-zA-Z0-9_-]{20,})['"`]/gi,
        severity: ErrorSeverity.HIGH
      }
    ];
    
    const filesToScan = await this.getFilesToScan();
    
    for (const filePath of filesToScan) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        
        credentialPatterns.forEach(({ name, pattern, severity }) => {
          lines.forEach((line, index) => {
            const matches = line.matchAll(pattern);
            for (const match of matches) {
              const column = match.index || 0;
              
              errors.push({
                id: `credential-${name.toLowerCase().replace(/\s+/g, '-')}-${filePath}-${index + 1}-${column}`,
                category: ErrorCategory.SECURITY_VULNERABILITY,
                severity,
                message: `Potential ${name} exposure detected`,
                file: filePath,
                line: index + 1,
                column: column + 1,
                source: 'credential-scanner',
                rule: 'credential-exposure',
                suggestions: [{
                  type: 'fix',
                  description: 'Move sensitive data to environment variables',
                  confidence: 0.9,
                  automated: false
                }],
                relatedErrors: [],
                firstSeen: new Date(),
                lastSeen: new Date(),
                occurrenceCount: 1
              });
            }
          });
        });
      } catch (error) {
        console.warn(`Failed to scan file ${filePath}:`, error);
      }
    }
    
    return errors;
  }

  /**
   * Get files to scan based on configuration
   */
  private async getFilesToScan(): Promise<string[]> {
    const files: string[] = [];
    
    for (const pattern of this.config.includePatterns) {
      const fullPattern = path.resolve(this.context.projectRoot, pattern);
      
      try {
        const stat = await fs.stat(fullPattern);
        if (stat.isFile()) {
          files.push(fullPattern);
        } else if (stat.isDirectory()) {
          // Recursively scan directory
          const dirFiles = await this.scanDirectory(fullPattern);
          files.push(...dirFiles);
        }
      } catch {
        // Pattern might be a glob or non-existent, skip
      }
    }
    
    // Filter out excluded patterns
    return files.filter(file => {
      const relativePath = path.relative(this.context.projectRoot, file);
      return !this.config.excludePatterns.some(pattern => 
        relativePath.includes(pattern) || file.includes(pattern)
      );
    });
  }

  /**
   * Recursively scan directory for files
   */
  private async scanDirectory(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const subFiles = await this.scanDirectory(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx|json|env)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${dirPath}:`, error);
    }
    
    return files;
  }

  /**
   * Map npm audit severity to our severity levels
   */
  private mapNpmSeverity(severity: string): ErrorSeverity {
    switch (severity.toLowerCase()) {
      case 'critical':
        return ErrorSeverity.CRITICAL;
      case 'high':
        return ErrorSeverity.HIGH;
      case 'moderate':
        return ErrorSeverity.MEDIUM;
      case 'low':
        return ErrorSeverity.LOW;
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * Generate suggestions for vulnerability fixes
   */
  private generateVulnerabilitySuggestions(advisory: Advisory): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [];
    
    if (advisory.patched_versions) {
      suggestions.push({
        type: 'fix',
        description: `Update ${advisory.module_name} to ${advisory.patched_versions}`,
        confidence: 0.9,
        automated: true
      });
    }
    
    if (advisory.recommendation) {
      suggestions.push({
        type: 'fix',
        description: advisory.recommendation,
        confidence: 0.8,
        automated: false
      });
    }
    
    return suggestions;
  }

  /**
   * Generate suggestions for security rule violations
   */
  private generateSecuritySuggestions(rule: SecurityRule, finding: SecurityFinding): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [];
    
    // Rule-specific suggestions
    switch (rule.id) {
      case 'A01-broken-access-control':
        suggestions.push({
          type: 'fix',
          description: 'Add proper authorization checks before accessing user data',
          confidence: 0.8,
          automated: false
        });
        break;
        
      case 'A02-cryptographic-failures':
        suggestions.push({
          type: 'fix',
          description: 'Use strong cryptographic algorithms (SHA-256, bcrypt) and secure key management',
          confidence: 0.9,
          automated: false
        });
        break;
        
      case 'A03-injection':
        suggestions.push({
          type: 'fix',
          description: 'Use parameterized queries and input validation to prevent injection attacks',
          confidence: 0.9,
          automated: false
        });
        break;
        
      default:
        suggestions.push({
          type: 'fix',
          description: rule.description,
          confidence: finding.confidence,
          automated: false
        });
        break;
    }
    
    return suggestions;
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
    const securityScore = Math.max(0, 100 - (fileResults.reduce((sum, r) => sum + r.errors.length, 0) * 2));
    
    return {
      linesOfCode: 0, // Not applicable for security scan
      typesCoverage: 0, // Not applicable for security scan
      complexityScore: 0, // Not applicable for security scan
      maintainabilityIndex: securityScore,
      technicalDebt: {
        totalMinutes: fileResults.reduce((sum, r) => sum + r.errors.length * 30, 0), // 30 min per security issue
        codeSmells: 0,
        duplicatedLines: 0,
        cyclomaticComplexity: 0,
        cognitiveComplexity: 0
      }
    };
  }
}