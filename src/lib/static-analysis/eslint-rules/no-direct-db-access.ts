/**
 * ESLint rule: no-direct-db-access
 * Prevents direct database access outside of repository layer
 */

import { Rule } from 'eslint';
import { Node } from 'estree';

const DB_ACCESS_PATTERNS = [
  // Direct database imports
  'drizzle-orm',
  'postgres',
  'pg',
  'mysql',
  'sqlite',
  
  // Database connection patterns
  'createConnection',
  'getConnection',
  'connect',
  
  // Query patterns
  'query',
  'execute',
  'raw',
  'sql',
];

const ALLOWED_FILES = [
  // Repository files
  /repository\.(ts|js)$/i,
  /repositories\/.*\.(ts|js)$/i,
  
  // Database configuration files
  /db\/(config|connection|index)\.(ts|js)$/i,
  /database\/(config|connection|index)\.(ts|js)$/i,
  
  // Migration files
  /migrations?\/.*\.(ts|js)$/i,
  /drizzle\/.*\.(ts|js)$/i,
  
  // Seed files
  /seed\.(ts|js)$/i,
  /seeds\/.*\.(ts|js)$/i,
  
  // Test files
  /\.(test|spec)\.(ts|js)$/i,
  /__tests__\/.*\.(ts|js)$/i,
  
  // Database utilities
  /db\/.*\.(ts|js)$/i,
  /database\/.*\.(ts|js)$/i,
];

const ALLOWED_CLASSES = [
  'Repository',
  'BaseRepository',
  'DatabaseService',
  'MigrationService',
  'SeedService',
];

export const noDirectDbAccess: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent direct database access outside of repository layer',
      category: 'Architecture',
      recommended: true,
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          allowedFiles: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional file patterns to allow (regex strings)',
          },
          allowedClasses: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional class names that can access database',
          },
          allowedImports: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional imports to allow',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      directDbImport: 'Direct database import "{{module}}" is not allowed. Use repository layer instead.',
      directDbAccess: 'Direct database access is not allowed in this file. Use repository layer instead.',
      directQuery: 'Direct database query is not allowed. Use repository methods instead.',
      directConnection: 'Direct database connection is not allowed. Use repository layer instead.',
    },
  },

  create(context: Rule.RuleContext) {
    const options = context.options[0] || {};
    const additionalAllowedFiles = (options.allowedFiles || []).map((p: string) => new RegExp(p, 'i'));
    const additionalAllowedClasses = new Set(options.allowedClasses || []);
    const additionalAllowedImports = new Set(options.allowedImports || []);
    
    const filename = context.getFilename();
    const allAllowedFiles = [...ALLOWED_FILES, ...additionalAllowedFiles];
    const allAllowedClasses = new Set([...ALLOWED_CLASSES, ...additionalAllowedClasses]);
    const allAllowedImports = new Set([...DB_ACCESS_PATTERNS, ...additionalAllowedImports]);

    // Check if current file is allowed to access database
    function isAllowedFile(): boolean {
      return allAllowedFiles.some(pattern => pattern.test(filename));
    }

    // Check if we're inside an allowed class
    function isInAllowedClass(node: Node): boolean {
      let parent = node.parent;
      while (parent) {
        if (parent.type === 'ClassDeclaration' && parent.id) {
          const className = parent.id.name;
          if (allAllowedClasses.has(className) || 
              Array.from(allAllowedClasses).some(allowed => className.includes(allowed))) {
            return true;
          }
        }
        parent = parent.parent;
      }
      return false;
    }

    // Check if import is a database-related module
    function isDatabaseImport(moduleName: string): boolean {
      return DB_ACCESS_PATTERNS.some(pattern => 
        moduleName.includes(pattern) || moduleName === pattern
      );
    }

    // Check if call expression is a database operation
    function isDatabaseOperation(node: any): boolean {
      if (node.type !== 'CallExpression') return false;
      
      // Check method names
      if (node.callee.type === 'Identifier') {
        const name = node.callee.name;
        return ['query', 'execute', 'raw', 'sql'].includes(name);
      }
      
      // Check member expressions (db.query, connection.execute, etc.)
      if (node.callee.type === 'MemberExpression') {
        const source = context.getSourceCode().getText(node.callee);
        return ['db.', 'database.', 'connection.', 'client.'].some(prefix => 
          source.startsWith(prefix)
        ) && ['query', 'execute', 'raw', 'sql', 'insert', 'update', 'delete', 'select'].some(method =>
          source.includes(method)
        );
      }
      
      return false;
    }

    // Skip checking if file is allowed
    if (isAllowedFile()) {
      return {};
    }

    return {
      // Check imports
      ImportDeclaration(node) {
        if (node.source.type === 'Literal' && typeof node.source.value === 'string') {
          const moduleName = node.source.value;
          
          if (isDatabaseImport(moduleName) && !isInAllowedClass(node)) {
            context.report({
              node,
              messageId: 'directDbImport',
              data: { module: moduleName },
            });
          }
        }
      },

      // Check require calls
      CallExpression(node) {
        // Check require() calls
        if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
          if (node.arguments.length > 0 && node.arguments[0].type === 'Literal') {
            const moduleName = node.arguments[0].value as string;
            
            if (isDatabaseImport(moduleName) && !isInAllowedClass(node)) {
              context.report({
                node,
                messageId: 'directDbImport',
                data: { module: moduleName },
              });
            }
          }
        }
        
        // Check database operations
        if (isDatabaseOperation(node) && !isInAllowedClass(node)) {
          context.report({
            node,
            messageId: 'directQuery',
          });
        }
        
        // Check connection methods
        if (node.callee.type === 'Identifier' && 
            ['createConnection', 'getConnection', 'connect'].includes(node.callee.name) &&
            !isInAllowedClass(node)) {
          context.report({
            node,
            messageId: 'directConnection',
          });
        }
      },

      // Check variable declarations that might be database connections
      VariableDeclarator(node) {
        if (node.init && node.init.type === 'CallExpression') {
          const call = node.init;
          
          // Check for database connection assignments
          if (call.callee.type === 'Identifier' && 
              ['createConnection', 'getConnection', 'connect'].includes(call.callee.name) &&
              !isInAllowedClass(node)) {
            context.report({
              node,
              messageId: 'directConnection',
            });
          }
          
          // Check for direct database client assignments
          if (call.callee.type === 'MemberExpression') {
            const source = context.getSourceCode().getText(call.callee);
            if (['db.', 'database.', 'client.'].some(prefix => source.startsWith(prefix)) &&
                !isInAllowedClass(node)) {
              context.report({
                node,
                messageId: 'directDbAccess',
              });
            }
          }
        }
      },

      // Check member expressions for database access
      MemberExpression(node) {
        if (node.object.type === 'Identifier') {
          const objectName = node.object.name;
          
          // Check for common database object names
          if (['db', 'database', 'connection', 'client', 'pool'].includes(objectName) &&
              !isInAllowedClass(node)) {
            // Only report if it's being called (not just referenced)
            if (node.parent?.type === 'CallExpression' && node.parent.callee === node) {
              context.report({
                node,
                messageId: 'directDbAccess',
              });
            }
          }
        }
      },
    };
  },
};