/**
 * Static Analysis System
 * Comprehensive error detection and code quality analysis
 */

export { StaticAnalyzer } from './analyzer';
export { TypeScriptAnalyzer } from './typescript-analyzer';
export { ESLintAnalyzer } from './eslint-analyzer';
export { SecurityScanner } from './security-scanner';
export { runCLI } from './cli';

export * from './types';

export { rules as customESLintRules, configs as eslintConfigs } from './eslint-rules';

// Re-export specific rules for individual use
export { noHardcodedCredentials } from './eslint-rules/no-hardcoded-credentials';
export { requireErrorHandling } from './eslint-rules/require-error-handling';
export { consistentNaming } from './eslint-rules/consistent-naming';
export { noDirectDbAccess } from './eslint-rules/no-direct-db-access';
export { requireInputValidation } from './eslint-rules/require-input-validation';