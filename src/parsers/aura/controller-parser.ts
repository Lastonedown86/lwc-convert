/**
 * Parser for Aura JavaScript controller files
 */

import * as parser from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { logger } from '../../utils/logger';

export interface AuraControllerFunction {
  name: string;
  params: string[];
  body: string;
  hasComponent: boolean;
  hasEvent: boolean;
  hasHelper: boolean;
  usesGetSet: boolean;
  serverCalls: AuraServerCall[];
  eventFires: string[];
  helperCalls: string[];
  attributeAccess: AttributeAccess[];
}

export interface AuraServerCall {
  actionName: string;
  controllerMethod?: string;
  params: string[];
  callback?: string;
}

export interface AttributeAccess {
  name: string;
  operation: 'get' | 'set';
  value?: string;
}

export interface ParsedAuraController {
  functions: AuraControllerFunction[];
  rawSource: string;
}

/**
 * Extract the body of a function as a string
 */
function extractFunctionBody(node: t.FunctionExpression, source: string): string {
  if (node.body.start != null && node.body.end != null) {
    // Get the body including braces
    let body = source.substring(node.body.start as number, node.body.end as number);
    // Remove outer braces and trim
    body = body.replace(/^\{/, '').replace(/\}$/, '').trim();
    return body;
  }
  return '';
}

/**
 * Parse attribute access patterns like component.get("v.name") and component.set("v.name", value)
 */
function parseAttributeAccess(path: NodePath<t.CallExpression>): AttributeAccess | null {
  const callee = path.node.callee;

  if (!t.isMemberExpression(callee)) return null;

  const property = callee.property;
  if (!t.isIdentifier(property)) return null;

  if (property.name !== 'get' && property.name !== 'set') return null;

  const args = path.node.arguments;
  if (args.length === 0) return null;

  const firstArg = args[0];
  if (!t.isStringLiteral(firstArg)) return null;

  const attrPath = firstArg.value;
  if (!attrPath.startsWith('v.')) return null;

  const attrName = attrPath.substring(2);
  const operation = property.name as 'get' | 'set';

  return {
    name: attrName,
    operation,
  };
}

/**
 * Parse server action calls ($A.enqueueAction patterns)
 */
function parseServerCall(path: NodePath<t.CallExpression>, source: string): AuraServerCall | null {
  const callee = path.node.callee;

  // Look for $A.enqueueAction(action) pattern
  if (
    t.isMemberExpression(callee) &&
    t.isIdentifier(callee.object, { name: '$A' }) &&
    t.isIdentifier(callee.property, { name: 'enqueueAction' })
  ) {
    // This is the enqueue call, but we need to find the action setup
    return {
      actionName: 'enqueueAction',
      params: [],
    };
  }

  // Look for component.get("c.methodName") pattern - getting action
  if (t.isMemberExpression(callee)) {
    const property = callee.property;
    if (t.isIdentifier(property, { name: 'get' })) {
      const args = path.node.arguments;
      if (args.length > 0 && t.isStringLiteral(args[0])) {
        const value = args[0].value;
        if (value.startsWith('c.')) {
          return {
            actionName: value,
            controllerMethod: value.substring(2),
            params: [],
          };
        }
      }
    }
  }

  return null;
}

/**
 * Parse helper calls like helper.methodName(cmp, ...)
 */
function parseHelperCall(path: NodePath<t.CallExpression>): string | null {
  const callee = path.node.callee;

  if (
    t.isMemberExpression(callee) &&
    t.isIdentifier(callee.object, { name: 'helper' }) &&
    t.isIdentifier(callee.property)
  ) {
    return callee.property.name;
  }

  return null;
}

/**
 * Parse event fire patterns like event.fire() or $A.get("e.c:MyEvent")
 */
