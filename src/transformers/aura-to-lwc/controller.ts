/**
 * Transform Aura controller/helper JavaScript to LWC JavaScript class
 */

import {
  ParsedAuraController,
  AuraControllerFunction,
} from '../../parsers/aura/controller-parser';
import { ParsedAuraHelper, AuraHelperFunction } from '../../parsers/aura/helper-parser';
import { ParsedAuraMarkup } from '../../parsers/aura/markup-parser';
import { DetectedGetter } from './markup';
import { logger } from '../../utils/logger';
import { toPascalCase } from '../../utils/file-io';

export interface TransformedController {
  js: string;
  warnings: string[];
  imports: string[];
  properties: LwcProperty[];
  methods: LwcMethod[];
  apexMethods: string[];
  wireAdapters: string[];
}

export interface LwcProperty {
  name: string;
  isApi: boolean;
  isTrack: boolean;
  type: string;
  defaultValue?: string;
  description?: string;
}

export interface LwcMethod {
  name: string;
  isApi: boolean;
  body: string;
  originalAuraMethod?: string;
  isLifecycle: boolean;
}

/**
 * Convert Aura type to JavaScript type comment
 */
function convertType(auraType: string): string {
  const typeMap: Record<string, string> = {
    String: 'string',
    Integer: 'number',
    Decimal: 'number',
    Double: 'number',
    Long: 'number',
    Boolean: 'boolean',
    Date: 'Date',
    DateTime: 'Date',
    Object: 'Object',
    'List<String>': 'string[]',
    'List<Object>': 'Object[]',
    'Map<String,Object>': 'Object',
    'Aura.Component': 'any',
    'Aura.Component[]': 'any[]',
  };

  // Check for List<X> pattern
  const listMatch = auraType.match(/List<(\w+)>/i);
  if (listMatch) {
    const innerType = convertType(listMatch[1]);
    return `${innerType}[]`;
  }

  return typeMap[auraType] || 'any';
}

/**
 * Convert Aura controller function body to LWC
 */
