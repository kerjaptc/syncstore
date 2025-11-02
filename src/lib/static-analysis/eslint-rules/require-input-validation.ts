/**
 * ESLint rule: require-input-validation
 * Ensures proper input validation for API endpoints and user inputs
 */

import { Rule } from 'eslint';
import { Node } from 'estree';

const API_PATTERNS = [
  // Next.js API routes
  'NextRequest',
  'NextResponse',
  'req.body',
  'req.query',
  'req.params',
  
  // tRPC procedures
  'publicProcedure',
  'protectedProcedure',
  'procedure',
  'input',
  'mutation',
  'query',
  
  // Express patterns
  'express',
  'app.get',
  'app.post',
  'app.put',
  'app.patch',
  'app.delete',
  'router.get',
  'router.post',
  'router.put',
  'router.patch',
  'router.delete',
];

const VALIDATION_PATTERNS = [
  // Zod validation
  'z.',
  'zod',
  'parse',
  'safeParse',
  'parseAsync',
  'safeParseAsync',
  
  // Joi validation
  'joi',
  'Joi',
  'validate',
  'validateAsync',
  
  // Yup validation
  'yup',
  'Yup',
  'validate',
  'validateSync',
  
  // Custom validation
  'validate',
  'validator',
  'isValid',
  'sanitize',
  'clean',
];

const DANGEROUS_INPUTS = [
  'innerHTML',
  'outerHTML',
  'dangerouslySetInnerHTML',
  'eval',
  'Function',
  'setTimeout',
  'setInterval',
  'document.write',
  'document.writeln',
];