function parseEventFire(path: NodePath<t.CallExpression>): string | null {
  const callee = path.node.callee;

  // Check for $A.get("e.c:EventName") pattern
  if (
    t.isMemberExpression(callee) &&
    t.isIdentifier(callee.object, { name: '$A' }) &&
    t.isIdentifier(callee.property, { name: 'get' })
  ) {
    const args = path.node.arguments;
    if (args.length > 0 && t.isStringLiteral(args[0])) {
      const value = args[0].value;
      if (value.startsWith('e.')) {
        return value.substring(2);
      }
    }
  }

  // Check for component.getEvent("eventName") pattern
  if (
    t.isMemberExpression(callee) &&
    t.isIdentifier(callee.property, { name: 'getEvent' })
  ) {
    const args = path.node.arguments;
    if (args.length > 0 && t.isStringLiteral(args[0])) {
      return args[0].value;
    }
  }

  return null;
}

/**
 * Parse Aura controller JavaScript
 */
export function parseAuraController(source: string): ParsedAuraController {
  const result: ParsedAuraController = {
    functions: [],
    rawSource: source,
  };

  // Handle the Aura controller pattern: ({ functionName: function(cmp, event, helper) {...}, ... })
  // We need to extract the object literal inside the parentheses

  let objectSource = source.trim();

  // Remove leading ( and trailing ) if present
  if (objectSource.startsWith('(')) {
    objectSource = objectSource.substring(1);
  }
  if (objectSource.endsWith(')')) {
    objectSource = objectSource.substring(0, objectSource.length - 1);
  }

  // Wrap in a variable declaration for parsing
  const wrappedSource = `const __auraController = ${objectSource}`;

  let ast: t.File;
  try {
    ast = parser.parse(wrappedSource, {
      sourceType: 'script',
      plugins: [],
    });
  } catch (error: any) {
    logger.warn(`Failed to parse controller: ${error.message}`);
    return result;
  }

  // Traverse to find the object expression
  traverse(ast, {
    ObjectExpression(path) {
      // Check if this is the top-level object
      if (
        path.parent.type === 'VariableDeclarator' &&
        t.isIdentifier((path.parent as t.VariableDeclarator).id, {
          name: '__auraController',
        })
      ) {
        // Process each property (function)
        for (const prop of path.node.properties) {
          if (
            t.isObjectProperty(prop) &&
            t.isIdentifier(prop.key) &&
            t.isFunctionExpression(prop.value)
          ) {
            const funcName = prop.key.name;
            const funcExpr = prop.value;

            const funcDef: AuraControllerFunction = {
              name: funcName,
              params: funcExpr.params
                .filter((p): p is t.Identifier => t.isIdentifier(p))
                .map((p) => p.name),
              body: extractFunctionBody(funcExpr, wrappedSource),
              hasComponent: false,
              hasEvent: false,
              hasHelper: false,
              usesGetSet: false,
              serverCalls: [],
              eventFires: [],
              helperCalls: [],
              attributeAccess: [],
            };

            // Check parameter names
            funcDef.hasComponent = funcDef.params.some(
              (p) => p === 'component' || p === 'cmp'
            );
            funcDef.hasEvent = funcDef.params.some(
              (p) => p === 'event' || p === 'evt'
            );
            funcDef.hasHelper = funcDef.params.some((p) => p === 'helper');

            // Traverse function body for patterns
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
                  // Check for attribute access
                  const attrAccess = parseAttributeAccess(callPath);
                  if (attrAccess) {
                    funcDef.usesGetSet = true;
                    funcDef.attributeAccess.push(attrAccess);
                  }

                  // Check for server calls
                  const serverCall = parseServerCall(callPath, wrappedSource);
                  if (serverCall) {
                    funcDef.serverCalls.push(serverCall);
                  }

                  // Check for helper calls
                  const helperCall = parseHelperCall(callPath);
                  if (helperCall) {
                    funcDef.helperCalls.push(helperCall);
                  }

                  // Check for event fires
                  const eventFire = parseEventFire(callPath);
                  if (eventFire) {
                    funcDef.eventFires.push(eventFire);
                  }
                },
              });
            }

            result.functions.push(funcDef);
            logger.debug(
              `Parsed controller function: ${funcName}(${funcDef.params.join(', ')})`
            );
          }
        }
      }
    },
  });

  logger.debug(`Parsed ${result.functions.length} controller functions`);

  return result;
}
