/**
 * Custom ESLint rules for StoreSync patterns
 * Enforces project-specific coding standards and best practices
 */

import { Rule } from 'eslint';
import { noHardcodedCredentials } from './no-hardcoded-credentials';
import { requireErrorHandling } from './require-error-handling';
import { consistentNaming } from './consistent-naming';
import { noDirectDbAccess } from './no-direct-db-access';
import { requireInputValidation } from './require-input-validation';

export const rules: Record<string, Rule.RuleModule> = {
  'no-hardcoded-credentials': noHardcodedCredentials,
  'require-error-handling': requireErrorHandling,
  'consistent-naming': consistentNaming,
  'no-direct-db-access': noDirectDbAccess,
  'require-input-validation': requireInputValidation,
};

export const configs = {
  recommended: {
    plugins: ['storesync-custom'],
    rules: {
      'storesync-custom/no-hardcoded-credentials': 'error',
      'storesync-custom/require-error-handling': 'warn',
      'storesync-custom/consistent-naming': 'warn',
      'storesync-custom/no-direct-db-access': 'error',
      'storesync-custom/require-input-validation': 'warn',
    },
  },
  strict: {
    plugins: ['storesync-custom'],
    rules: {
      'storesync-custom/no-hardcoded-credentials': 'error',
      'storesync-custom/require-error-handling': 'error',
      'storesync-custom/consistent-naming': 'error',
      'storesync-custom/no-direct-db-access': 'error',
      'storesync-custom/require-input-validation': 'error',
    },
  },
};