function convertFunctionBody(
  body: string,
  _func: AuraControllerFunction | AuraHelperFunction,
  allHelperFunctions?: Set<string>
): { converted: string; warnings: string[]; usedLabels: string[] } {
  const warnings: string[] = [];
  const usedLabels: string[] = [];
  let converted = body;

  // Replace component.get("v.x") with this.x
  converted = converted.replace(
    /(?:component|cmp)\.get\s*\(\s*["']v\.(\w+)["']\s*\)/g,
    'this.$1'
  );

  // Replace component.set("v.x", value) with this.x = value
  converted = converted.replace(
    /(?:component|cmp)\.set\s*\(\s*["']v\.(\w+)["']\s*,\s*/g,
    'this.$1 = '
  );
  // Clean up the closing paren from set
  converted = converted.replace(/this\.(\w+)\s*=\s*([^;]+)\s*\)/g, 'this.$1 = $2');

  // Replace helper.methodName(component, ...) with this.methodName(...)
  if (allHelperFunctions) {
    for (const helperFunc of allHelperFunctions) {
      const helperRegex = new RegExp(
        `helper\\.${helperFunc}\\s*\\(\\s*(?:component|cmp)\\s*,?\\s*`,
        'g'
      );
      converted = converted.replace(helperRegex, `this.${helperFunc}(`);
    }
  }

  // Handle $A.enqueueAction patterns - mark for manual conversion
  if (converted.includes('$A.enqueueAction')) {
    warnings.push('Server action ($A.enqueueAction) found - convert to imperative Apex call');
    converted = converted.replace(
      /\$A\.enqueueAction\s*\([^)]+\)/g,
      '/* TODO: Convert to imperative Apex call */'
    );
  }

  // Handle component.get("c.methodName") - server action setup
  if (converted.includes('.get("c.') || converted.includes(".get('c.")) {
    warnings.push('Server action reference found - import Apex method and call imperatively');
  }

  // Handle $A.get("e.c:EventName") - application events
  converted = converted.replace(
    /\$A\.get\s*\(\s*["']e\.(?:c:)?(\w+)["']\s*\)/g,
    (_match, eventName) => {
      warnings.push(
        `Application event "${eventName}" found - convert to CustomEvent or pub/sub pattern`
      );
      return `/* TODO: Replace application event "${eventName}" with CustomEvent */`;
    }
  );

  // Handle component.getEvent("eventName") - component events
  converted = converted.replace(
    /(?:component|cmp)\.getEvent\s*\(\s*["'](\w+)["']\s*\)/g,
    (_match, eventName) => {
      return `new CustomEvent('${eventName.toLowerCase()}', { detail: {} })`;
    }
  );

  // Handle event.fire() - dispatch event
  converted = converted.replace(/(\w+)\.fire\s*\(\s*\)/g, 'this.dispatchEvent($1)');

  // Handle event.setParams({...}).fire()
  converted = converted.replace(
    /(\w+)\.setParams\s*\(\s*(\{[^}]+\})\s*\)\.fire\s*\(\s*\)/g,
    (_match, varName, params) => {
      return `this.dispatchEvent(new CustomEvent('${varName.toLowerCase()}', { detail: ${params} }))`;
    }
  );

  // Handle event.getParam("x") - get event parameter
  converted = converted.replace(
    /(?:event|evt)\.getParam\s*\(\s*["'](\w+)["']\s*\)/g,
    'event.detail.$1'
  );

  // Handle event.getParams() - get all params
  converted = converted.replace(/(?:event|evt)\.getParams\s*\(\s*\)/g, 'event.detail');

  // Handle component.find("auraId") - query selector
  converted = converted.replace(
    /(?:component|cmp)\.find\s*\(\s*["'](\w+)["']\s*\)/g,
    'this.template.querySelector(\'[data-id="$1"]\')'
  );

  // Handle $A.util.isEmpty
  converted = converted.replace(/\$A\.util\.isEmpty\s*\(\s*([^)]+)\s*\)/g, '(!$1 || $1.length === 0)');

  // Handle $A.util.isUndefinedOrNull
  converted = converted.replace(
    /\$A\.util\.isUndefinedOrNull\s*\(\s*([^)]+)\s*\)/g,
    '($1 === undefined || $1 === null)'
  );

  // Handle $A.util.addClass
  converted = converted.replace(
    /\$A\.util\.addClass\s*\(\s*([^,]+)\s*,\s*["']([^"']+)["']\s*\)/g,
    '$1.classList.add(\'$2\')'
  );

  // Handle $A.util.removeClass
  converted = converted.replace(
    /\$A\.util\.removeClass\s*\(\s*([^,]+)\s*,\s*["']([^"']+)["']\s*\)/g,
    '$1.classList.remove(\'$2\')'
  );

  // Handle $A.util.toggleClass
  converted = converted.replace(
    /\$A\.util\.toggleClass\s*\(\s*([^,]+)\s*,\s*["']([^"']+)["']\s*\)/g,
    '$1.classList.toggle(\'$2\')'
  );

  // Handle $A.util.hasClass
  converted = converted.replace(
    /\$A\.util\.hasClass\s*\(\s*([^,]+)\s*,\s*["']([^"']+)["']\s*\)/g,
    '$1.classList.contains(\'$2\')'
  );

  // Handle $A.getCallback
  converted = converted.replace(/\$A\.getCallback\s*\(\s*/g, '(');

  // Handle $A.get("$Label.namespace.label")
  converted = converted.replace(
    /\$A\.get\s*\(\s*["']\$Label\.(\w+)\.(\w+)["']\s*\)/g,
    (_match, namespace, label) => {
      const labelImport = `${namespace}.${label}`;
      if (!usedLabels.includes(labelImport)) {
        usedLabels.push(labelImport);
      }
      return `this.label${label}`;
    }
  );

  // Handle force:navigateToSObject
  if (converted.includes('e.force:navigateToSObject')) {
    warnings.push('Navigation event found - use NavigationMixin');
  }

  // Handle force:showToast
  if (converted.includes('e.force:showToast')) {
    warnings.push('Toast event found - use ShowToastEvent from lightning/platformShowToastEvent');
    converted = converted.replace(
      /\$A\.get\s*\(\s*["']e\.force:showToast["']\s*\)/g,
      '/* Use: import { ShowToastEvent } from "lightning/platformShowToastEvent"; */'
    );
  }

  return { converted, warnings, usedLabels };
}

/**
 * Transform Aura controller and helper to LWC class
 */
export function transformAuraController(
  markup: ParsedAuraMarkup,
  controller?: ParsedAuraController,
  helper?: ParsedAuraHelper,
  detectedGetters?: DetectedGetter[]
): TransformedController {
  const warnings: string[] = [];
  const imports: string[] = ['LightningElement'];
  const properties: LwcProperty[] = [];
  const methods: LwcMethod[] = [];
  const apexMethods: string[] = [];
  const wireAdapters: string[] = [];
  const allUsedLabels = new Set<string>();
  let usesNavigation = false;

  // Collect helper function names for reference
  const helperFunctions = new Set<string>();
  if (helper) {
    for (const func of helper.functions) {
      helperFunctions.add(func.name);
    }
  }

  // Process attributes -> properties
  for (const attr of markup.attributes) {
    const isPublic = !attr.access || attr.access === 'public' || attr.access === 'global';

    const prop: LwcProperty = {
      name: attr.name,
      isApi: isPublic,
      isTrack: false,
      type: convertType(attr.type),
      defaultValue: attr.default,
      description: attr.description,
    };

    properties.push(prop);

    if (isPublic) {
      if (!imports.includes('api')) {
        imports.push('api');
      }
    }
  }

  // Process handlers for lifecycle methods
  const initHandler = markup.handlers.find((h) => h.name === 'init');
  const renderHandler = markup.handlers.find(
    (h) => h.name === 'render' || h.name === 'afterRender'
  );
  const destroyHandler = markup.handlers.find((h) => h.name === 'destroy');

  // Process controller functions
  if (controller) {
    for (const func of controller.functions) {
      let methodName = func.name;
      let isLifecycle = false;
      let body = func.body;

      // Check if this is the init handler
      if (initHandler && initHandler.action.includes(func.name)) {
        methodName = 'connectedCallback';
        isLifecycle = true;
      } else if (renderHandler && renderHandler.action.includes(func.name)) {
        methodName = 'renderedCallback';
        isLifecycle = true;
        warnings.push(
          'renderedCallback converted from render handler - add isRendered flag if needed'
        );
      } else if (destroyHandler && destroyHandler.action.includes(func.name)) {
        methodName = 'disconnectedCallback';
        isLifecycle = true;
      }

      // Convert function body
      const { converted, warnings: bodyWarnings, usedLabels } = convertFunctionBody(
        body,
        func,
        helperFunctions
      );
      warnings.push(...bodyWarnings);
      if (usedLabels) {
        usedLabels.forEach(l => allUsedLabels.add(l));
      }

      if (converted.includes('NavigationMixin') || bodyWarnings.some(w => w.includes('NavigationMixin'))) {
        usesNavigation = true;
      }

      // Track server calls as apex methods
      for (const serverCall of func.serverCalls) {
        if (serverCall.controllerMethod && !apexMethods.includes(serverCall.controllerMethod)) {
          apexMethods.push(serverCall.controllerMethod);
        }
      }

      methods.push({
        name: methodName,
        isApi: false,
        body: converted,
        originalAuraMethod: func.name !== methodName ? func.name : undefined,
        isLifecycle,
      });
    }
  }

  // Process helper functions - merge into class
  if (helper) {
    for (const func of helper.functions) {
      // Skip if already added via controller
      if (methods.some((m) => m.name === func.name)) {
        continue;
      }

      const { converted, warnings: bodyWarnings, usedLabels } = convertFunctionBody(
        func.body,
        func,
        helperFunctions
      );
      warnings.push(...bodyWarnings);
      if (usedLabels) {
        usedLabels.forEach(l => allUsedLabels.add(l));
      }

      if (converted.includes('NavigationMixin') || bodyWarnings.some(w => w.includes('NavigationMixin'))) {
        usesNavigation = true;
      }

      // Track server calls
      for (const serverCall of func.serverCalls) {
        if (!apexMethods.includes(serverCall)) {
          apexMethods.push(serverCall);
        }
      }

      methods.push({
        name: func.name,
        isApi: false,
        body: converted,
        isLifecycle: false,
      });
    }
  }

  // Process aura:method declarations -> @api methods
  for (const auraMethod of markup.methods) {
    const existingMethod = methods.find((m) => m.name === auraMethod.name);
    if (existingMethod) {
      existingMethod.isApi = true;
      if (!imports.includes('api')) {
        imports.push('api');
      }
    } else {
      // Method declared but not implemented
      warnings.push(`aura:method "${auraMethod.name}" declared but no implementation found`);
      methods.push({
        name: auraMethod.name,
        isApi: true,
        body: '// TODO: Implement method',
        isLifecycle: false,
      });
      if (!imports.includes('api')) {
        imports.push('api');
      }
    }
  }

  // Check for Apex controller reference
  if (markup.controller) {
    warnings.push(
      `Apex controller "${markup.controller}" referenced - import required methods with @AuraEnabled`
    );
  }

  // Build the JS class
  const className = toPascalCase(markup.componentName);

  let js = '';

  // Add imports
  if (usesNavigation) {
    imports.push('NavigationMixin');
    // NavigationMixin comes from lightning/navigation, not lwc
    // We'll handle it separately in the import string construction
  }

  js += `import { ${imports.filter(i => i !== 'NavigationMixin').join(', ')} } from 'lwc';\n`;

  if (usesNavigation) {
    js += `import { NavigationMixin } from 'lightning/navigation';\n`;
  }

  // Add apex imports as TODOs
  if (apexMethods.length > 0) {
    js += '\n// TODO: Import Apex methods\n';
    for (const method of apexMethods) {
      js += `// import ${method} from '@salesforce/apex/${markup.controller || 'ControllerName'}.${method}';\n`;
    }
  }

  // Add wire adapter imports if needed
  if (wireAdapters.length > 0) {
    js += '\n// Wire adapters\n';
    for (const adapter of wireAdapters) {
      js += `// import { ${adapter} } from 'lightning/ui*Api';\n`;
    }
  }

  // Add label imports
  if (allUsedLabels.size > 0) {
    js += '\n// Label imports\n';
    for (const label of allUsedLabels) {
      const [namespace, labelName] = label.split('.');
      js += `import label${labelName} from '@salesforce/label/${namespace}.${labelName}';\n`;
    }
  }

  js += '\n';
  if (usesNavigation) {
    js += `export default class ${className} extends NavigationMixin(LightningElement) {\n`;
  } else {
    js += `export default class ${className} extends LightningElement {\n`;
  }

  // Add properties
  for (const prop of properties) {
    if (prop.description) {
      js += `    // ${prop.description}\n`;
    }
    if (prop.isApi) {
      js += `    @api `;
    } else {
      js += '    ';
    }
    js += prop.name;
    // Only add default value if it exists and is not empty
    if (prop.defaultValue !== undefined && prop.defaultValue !== '' && prop.defaultValue.trim() !== '') {
      js += ` = ${prop.defaultValue}`;
    }
    js += ';\n';
  }

  if (properties.length > 0) {
    js += '\n';
  }

  // Add getters for complex expressions
  if (detectedGetters && detectedGetters.length > 0) {
    js += '    // Getters for complex expressions detected in markup\n';
    for (const getter of detectedGetters) {
      js += `    get ${getter.name}() {\n`;
      // Convert expression syntax to JS (basic conversion)
      let jsExpr = getter.expression;
      // Replace v.prop with this.prop
      jsExpr = jsExpr.replace(/v\.(\w+)/g, 'this.$1');
      // Replace c.method with this.method
      jsExpr = jsExpr.replace(/c\.(\w+)/g, 'this.$1');
      // Replace !v.prop with !this.prop
      jsExpr = jsExpr.replace(/!v\.(\w+)/g, '!this.$1');

      js += `        return ${jsExpr};\n`;
      js += `    }\n\n`;
    }
  }

  // Add methods
  for (const method of methods) {
    if (method.originalAuraMethod) {
      js += `    // Converted from: ${method.originalAuraMethod}\n`;
    }
    if (method.isApi && !method.isLifecycle) {
      js += '    @api\n';
    }
    js += `    ${method.name}(`;

    // Add event parameter for handlers
    if (!method.isLifecycle && method.body.includes('event')) {
      js += 'event';
    }

    js += ') {\n';
    js += `        ${method.body.split('\n').join('\n        ')}\n`;
    js += '    }\n\n';
  }

  js = js.trimEnd() + '\n}\n';

  logger.debug(`Generated LWC class: ${className}`);
  logger.debug(`${properties.length} properties, ${methods.length} methods`);
  logger.debug(`${warnings.length} warnings generated`);

  return {
    js,
    warnings,
    imports,
    properties,
    methods,
    apexMethods,
    wireAdapters,
  };
}
