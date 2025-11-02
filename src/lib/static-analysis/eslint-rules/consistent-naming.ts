/**
 * ESLint rule: consistent-naming
 * Enforces consistent naming conventions for StoreSync project
 */

import { Rule } from 'eslint';
import { Node } from 'estree';

const NAMING_CONVENTIONS = {
  // Variables and functions should be camelCase
  variable: /^[a-z][a-zA-Z0-9]*$/,
  function: /^[a-z][a-zA-Z0-9]*$/,
  
  // Constants should be UPPER_SNAKE_CASE
  constant: /^[A-Z][A-Z0-9_]*$/,
  
  // Classes should be PascalCase
  class: /^[A-Z][a-zA-Z0-9]*$/,
  
  // Interfaces should be PascalCase and optionally start with 'I'
  interface: /^I?[A-Z][a-zA-Z0-9]*$/,
  
  // Types should be PascalCase
  type: /^[A-Z][a-zA-Z0-9]*$/,
  
  // Enums should be PascalCase
  enum: /^[A-Z][a-zA-Z0-9]*$/,
  
  // Enum members should be UPPER_SNAKE_CASE
  enumMember: /^[A-Z][A-Z0-9_]*$/,
  
  // Private members should start with underscore
  private: /^_[a-zA-Z0-9]*$/,
  
  // React components should be PascalCase
  component: /^[A-Z][a-zA-Z0-9]*$/,
  
  // React hooks should start with 'use'
  hook: /^use[A-Z][a-zA-Z0-9]*$/,
  
  // API routes should be kebab-case
  apiRoute: /^[a-z][a-z0-9-]*$/,
  
  // Database tables should be snake_case
  dbTable: /^[a-z][a-z0-9_]*$/,
  
  // Database columns should be snake_case
  dbColumn: /^[a-z][a-z0-9_]*$/,
};

const STORESYNC_PREFIXES = {
  // Service classes
  service: /^[A-Z][a-zA-Z0-9]*Service$/,
  
  // Repository classes
  repository: /^[A-Z][a-zA-Z0-9]*Repository$/,
  
  // Controller classes
  controller: /^[A-Z][a-zA-Z0-9]*Controller$/,
  
  // Adapter classes
  adapter: /^[A-Z][a-zA-Z0-9]*Adapter$/,
  
  // Client classes
  client: /^[A-Z][a-zA-Z0-9]*Client$/,
  
  // Utility classes
  util: /^[A-Z][a-zA-Z0-9]*Utils?$/,
  
  // Helper classes
  helper: /^[A-Z][a-zA-Z0-9]*Helper$/,
  
  // Manager classes
  manager: /^[A-Z][a-zA-Z0-9]*Manager$/,
  
  // Handler classes
  handler: /^[A-Z][a-zA-Z0-9]*Handler$/,
};