export const requireInputValidation: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require proper input validation for API endpoints and user inputs',
      category: 'Security',
      recommended: true,
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          requireApiValidation: {
            type: 'boolean',
            description: 'Require validation for API endpoints',
            default: true,
          },
          requireFormValidation: {
            type: 'boolean',
            description: 'Require validation for form inputs',
            default: true,
          },
          allowedValidators: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional validation patterns to recognize',
          },
          exemptFunctions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Functions exempt from validation requirements',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingApiValidation: 'API endpoint should validate input parameters.',
      missingFormValidation: 'Form handler should validate input data.',
      dangerousInput: 'Dangerous input method "{{method}}" should be validated and sanitized.',
      missingInputSanitization: 'User input should be validated and sanitized before use.',
      missingTrpcValidation: 'tRPC procedure should define input validation schema.',
      missingQueryValidation: 'Database query parameters should be validated.',
    },
  },

  create(context: Rule.RuleContext) {
    const options = context.options[0] || {};
    const requireApiValidation = options.requireApiValidation !== false;
    const requireFormValidation = options.requireFormValidation !== false;
    const allowedValidators = new Set([...VALIDATION_PATTERNS, ...(options.allowedValidators || [])]);
    const exemptFunctions = new Set(options.exemptFunctions || []);

    function hasValidation(node: Node, searchScope: Node = node): boolean {
      // Look for validation patterns in the function body
      let hasValidationPattern = false;
      
      function checkForValidation(child: Node) {
        if (hasValidationPattern) return;
        
        // Check for validation method calls
        if (child.type === 'CallExpression') {
          const source = context.getSourceCode().getText(child.callee);
          if (Array.from(allowedValidators).some(pattern => source.includes(pattern))) {
            hasValidationPattern = true;
            return;
          }
        }
        
        // Check for validation imports or declarations
        if (child.type === 'VariableDeclarator' && child.init) {
          const source = context.getSourceCode().getText(child.init);
          if (Array.from(allowedValidators).some(pattern => source.includes(pattern))) {
            hasValidationPattern = true;
            return;
          }
        }
        
        // Recursively check children
        for (const key in child) {
          const value = (child as any)[key];
          if (Array.isArray(value)) {
            value.forEach(item => {
              if (item && typeof item === 'object' && item.type) {
                checkForValidation(item);
              }
            });
          } else if (value && typeof value === 'object' && value.type) {
            checkForValidation(value);
          }
        }
      }
      
      checkForValidation(searchScope);
      return hasValidationPattern;
    }

    function isApiEndpoint(node: any): boolean {
      // Check for Next.js API route patterns
      if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') {
        const params = node.params || [];
        return params.some((param: any) => {
          if (param.type === 'Identifier') {
            return ['req', 'request', 'NextRequest'].includes(param.name);
          }
          return false;
        });
      }
      
      // Check for Express route handlers
      const source = context.getSourceCode().getText(node);
      return API_PATTERNS.some(pattern => source.includes(pattern));
    }

    function isTrpcProcedure(node: any): boolean {
      // Check if this is a tRPC procedure definition
      const source = context.getSourceCode().getText(node);
      return ['publicProcedure', 'protectedProcedure', 'procedure'].some(pattern => 
        source.includes(pattern)
      );
    }

    function isFormHandler(node: any): boolean {
      // Check for form submission handlers
      if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') {
        const name = node.id?.name || '';
        return name.includes('submit') || name.includes('handle') || name.includes('onSubmit');
      }
      
      // Check for event handlers
      if (node.parent?.type === 'Property' && node.parent.key?.type === 'Identifier') {
        const propName = node.parent.key.name;
        return propName.includes('onSubmit') || propName.includes('handleSubmit');
      }
      
      return false;
    }

    function isExemptFunction(node: any): boolean {
      const name = node.id?.name || node.key?.name || '';
      return exemptFunctions.has(name);
    }

    function accessesUserInput(node: any): boolean {
      // Check if function accesses user input
      let accessesInput = false;
      
      function checkForInput(child: Node) {
        if (accessesInput) return;
        
        // Check for common input access patterns
        if (child.type === 'MemberExpression') {
          const source = context.getSourceCode().getText(child);
          if (['req.body', 'req.query', 'req.params', 'formData', 'input'].some(pattern => 
              source.includes(pattern))) {
            accessesInput = true;
            return;
          }
        }
        
        // Recursively check children
        for (const key in child) {
          const value = (child as any)[key];
          if (Array.isArray(value)) {
            value.forEach(item => {
              if (item && typeof item === 'object' && item.type) {
                checkForInput(item);
              }
            });
          } else if (value && typeof value === 'object' && value.type) {
            checkForInput(value);
          }
        }
      }
      
      if (node.body) {
        checkForInput(node.body);
      }
      
      return accessesInput;
    }

    return {
      // Check API endpoint functions
      'FunctionDeclaration, FunctionExpression, ArrowFunctionExpression'(node: any) {
        if (isExemptFunction(node)) return;
        
        // Check API endpoints
        if (requireApiValidation && isApiEndpoint(node)) {
          if (accessesUserInput(node) && !hasValidation(node)) {
            context.report({
              node,
              messageId: 'missingApiValidation',
            });
          }
        }
        
        // Check form handlers
        if (requireFormValidation && isFormHandler(node)) {
          if (!hasValidation(node)) {
            context.report({
              node,
              messageId: 'missingFormValidation',
            });
          }
        }
      },

      // Check tRPC procedures
      CallExpression(node) {
        if (isTrpcProcedure(node)) {
          // Check if procedure has input validation
          const hasInputValidation = node.arguments?.some((arg: any) => {
            if (arg.type === 'ObjectExpression') {
              return arg.properties?.some((prop: any) => 
                prop.key?.name === 'input' || prop.key?.name === 'schema'
              );
            }
            return false;
          });
          
          if (!hasInputValidation) {
            context.report({
              node,
              messageId: 'missingTrpcValidation',
            });
          }
        }
      },

      // Check dangerous input methods
      MemberExpression(node) {
        if (node.property.type === 'Identifier') {
          const propertyName = node.property.name;
          
          if (DANGEROUS_INPUTS.includes(propertyName)) {
            // Check if the value being assigned is validated
            if (node.parent?.type === 'AssignmentExpression' && node.parent.left === node) {
              const rightSide = context.getSourceCode().getText(node.parent.right);
              const isValidated = Array.from(allowedValidators).some(pattern => 
                rightSide.includes(pattern)
              );
              
              if (!isValidated) {
                context.report({
                  node,
                  messageId: 'dangerousInput',
                  data: { method: propertyName },
                });
              }
            }
          }
        }
      },

      // Check database queries with user input
      'CallExpression[callee.type="MemberExpression"]'(node: any) {
        const source = context.getSourceCode().getText(node.callee);
        
        // Check for database query methods
        if (['query', 'execute', 'raw', 'sql'].some(method => source.includes(method))) {
          // Check if query uses user input
          const hasUserInput = node.arguments?.some((arg: any) => {
            const argSource = context.getSourceCode().getText(arg);
            return ['req.', 'input.', 'params.', 'body.', 'query.'].some(pattern => 
              argSource.includes(pattern)
            );
          });
          
          if (hasUserInput) {
            // Check if input is validated
            const parentFunction = node.parent;
            let current = parentFunction;
            while (current && current.type !== 'FunctionDeclaration' && 
                   current.type !== 'FunctionExpression' && 
                   current.type !== 'ArrowFunctionExpression') {
              current = current.parent;
            }
            
            if (current && !hasValidation(node, current)) {
              context.report({
                node,
                messageId: 'missingQueryValidation',
              });
            }
          }
        }
      },
    };
  },
};