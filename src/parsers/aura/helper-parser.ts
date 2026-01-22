/**
 * Parser for Aura JavaScript helper files
 */

import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { logger } from '../../utils/logger';

export interface AuraHelperFunction {
  name: string;
  params: string[];
  body: string;
  hasComponent: boolean;
  isAsync: boolean;
  callsOtherHelpers: string[];
  serverCalls: string[];
}

export interface ParsedAuraHelper {
  functions: AuraHelperFunction[];
  rawSource: string;
}

/**
 * Extract the body of a function as a string
 */
function extractFunctionBody(node: t.FunctionExpression, source: string): string {
  if (node.body.start != null && node.body.end != null) {
    let body = source.substring(node.body.start as number, node.body.end as number);
    body = body.replace(/^\{/, '').replace(/\}$/, '').trim();
    return body;
  }
  return '';
}

/**
 * Parse Aura helper JavaScript
 */
export function parseAuraHelper(source: string): ParsedAuraHelper {
  const result: ParsedAuraHelper = {
    functions: [],
    rawSource: source,
  };

  // Handle the Aura helper pattern similar to controller
  let objectSource = source.trim();

  if (objectSource.startsWith('(')) {
    objectSource = objectSource.substring(1);
  }
  if (objectSource.endsWith(')')) {
    objectSource = objectSource.substring(0, objectSource.length - 1);
  }

  const wrappedSource = `const __auraHelper = ${objectSource}`;

  let ast: t.File;
  try {
    ast = parser.parse(wrappedSource, {
      sourceType: 'script',
      plugins: [],
    });
  } catch (error: any) {
    logger.warn(`Failed to parse helper: ${error.message}`);
    return result;
  }

  // Collect all helper function names first
  const helperFunctionNames = new Set<string>();

  traverse(ast, {
    ObjectExpression(path) {
      if (
        path.parent.type === 'VariableDeclarator' &&
        t.isIdentifier((path.parent as t.VariableDeclarator).id, {
          name: '__auraHelper',
        })
      ) {
        for (const prop of path.node.properties) {
          if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
            helperFunctionNames.add(prop.key.name);
          }
        }
      }
    },
  });

  // Now parse each function
  traverse(ast, {
    ObjectExpression(path) {
      if (
        path.parent.type === 'VariableDeclarator' &&
        t.isIdentifier((path.parent as t.VariableDeclarator).id, {
          name: '__auraHelper',
        })
      ) {
        for (const prop of path.node.properties) {
          if (
            t.isObjectProperty(prop) &&
            t.isIdentifier(prop.key) &&
            t.isFunctionExpression(prop.value)
          ) {
            const funcName = prop.key.name;
            const funcExpr = prop.value;

            const funcDef: AuraHelperFunction = {
              name: funcName,
              params: funcExpr.params
                .filter((p): p is t.Identifier => t.isIdentifier(p))
                .map((p) => p.name),
              body: extractFunctionBody(funcExpr, wrappedSource),
              hasComponent: false,
              isAsync: funcExpr.async || false,
              callsOtherHelpers: [],
              serverCalls: [],
            };

            // Check if has component parameter
            funcDef.hasComponent = funcDef.params.some(
              (p) => p === 'component' || p === 'cmp'
            );

            // Traverse function body
            const funcPath = path.get('properties').find((propPath) => {
              const propNode = propPath.node;
              return (
                t.isObjectProperty(propNode) &&
                t.isIdentifier(propNode.key, { name: funcName })
              );
            });

            if (funcPath) {
              funcPath.traverse({
                CallExpression(callPath) {
                  const callee = callPath.node.callee;

                  // Check for calls to other helper functions (this.otherHelper or direct name)
                  if (t.isMemberExpression(callee)) {
                    if (
                      t.isThisExpression(callee.object) &&
                      t.isIdentifier(callee.property)
                    ) {
                      const calledName = callee.property.name;
                      if (
                        helperFunctionNames.has(calledName) &&
                        calledName !== funcName
                      ) {
                        funcDef.callsOtherHelpers.push(calledName);
                      }
                    }
                  }

                  // Check for server action patterns
                  if (
                    t.isMemberExpression(callee) &&
                    t.isIdentifier(callee.property, { name: 'get' })
                  ) {
                    const args = callPath.node.arguments;
                    if (args.length > 0 && t.isStringLiteral(args[0])) {
                      const value = args[0].value;
                      if (value.startsWith('c.')) {
                        funcDef.serverCalls.push(value.substring(2));
                      }
                    }
                  }
                },
              });
            }

            result.functions.push(funcDef);
            logger.debug(
              `Parsed helper function: ${funcName}(${funcDef.params.join(', ')})`
            );
          }
        }
      }
    },
  });

  logger.debug(`Parsed ${result.functions.length} helper functions`);

  return result;
}
