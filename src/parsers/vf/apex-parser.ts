/**
 * Parser for Apex controller files (.cls)
 * Note: This is a simplified parser that extracts key information
 * without full Apex language parsing.
 */

import { logger } from '../../utils/logger';

export interface ApexProperty {
  name: string;
  type: string;
  hasGetter: boolean;
  hasSetter: boolean;
  isPublic: boolean;
  initialValue?: string;
}

export interface ApexMethod {
  name: string;
  returnType: string;
  parameters: ApexParameter[];
  isPublic: boolean;
  isRemoteAction: boolean;
  isAuraEnabled: boolean;
  isCacheable: boolean;
  body?: string;
}

export interface ApexParameter {
  name: string;
  type: string;
}

export interface ApexInnerClass {
  name: string;
  properties: ApexProperty[];
  isWrapper: boolean;
}

export interface ParsedApexController {
  className: string;
  extendsClass?: string;
  implementsInterfaces: string[];
  properties: ApexProperty[];
  methods: ApexMethod[];
  innerClasses: ApexInnerClass[];
  constructorParams: ApexParameter[];
  hasStandardController: boolean;
  hasStandardSetController: boolean;
  soqlQueries: string[];
  dmlOperations: string[];
  rawSource: string;
}

/**
 * Extract class name from Apex code
 */
function extractClassName(source: string): string | null {
  const classRegex =
    /(?:public|private|global)\s+(?:with\s+sharing|without\s+sharing|inherited\s+sharing)?\s*(?:virtual|abstract)?\s*class\s+(\w+)/i;
  const match = source.match(classRegex);
  return match ? match[1] : null;
}

/**
 * Extract extends clause
 */
function extractExtends(source: string): string | null {
  const extendsRegex = /class\s+\w+\s+extends\s+(\w+)/i;
  const match = source.match(extendsRegex);
  return match ? match[1] : null;
}

/**
 * Extract implements clause
 */
function extractImplements(source: string): string[] {
  const implementsRegex = /class\s+\w+(?:\s+extends\s+\w+)?\s+implements\s+([^{]+)/i;
  const match = source.match(implementsRegex);
  if (match) {
    return match[1].split(',').map((s) => s.trim());
  }
  return [];
}

/**
 * Extract properties from Apex code
 */
function extractProperties(source: string): ApexProperty[] {
  const properties: ApexProperty[] = [];

  // Match property declarations
  // Pattern: (public|private) Type propertyName { get; set; }
  // Or: (public|private) Type propertyName;
  const propertyRegex =
    /(?:public|private|protected)\s+([\w<>,\s]+?)\s+(\w+)\s*(?:\{([^}]*)\}|;)/g;

  let match;
  while ((match = propertyRegex.exec(source)) !== null) {
    const fullMatch = match[0];
    const type = match[1].trim();
    const name = match[2];
    const accessors = match[3] || '';

    // Skip if this looks like a method (has parentheses after name in the original line)
    if (fullMatch.includes('(')) continue;

    // Skip common non-property keywords
    if (['class', 'void', 'return', 'new', 'if', 'for', 'while'].includes(name)) continue;

    const prop: ApexProperty = {
      name,
      type,
      hasGetter: accessors.toLowerCase().includes('get'),
      hasSetter: accessors.toLowerCase().includes('set'),
      isPublic: fullMatch.startsWith('public'),
    };

    // Check for initialization
    const initRegex = new RegExp(`${name}\\s*=\\s*([^;{]+)`);
    const initMatch = fullMatch.match(initRegex);
    if (initMatch) {
      prop.initialValue = initMatch[1].trim();
    }

    properties.push(prop);
  }

  return properties;
}

/**
 * Extract methods from Apex code
 */
function extractMethods(source: string): ApexMethod[] {
  const methods: ApexMethod[] = [];

  // Pattern for methods with annotations and modifiers
  const methodRegex =
    /(@\w+(?:\([^)]*\))?[\s\n]*)*(?:public|private|protected|global)\s+(?:static\s+)?(?:(?:override|virtual|abstract)\s+)?([\w<>,\s]+?)\s+(\w+)\s*\(([^)]*)\)/g;

  let match;
  while ((match = methodRegex.exec(source)) !== null) {
    const annotations = match[1] || '';
    const returnType = match[2].trim();
    const name = match[3];
    const paramString = match[4];

    // Skip constructor (when name matches class name, but we don't have class name here)
    // We'll filter constructors separately
    if (returnType === name) continue;

    // Parse parameters
    const parameters: ApexParameter[] = [];
    if (paramString.trim()) {
      const paramParts = paramString.split(',');
      for (const part of paramParts) {
        const trimmed = part.trim();
        const paramMatch = trimmed.match(/([\w<>,\s]+?)\s+(\w+)$/);
        if (paramMatch) {
          parameters.push({
            type: paramMatch[1].trim(),
            name: paramMatch[2],
          });
        }
      }
    }

    const method: ApexMethod = {
      name,
      returnType,
      parameters,
      isPublic: match[0].includes('public') || match[0].includes('global'),
      isRemoteAction: annotations.includes('@RemoteAction'),
      isAuraEnabled: annotations.includes('@AuraEnabled'),
      isCacheable:
        annotations.includes('cacheable=true') || annotations.includes('cacheable = true'),
    };

    methods.push(method);
  }

  return methods;
}