export const consistentNaming: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce consistent naming conventions for StoreSync project',
      category: 'Stylistic Issues',
      recommended: true,
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          enforceStoreSync: {
            type: 'boolean',
            description: 'Enforce StoreSync-specific naming patterns',
            default: true,
          },
          allowedPrefixes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional allowed prefixes for classes',
          },
          exceptions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Names to exclude from checking',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      invalidVariableName: 'Variable "{{name}}" should be camelCase.',
      invalidFunctionName: 'Function "{{name}}" should be camelCase.',
      invalidConstantName: 'Constant "{{name}}" should be UPPER_SNAKE_CASE.',
      invalidClassName: 'Class "{{name}}" should be PascalCase.',
      invalidInterfaceName: 'Interface "{{name}}" should be PascalCase.',
      invalidTypeName: 'Type "{{name}}" should be PascalCase.',
      invalidEnumName: 'Enum "{{name}}" should be PascalCase.',
      invalidEnumMemberName: 'Enum member "{{name}}" should be UPPER_SNAKE_CASE.',
      invalidPrivateName: 'Private member "{{name}}" should start with underscore.',
      invalidComponentName: 'React component "{{name}}" should be PascalCase.',
      invalidHookName: 'React hook "{{name}}" should start with "use" and be camelCase.',
      invalidServiceName: 'Service class "{{name}}" should end with "Service".',
      invalidRepositoryName: 'Repository class "{{name}}" should end with "Repository".',
      invalidControllerName: 'Controller class "{{name}}" should end with "Controller".',
      invalidAdapterName: 'Adapter class "{{name}}" should end with "Adapter".',
      invalidClientName: 'Client class "{{name}}" should end with "Client".',
      invalidUtilName: 'Utility class "{{name}}" should end with "Utils" or "Util".',
      invalidHelperName: 'Helper class "{{name}}" should end with "Helper".',
      invalidManagerName: 'Manager class "{{name}}" should end with "Manager".',
      invalidHandlerName: 'Handler class "{{name}}" should end with "Handler".',
    },
  },

  create(context: Rule.RuleContext) {
    const options = context.options[0] || {};
    const enforceStoreSync = options.enforceStoreSync !== false;
    const allowedPrefixes = new Set(options.allowedPrefixes || []);
    const exceptions = new Set(options.exceptions || []);

    function isException(name: string): boolean {
      return exceptions.has(name);
    }

    function checkNaming(node: Node, name: string, expectedPattern: RegExp, messageId: string) {
      if (isException(name)) return;
      
      if (!expectedPattern.test(name)) {
        context.report({
          node,
          messageId,
          data: { name },
        });
      }
    }

    function checkStoreSyncPattern(node: Node, name: string, className: string) {
      if (!enforceStoreSync) return;
      if (isException(name)) return;
      
      // Check for StoreSync-specific patterns
      const patterns = Object.entries(STORESYNC_PREFIXES);
      
      for (const [type, pattern] of patterns) {
        if (className.toLowerCase().includes(type)) {
          if (!pattern.test(name)) {
            const messageId = `invalid${type.charAt(0).toUpperCase() + type.slice(1)}Name`;
            context.report({
              node,
              messageId,
              data: { name },
            });
          }
          return;
        }
      }
    }

    function isConstant(node: any): boolean {
      // Check if variable is declared as const and is all uppercase
      if (node.parent?.type === 'VariableDeclarator' && 
          node.parent.parent?.type === 'VariableDeclaration' &&
          node.parent.parent.kind === 'const') {
        return /^[A-Z_][A-Z0-9_]*$/.test(node.name);
      }
      return false;
    }

    function isPrivateMember(node: any): boolean {
      // Check if it's a class member with private modifier
      return node.accessibility === 'private' || 
             (node.key && node.key.name && node.key.name.startsWith('_'));
    }

    function isReactComponent(node: any): boolean {
      // Check if it's a function that returns JSX
      if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') {
        // Simple heuristic: function name starts with capital letter
        return /^[A-Z]/.test(node.id?.name || '');
      }
      return false;
    }

    function isReactHook(node: any): boolean {
      // Check if function name starts with 'use'
      const name = node.id?.name || node.key?.name || '';
      return name.startsWith('use') && name.length > 3;
    }

    return {
      // Variable declarations
      Identifier(node) {
        const name = node.name;
        
        // Skip if it's a property key or method name in object patterns
        if (node.parent?.type === 'Property' && node.parent.key === node) return;
        if (node.parent?.type === 'MemberExpression' && node.parent.property === node) return;
        
        // Variable declarations
        if (node.parent?.type === 'VariableDeclarator' && node.parent.id === node) {
          if (isConstant(node)) {
            checkNaming(node, name, NAMING_CONVENTIONS.constant, 'invalidConstantName');
          } else {
            checkNaming(node, name, NAMING_CONVENTIONS.variable, 'invalidVariableName');
          }
        }
        
        // Function declarations
        if (node.parent?.type === 'FunctionDeclaration' && node.parent.id === node) {
          if (isReactComponent(node.parent)) {
            checkNaming(node, name, NAMING_CONVENTIONS.component, 'invalidComponentName');
          } else if (isReactHook(node.parent)) {
            checkNaming(node, name, NAMING_CONVENTIONS.hook, 'invalidHookName');
          } else {
            checkNaming(node, name, NAMING_CONVENTIONS.function, 'invalidFunctionName');
          }
        }
        
        // Class declarations
        if (node.parent?.type === 'ClassDeclaration' && node.parent.id === node) {
          checkNaming(node, name, NAMING_CONVENTIONS.class, 'invalidClassName');
          checkStoreSyncPattern(node, name, name);
        }
        
        // Interface declarations (TypeScript)
        if (node.parent?.type === 'TSInterfaceDeclaration' && node.parent.id === node) {
          checkNaming(node, name, NAMING_CONVENTIONS.interface, 'invalidInterfaceName');
        }
        
        // Type alias declarations (TypeScript)
        if (node.parent?.type === 'TSTypeAliasDeclaration' && node.parent.id === node) {
          checkNaming(node, name, NAMING_CONVENTIONS.type, 'invalidTypeName');
        }
        
        // Enum declarations (TypeScript)
        if (node.parent?.type === 'TSEnumDeclaration' && node.parent.id === node) {
          checkNaming(node, name, NAMING_CONVENTIONS.enum, 'invalidEnumName');
        }
        
        // Enum members (TypeScript)
        if (node.parent?.type === 'TSEnumMember' && node.parent.id === node) {
          checkNaming(node, name, NAMING_CONVENTIONS.enumMember, 'invalidEnumMemberName');
        }
        
        // Class members
        if ((node.parent?.type === 'MethodDefinition' || 
             node.parent?.type === 'PropertyDefinition') && 
            node.parent.key === node) {
          if (isPrivateMember(node.parent)) {
            checkNaming(node, name, NAMING_CONVENTIONS.private, 'invalidPrivateName');
          } else if (isReactHook({ key: node })) {
            checkNaming(node, name, NAMING_CONVENTIONS.hook, 'invalidHookName');
          } else {
            checkNaming(node, name, NAMING_CONVENTIONS.function, 'invalidFunctionName');
          }
        }
      },
    };
  },
};