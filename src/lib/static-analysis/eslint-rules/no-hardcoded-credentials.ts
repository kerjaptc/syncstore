/**
 * ESLint rule: no-hardcoded-credentials
 * Prevents hardcoded API keys, passwords, and other sensitive information
 */

import { Rule } from 'eslint';
import { Node } from 'estree';

const CREDENTIAL_PATTERNS = [
  // API Keys
  /api[_-]?key/i,
  /secret[_-]?key/i,
  /access[_-]?key/i,
  /private[_-]?key/i,
  
  // Passwords
  /password/i,
  /passwd/i,
  /pwd/i,
  
  // Tokens
  /token/i,
  /auth[_-]?token/i,
  /bearer[_-]?token/i,
  /jwt[_-]?token/i,
  
  // Database credentials
  /db[_-]?password/i,
  /database[_-]?password/i,
  /connection[_-]?string/i,
  
  // Platform specific
  /shopee[_-]?secret/i,
  /tiktok[_-]?secret/i,
  /stripe[_-]?secret/i,
  /clerk[_-]?secret/i,
  
  // Common secret patterns
  /client[_-]?secret/i,
  /app[_-]?secret/i,
  /webhook[_-]?secret/i,
];

const SUSPICIOUS_VALUES = [
  // Common patterns that look like credentials
  /^[A-Za-z0-9+/]{20,}={0,2}$/, // Base64-like
  /^[a-f0-9]{32,}$/i, // Hex strings
  /^sk_[a-zA-Z0-9_]+$/, // Stripe secret keys
  /^pk_[a-zA-Z0-9_]+$/, // Stripe public keys
  /^whsec_[a-zA-Z0-9_]+$/, // Webhook secrets
  /^[a-zA-Z0-9]{40,}$/, // Long alphanumeric strings
];

export const noHardcodedCredentials: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hardcoded credentials and sensitive information',
      category: 'Security',
      recommended: true,
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          allowedPatterns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Patterns to allow (regex strings)',
          },
          additionalPatterns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional patterns to check (regex strings)',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      hardcodedCredential: 'Hardcoded credential detected: "{{name}}". Use environment variables instead.',
      suspiciousValue: 'Suspicious value that looks like a credential: "{{value}}". Consider using environment variables.',
    },
  },

  create(context: Rule.RuleContext) {
    const options = context.options[0] || {};
    const allowedPatterns = (options.allowedPatterns || []).map((p: string) => new RegExp(p, 'i'));
    const additionalPatterns = (options.additionalPatterns || []).map((p: string) => new RegExp(p, 'i'));
    const allPatterns = [...CREDENTIAL_PATTERNS, ...additionalPatterns];

    function isAllowedPattern(name: string, value: string): boolean {
      return allowedPatterns.some(pattern => pattern.test(name) || pattern.test(value));
    }

    function checkCredentialPattern(name: string): boolean {
      return allPatterns.some(pattern => pattern.test(name));
    }

    function checkSuspiciousValue(value: string): boolean {
      // Skip very short values
      if (value.length < 8) return false;
      
      // Skip common non-credential values
      const commonValues = ['localhost', 'example.com', 'test', 'development', 'production'];
      if (commonValues.some(common => value.toLowerCase().includes(common))) return false;
      
      return SUSPICIOUS_VALUES.some(pattern => pattern.test(value));
    }

    function checkNode(node: Node, name: string, value: string) {
      if (isAllowedPattern(name, value)) return;

      if (checkCredentialPattern(name)) {
        context.report({
          node,
          messageId: 'hardcodedCredential',
          data: { name },
        });
      } else if (checkSuspiciousValue(value)) {
        context.report({
          node,
          messageId: 'suspiciousValue',
          data: { value: value.substring(0, 20) + (value.length > 20 ? '...' : '') },
        });
      }
    }

    return {
      // Variable declarations: const API_KEY = "secret"
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && node.init) {
          const name = node.id.name;
          
          if (node.init.type === 'Literal' && typeof node.init.value === 'string') {
            checkNode(node, name, node.init.value);
          }
        }
      },

      // Property assignments: { apiKey: "secret" }
      Property(node) {
        if (node.key.type === 'Identifier' && node.value.type === 'Literal') {
          const name = node.key.name;
          const value = node.value.value;
          
          if (typeof value === 'string') {
            checkNode(node, name, value);
          }
        }
      },

      // Assignment expressions: obj.apiKey = "secret"
      AssignmentExpression(node) {
        if (node.left.type === 'MemberExpression' && 
            node.left.property.type === 'Identifier' &&
            node.right.type === 'Literal') {
          const name = node.left.property.name;
          const value = node.right.value;
          
          if (typeof value === 'string') {
            checkNode(node, name, value);
          }
        }
      },

      // Template literals with suspicious patterns
      TemplateLiteral(node) {
        if (node.quasis.length === 1) {
          const value = node.quasis[0].value.cooked || '';
          if (checkSuspiciousValue(value)) {
            context.report({
              node,
              messageId: 'suspiciousValue',
              data: { value: value.substring(0, 20) + (value.length > 20 ? '...' : '') },
            });
          }
        }
      },
    };
  },
};