/**
 * Extract inner classes (often used as wrapper classes)
 */
function extractInnerClasses(source: string): ApexInnerClass[] {
  const innerClasses: ApexInnerClass[] = [];

  // Simple pattern for inner class detection
  const innerClassRegex =
    /(?:public|private)\s+(?:class|virtual\s+class)\s+(\w+)\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g;

  let match;
  while ((match = innerClassRegex.exec(source)) !== null) {
    const className = match[1];
    const classBody = match[2];

    // Extract properties from inner class
    const properties = extractProperties(classBody);

    innerClasses.push({
      name: className,
      properties,
      isWrapper: properties.length > 0 && properties.every((p) => p.isPublic),
    });
  }

  return innerClasses;
}

/**
 * Extract SOQL queries
 */
function extractSoqlQueries(source: string): string[] {
  const queries: string[] = [];
  const soqlRegex = /\[\s*(SELECT\s+[^\]]+)\]/gi;

  let match;
  while ((match = soqlRegex.exec(source)) !== null) {
    queries.push(match[1].trim());
  }

  return queries;
}

/**
 * Detect DML operations
 */
function extractDmlOperations(source: string): string[] {
  const operations: string[] = [];
  const dmlKeywords = ['insert', 'update', 'upsert', 'delete', 'undelete', 'merge'];

  for (const keyword of dmlKeywords) {
    const regex = new RegExp(`\\b${keyword}\\s+\\w+`, 'gi');
    if (regex.test(source)) {
      operations.push(keyword);
    }
  }

  // Also check for Database methods
  const dbMethodRegex = /Database\.(insert|update|upsert|delete|undelete)/gi;
  let match;
  while ((match = dbMethodRegex.exec(source)) !== null) {
    const op = match[1].toLowerCase();
    if (!operations.includes(op)) {
      operations.push(op);
    }
  }

  return operations;
}

/**
 * Check for standard controller patterns
 */
function hasStandardController(source: string): boolean {
  return (
    source.includes('ApexPages.StandardController') ||
    source.includes('StandardController controller')
  );
}

/**
 * Check for standard set controller patterns
 */
function hasStandardSetController(source: string): boolean {
  return (
    source.includes('ApexPages.StandardSetController') ||
    source.includes('StandardSetController controller')
  );
}

/**
 * Extract constructor parameters
 */
function extractConstructorParams(source: string, className: string): ApexParameter[] {
  const constructorRegex = new RegExp(
    `(?:public|private)\\s+${className}\\s*\\(([^)]*)\\)`,
    'i'
  );

  const match = source.match(constructorRegex);
  if (!match || !match[1].trim()) return [];

  const paramString = match[1];
  const params: ApexParameter[] = [];

  const paramParts = paramString.split(',');
  for (const part of paramParts) {
    const trimmed = part.trim();
    const paramMatch = trimmed.match(/([\w<>,.\s]+?)\s+(\w+)$/);
    if (paramMatch) {
      params.push({
        type: paramMatch[1].trim(),
        name: paramMatch[2],
      });
    }
  }

  return params;
}

/**
 * Parse Apex controller file
 */
export function parseApexController(source: string): ParsedApexController {
  const className = extractClassName(source);

  if (!className) {
    logger.warn('Could not extract class name from Apex source');
  }

  const result: ParsedApexController = {
    className: className || 'UnknownController',
    extendsClass: extractExtends(source) || undefined,
    implementsInterfaces: extractImplements(source),
    properties: extractProperties(source),
    methods: extractMethods(source),
    innerClasses: extractInnerClasses(source),
    constructorParams: className ? extractConstructorParams(source, className) : [],
    hasStandardController: hasStandardController(source),
    hasStandardSetController: hasStandardSetController(source),
    soqlQueries: extractSoqlQueries(source),
    dmlOperations: extractDmlOperations(source),
    rawSource: source,
  };

  logger.debug(`Parsed Apex class: ${result.className}`);
  logger.debug(`Found ${result.properties.length} properties`);
  logger.debug(`Found ${result.methods.length} methods`);
  logger.debug(`Found ${result.innerClasses.length} inner classes`);
  logger.debug(`Found ${result.soqlQueries.length} SOQL queries`);

  // Log methods that are AuraEnabled or RemoteAction
  const remoteActions = result.methods.filter((m) => m.isRemoteAction);
  const auraEnabled = result.methods.filter((m) => m.isAuraEnabled);

  if (remoteActions.length > 0) {
    logger.debug(
      `RemoteAction methods: ${remoteActions.map((m) => m.name).join(', ')}`
    );
  }
  if (auraEnabled.length > 0) {
    logger.debug(
      `AuraEnabled methods: ${auraEnabled.map((m) => m.name).join(', ')}`
    );
  }

  return result;
}
