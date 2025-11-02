/**
 * ESLint rule: require-error-handling
 * Ensures proper error handling in async functions and API calls
 */

import { Rule } from 'eslint';
import { Node } from 'estree';

const ASYNC_PATTERNS = [
  'fetch',
  'axios',
  'request',
  'query',
  'mutation',
  'transaction',
  'execute',
  'call',
  'invoke',
];

const DATABASE_PATTERNS = [
  'db.',
  'database.',
  'query(',
  'execute(',
  'transaction(',
  'insert(',
  'update(',
  'delete(',
  'select(',
];

const API_PATTERNS = [
  'api.',
  'client.',
  'service.',
  'fetch(',
  'post(',
  'get(',
  'put(',
  'patch(',
  'delete(',
];

export const requireErrorHandling: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require proper error handling for async operations',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          allowedMethods: {
            type: 'array',
            items: { type: 'string' },
            description: 'Methods that are allowed without error handling',
          },
          requireTryCatch: {
            type: 'boolean',
            description: 'Require try-catch blocks for async functions',
            default: true,
          },
          requireAwaitHandling: {
            type: 'boolean',
            description: 'Require error handling for await expressions',
            default: true,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingTryCatch: 'Async function should have try-catch block for error handling.',
      missingAwaitHandling: 'Await expression should be wrapped in try-catch or have .catch() handler.',
      missingPromiseHandling: 'Promise should have .catch() handler or be wrapped in try-catch.',
      missingApiErrorHandling: 'API call should have proper error handling.',
      missingDbErrorHandling: 'Database operation should have proper error handling.',
    },
  },

  create(context: Rule.RuleContext) {
    const options = context.options[0] || {};
    const allowedMethods = new Set(options.allowedMethods || []);
    const requireTryCatch = options.requireTryCatch !== false;
    const requireAwaitHandling = options.requireAwaitHandling !== false;

    function isInTryCatch(node: Node): boolean {
      let parent = node.parent;
      while (parent) {
        if (parent.type === 'TryStatement') {
          return true;
        }
        parent = parent.parent;
      }
      return false;
    }

    function hasPromiseCatch(node: Node): boolean {
      // Check if the node is part of a .catch() chain
      let parent = node.parent;
      while (parent) {
        if (parent.type === 'CallExpression' && 
            parent.callee.type === 'MemberExpression' &&
            parent.callee.property.type === 'Identifier' &&
            parent.callee.property.name === 'catch') {
          return true;
        }
        if (parent.type === 'AwaitExpression') {
          parent = parent.parent;
          continue;
        }
        break;
      }
      return false;
    }

    function isAsyncOperation(node: Node): boolean {
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
        const name = node.callee.name;
        return ASYNC_PATTERNS.some(pattern => name.includes(pattern));
      }
      
      if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
        const source = context.getSourceCode().getText(node.callee);
        return DATABASE_PATTERNS.some(pattern => source.includes(pattern)) ||
               API_PATTERNS.some(pattern => source.includes(pattern));
      }
      
      return false;
    }

    function isAllowedMethod(node: Node): boolean {
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
        return allowedMethods.has(node.callee.name);
      }
      return false;
    }

    function checkAsyncFunction(node: any) {
      if (!requireTryCatch) return;
      
      // Skip if function is very simple (no async operations)
      let hasAsyncOps = false;
      
      function checkForAsyncOps(child: Node) {
        if (isAsyncOperation(child) || child.type === 'AwaitExpression') {
          hasAsyncOps = true;
          return;
        }
        
        // Recursively check children
        for (const key in child) {
          const value = (child as any)[key];
          if (Array.isArray(value)) {
            value.forEach(item => {
              if (item && typeof item === 'object' && item.type) {
                checkForAsyncOps(item);
              }
            });
          } else if (value && typeof value === 'object' && value.type) {
            checkForAsyncOps(value);
          }
        }
      }
      
      if (node.body && node.body.type === 'BlockStatement') {
        checkForAsyncOps(node.body);
      }
      
      if (!hasAsyncOps) return;
      
      // Check if function body has try-catch
      const hasTryCatch = node.body.body.some((stmt: any) => stmt.type === 'TryStatement');
      
      if (!hasTryCatch) {
        context.report({
          node,
          messageId: 'missingTryCatch',
        });
      }
    }

    return {
      // Check async functions
      'FunctionDeclaration[async=true]': checkAsyncFunction,
      'FunctionExpression[async=true]': checkAsyncFunction,
      'ArrowFunctionExpression[async=true]': checkAsyncFunction,

      // Check await expressions
      AwaitExpression(node) {
        if (!requireAwaitHandling) return;
        if (isAllowedMethod(node.argument)) return;
        
        if (!isInTryCatch(node) && !hasPromiseCatch(node)) {
          context.report({
            node,
            messageId: 'missingAwaitHandling',
          });
        }
      },

      // Check Promise-returning calls
      CallExpression(node) {
        if (isAllowedMethod(node)) return;
        
        // Skip if already awaited or in try-catch
        if (node.parent?.type === 'AwaitExpression') return;
        if (isInTryCatch(node)) return;
        
        // Check for API calls
        if (node.callee.type === 'MemberExpression') {
          const source = context.getSourceCode().getText(node.callee);
          
          if (API_PATTERNS.some(pattern => source.includes(pattern))) {
            if (!hasPromiseCatch(node)) {
              context.report({
                node,
                messageId: 'missingApiErrorHandling',
              });
            }
          }
          
          if (DATABASE_PATTERNS.some(pattern => source.includes(pattern))) {
            if (!hasPromiseCatch(node)) {
              context.report({
                node,
                messageId: 'missingDbErrorHandling',
              });
            }
          }
        }
        
        // Check for async function calls
        if (isAsyncOperation(node) && !hasPromiseCatch(node)) {
          context.report({
            node,
            messageId: 'missingPromiseHandling',
          });
        }
      },
    };
  },
};