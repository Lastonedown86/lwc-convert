/**
 * Generate LWC scaffolding with TODO comments from Aura or VF components
 */

import { ParsedAuraMarkup } from '../parsers/aura/markup-parser';
import { ParsedAuraController } from '../parsers/aura/controller-parser';
import { ParsedAuraHelper } from '../parsers/aura/helper-parser';
import { ParsedAuraStyle, convertAuraStyleToLwc } from '../parsers/aura/style-parser';
import { ParsedVfPage } from '../parsers/vf/page-parser';
import { ParsedApexController } from '../parsers/vf/apex-parser';
import { TransformedMarkup } from '../transformers/aura-to-lwc/markup';
// Controller types available if needed
// import { TransformedController, LwcProperty, LwcMethod } from '../transformers/aura-to-lwc/controller';
import { TransformedVfMarkup } from '../transformers/vf-to-lwc/markup';
import { generateDataAccessLayer } from '../transformers/vf-to-lwc/data-binding';
import { generateAuraToLwcTests, generateBehaviorSpecDocument, GeneratedTest } from './test-generator';
import { generateTestComparison, TestComparisonResult } from './test-comparison';
import { LwcBundle, toPascalCase, toLwcName } from '../utils/file-io';
import { logger } from '../utils/logger';

export interface ScaffoldingOptions {
  componentName: string;
  sourceType: 'aura' | 'vf';
  includeComments: boolean;
  generateTests?: boolean;
}

export interface ScaffoldingResult {
  bundle: LwcBundle;
  notes: string[];
  warnings: string[];
  /** Generated Jest tests for the converted component */
  tests?: GeneratedTest;
  /** Behavior spec document */
  behaviorSpec?: string;
  /** Test comparison data for before/after verification */
  testComparison?: TestComparisonResult;
}

/**
 * Generate LWC meta XML file content
 */
function generateMetaXml(
  _componentName: string,
  options?: {
    apiVersion?: string;
    isExposed?: boolean;
    targets?: string[];
    description?: string;
  }
): string {
  const {
    apiVersion = '62.0',
    isExposed = true,
    targets = ['lightning__RecordPage', 'lightning__AppPage', 'lightning__HomePage'],
    description,
  } = options || {};

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>${apiVersion}</apiVersion>
    <isExposed>${isExposed}</isExposed>`;

  if (description) {
    xml += `\n    <description>${description}</description>`;
  }

  if (targets.length > 0) {
    xml += `\n    <targets>`;
    for (const target of targets) {
      xml += `\n        <target>${target}</target>`;
    }
    xml += `\n    </targets>`;
  }

  xml += `\n</LightningComponentBundle>\n`;

  return xml;
}

/**
 * Generate scaffolding JS from Aura parsed data
 */
function generateAuraScaffoldingJs(
  markup: ParsedAuraMarkup,
  transformedMarkup: TransformedMarkup,
  controller?: ParsedAuraController,
  helper?: ParsedAuraHelper
): { js: string; warnings: string[] } {
  const warnings: string[] = [];
  const className = toPascalCase(markup.componentName);

  const imports: string[] = ['LightningElement'];
  const wireImports: string[] = [];
  const lmsImports: string[] = [];
  const schemaImports: string[] = [];
  const channelImports: string[] = [];
  const apiProperties: string[] = [];
  const reactiveProperties: string[] = [];
  const wireDeclarations: string[] = [];
  const methodStubs: string[] = [];
  const apexImports: string[] = [];
  
  // Track which attributes are used by force:recordData (these should be private)
  const recordDataBindings = new Set<string>();
  for (const rds of transformedMarkup.recordDataServices) {
    recordDataBindings.add(rds.recordIdBinding);
    if (rds.targetFields) recordDataBindings.add(rds.targetFields);
  }

  // Process attributes -> properties
  for (const attr of markup.attributes) {
    // Check if this attribute is used internally by force:recordData or LMS
    const usedByRecordData = recordDataBindings.has(attr.name);
    const isPublic = (!attr.access || attr.access === 'public' || attr.access === 'global') && !usedByRecordData;

    let propCode = '';
    if (attr.description) {
      propCode += `    // ${attr.description}\n`;
    }

    if (isPublic) {
      propCode += `    @api ${attr.name}`;
      if (!imports.includes('api')) imports.push('api');
    } else {
      // Private property - don't use @api
      propCode += `    ${attr.name}`;
    }

    // Only add default value if it exists and is not empty
    if (attr.default !== undefined && attr.default !== '' && attr.default.trim() !== '') {
      propCode += ` = ${attr.default}`;
    }
    propCode += ';';

    if (isPublic) {
      apiProperties.push(propCode);
    } else {
      reactiveProperties.push(propCode);
    }
  }
  
  // Generate LMS code from lightning:messageChannel
  if (transformedMarkup.lmsChannels.length > 0) {
    if (!imports.includes('wire')) imports.push('wire');
    
    for (const lms of transformedMarkup.lmsChannels) {
      const channelVar = lms.channelName.replace(/__c$/i, '').toUpperCase() + '_CHANNEL';
      channelImports.push(`import ${channelVar} from '@salesforce/messageChannel/${lms.channelName}';`);
      
      // Add wire for message context (needed for both publish and subscribe)
      wireDeclarations.push(`    @wire(MessageContext)
    messageContext;`);
      
      // Check if this is publisher-only (no onMessage handler)
      if (lms.isPublisherOnly) {
        // Publisher-only pattern - just need publish(), no subscribe/unsubscribe
        lmsImports.push('publish', 'MessageContext');
        
        // Add publish method
        methodStubs.push(`    // LMS: Publish to ${lms.channelName}
    // Call this method to publish a message, e.g., from an onclick handler
    publishMessage(payload) {
        const message = {
            recordId: payload.recordId,
            // TODO: Add other message fields as needed
        };
        publish(this.messageContext, ${channelVar}, message);
    }`);
      } else {
        // Subscriber pattern - needs full subscribe/unsubscribe lifecycle
        lmsImports.push('publish', 'subscribe', 'unsubscribe', 'MessageContext');
        
        // Add subscription property
        reactiveProperties.push(`    // LMS subscription reference
    _subscription = null;`);
        
        // Generate handleMessage with converted controller logic
        let handleMessageBody = '// TODO: Process message payload';
        if (lms.onMessageHandler && controller) {
          const handlerFunc = controller.functions.find(f => f.name === lms.onMessageHandler);
          if (handlerFunc) {
            // Convert Aura controller code to LWC
            handleMessageBody = convertAuraControllerToLwc(handlerFunc, markup);
          }
        }
        
        // Add LMS lifecycle methods for subscriber
        methodStubs.push(`    // LMS: Subscribe to ${lms.channelName}
    connectedCallback() {
        this.subscribeToMessageChannel();
    }

    disconnectedCallback() {
        this.unsubscribeFromMessageChannel();
    }

    subscribeToMessageChannel() {
        if (!this._subscription) {
            this._subscription = subscribe(
                this.messageContext,
                ${channelVar},
                (message) => this.handleMessage(message)
            );
        }
    }

    unsubscribeFromMessageChannel() {
        unsubscribe(this._subscription);
        this._subscription = null;
    }

    handleMessage(message) {
        ${handleMessageBody}
    }`);
      }
    }
  }
  
  // Generate @wire(getRecord) from force:recordData
  if (transformedMarkup.recordDataServices.length > 0) {
    wireImports.push('getRecord', 'getFieldValue');
    if (!imports.includes('wire')) imports.push('wire');
    
    for (const rds of transformedMarkup.recordDataServices) {
      const targetProp = rds.targetFields || 'record';
      
      // Generate field constants and imports (active, not commented)
      const fieldConstants: string[] = [];
      const fieldImportStatements: string[] = [];
      
      for (const field of rds.fields) {
        const fieldConst = field.toUpperCase().replace(/[^A-Z0-9_]/g, '_') + '_FIELD';
        // Use Contact as default - can be changed based on context
        fieldImportStatements.push(`import ${fieldConst} from '@salesforce/schema/Contact.${field}';`);
        fieldConstants.push(fieldConst);
      }
      
      // Add the imports to schema imports
      schemaImports.push(...fieldImportStatements);
      
      // Generate wire adapter with proper field constants
      const fieldsArray = fieldConstants.join(', ');
      
      // Generate individual getters for each field (proper LWC pattern)
      const fieldGetters = rds.fields.map((field, index) => {
        const getterName = field.charAt(0).toLowerCase() + field.slice(1).replace(/__c$/i, '');
        const fieldConst = fieldConstants[index];
        return `    get ${getterName}() {
        return this.${targetProp}?.data 
            ? getFieldValue(this.${targetProp}.data, ${fieldConst}) 
            : undefined;
    }`;
      }).join('\n\n');
      
      wireDeclarations.push(`    // Converted from force:recordData (aura:id="${rds.auraId}")
    @wire(getRecord, { recordId: '$${rds.recordIdBinding}', fields: [${fieldsArray}] })
    ${targetProp};
    
    // Error getter for wire errors
    get ${targetProp}Error() {
        return this.${targetProp}?.error;
    }

${fieldGetters}`);
    }
  }

  // Process handlers for lifecycle and event methods
  // Check for LMS subscriber lifecycle (subscriber pattern uses connected/disconnected)
  const hasLmsSubscriberLifecycle = transformedMarkup.lmsChannels.some(lms => !lms.isPublisherOnly);
  const initHandler = markup.handlers.find((h) => h.name === 'init');
  const renderHandler = markup.handlers.find(
    (h) => h.name === 'render' || h.name === 'afterRender'
  );
  const destroyHandler = markup.handlers.find((h) => h.name === 'destroy');

  // Find controller functions referenced by handlers
  const controllerFunctions = new Map<string, string>();
  if (controller) {
    for (const func of controller.functions) {
      controllerFunctions.set(func.name, func.body);
    }
  }
  
  // Check if init handler makes Apex calls - if so, convert to @wire instead of connectedCallback
  let initHandlerHasApexCalls = false;
  let initApexMethods: string[] = [];
  if (initHandler && controller) {
    const funcName = initHandler.action.replace('{!c.', '').replace('}', '');
    const initFunc = controller.functions.find(f => f.name === funcName);
    if (initFunc && initFunc.serverCalls.length > 0) {
      initHandlerHasApexCalls = true;
      initApexMethods = initFunc.serverCalls
        .filter(sc => sc.controllerMethod)
        .map(sc => sc.controllerMethod!);
    }
  }
  
  // If init handler calls Apex, generate @wire adapter instead of connectedCallback
  if (initHandlerHasApexCalls && initApexMethods.length > 0) {
    for (const apexMethod of initApexMethods) {
      // Generate wire adapter for the Apex call
      const wireProp = apexMethod.charAt(0).toLowerCase() + apexMethod.slice(1) + 'Result';
      const dataProperty = apexMethod.charAt(0).toLowerCase() + apexMethod.slice(1);
      
      // Add the Apex wire import
      if (markup.controller) {
        apexImports.push(apexMethod);
      }
      
      wireDeclarations.push(`    // Converted from init handler Apex call - data loads automatically
    @wire(${apexMethod})
    ${wireProp};
    
    // Getter to safely access wire data
    get ${dataProperty}() {
        return this.${wireProp}?.data;
    }
    
    get ${wireProp}Error() {
        return this.${wireProp}?.error;
    }`);
    }
    
    warnings.push('Init handler Apex call converted to @wire - data loads automatically, no connectedCallback needed');
  } else if (initHandler && !hasLmsSubscriberLifecycle) {
    // Regular init handler without Apex calls - use connectedCallback
    const funcName = initHandler.action.replace('{!c.', '').replace('}', '');
    methodStubs.push(`    // TODO: Migrate logic from Aura init handler (${funcName})
    connectedCallback() {
        // Original init handler logic goes here
        ${controllerFunctions.has(funcName) ? '// Original body available in controller' : ''}
    }`);
  }

  if (renderHandler) {
    methodStubs.push(`    // TODO: Migrate logic from Aura render/afterRender handler
    // WARNING: renderedCallback fires on every render - use flag for one-time logic
    isRendered = false;

    renderedCallback() {
        if (this.isRendered) return;
        this.isRendered = true;
        // Original render handler logic goes here
    }`);
    warnings.push('Render handler converted - renderedCallback fires on every render, not just initial');
  }

  if (destroyHandler && !hasLmsSubscriberLifecycle) {
    methodStubs.push(`    // TODO: Migrate cleanup logic from Aura destroy handler
    disconnectedCallback() {
        // Clean up event listeners, intervals, subscriptions
    }`);
  }

  // Process controller functions as method stubs
  if (controller) {
    // Get names of handlers already processed
    const processedHandlers = new Set<string>();
    if (initHandler) processedHandlers.add(initHandler.action.replace('{!c.', '').replace('}', ''));
    if (renderHandler) processedHandlers.add(renderHandler.action.replace('{!c.', '').replace('}', ''));
    if (destroyHandler) processedHandlers.add(destroyHandler.action.replace('{!c.', '').replace('}', ''));
    for (const lms of transformedMarkup.lmsChannels) {
      if (lms.onMessageHandler) processedHandlers.add(lms.onMessageHandler);
    }
    
    for (const func of controller.functions) {
      // Skip if already handled
      if (processedHandlers.has(func.name)) {
        continue;
      }

      let paramStr = '';
      if (func.hasEvent) {
        paramStr = 'event';
      }

      methodStubs.push(`    // TODO: Implement - converted from controller.${func.name}
    ${func.name}(${paramStr}) {
        // Original function accessed: ${func.attributeAccess.map((a) => `v.${a.name}`).join(', ') || 'none'}
        // Helper calls: ${func.helperCalls.join(', ') || 'none'}
        // Server calls: ${func.serverCalls.length > 0 ? 'yes' : 'none'}
    }`);

      // Track server calls
      for (const serverCall of func.serverCalls) {
        if (serverCall.controllerMethod) {
          apexImports.push(serverCall.controllerMethod);
        }
      }
    }
  }

  // Process helper functions
  if (helper) {
    for (const func of helper.functions) {
      methodStubs.push(`    // TODO: Implement - merged from helper.${func.name}
    ${func.name}() {
        // This was a helper function, now part of the class
    }`);

      for (const serverCall of func.serverCalls) {
        if (!apexImports.includes(serverCall)) {
          apexImports.push(serverCall);
        }
      }
    }
  }

  // Process aura:method declarations
  for (const method of markup.methods) {
    if (!methodStubs.some((m) => m.includes(`${method.name}(`))) {
      if (!imports.includes('api')) imports.push('api');
      const params = method.attributes.map((a) => a.name).join(', ');
      methodStubs.push(`    // Public method - was aura:method
    @api
    ${method.name}(${params}) {
        // TODO: Implement public method
    }`);
    }
  }

  // Build JS file
  let js = `import { ${imports.join(', ')} } from 'lwc';\n`;
  
  // Add LMS imports
  if (lmsImports.length > 0) {
    // Deduplicate LMS imports
    const uniqueLmsImports = [...new Set(lmsImports)];
    js += `import { ${uniqueLmsImports.join(', ')} } from 'lightning/messageService';\n`;
    for (const channelImport of channelImports) {
      js += `${channelImport}\n`;
    }
  }
  
  // Add wire adapter imports
  if (wireImports.length > 0) {
    // Deduplicate wire imports
    const uniqueWireImports = [...new Set(wireImports)];
    js += `import { ${uniqueWireImports.join(', ')} } from 'lightning/uiRecordApi';\n`;
  }
  
  // Add schema imports (now active imports for detected fields)
  if (schemaImports.length > 0) {
    js += `\n// Field schema imports (verify object name - defaulting to Contact)\n`;
    for (const schemaImport of schemaImports) {
      js += `${schemaImport}\n`;
    }
  }

  // Add Apex import TODOs
  if (apexImports.length > 0 || markup.controller) {
    js += `\n// TODO: Import Apex methods - verify class and method names\n`;
    for (const method of apexImports) {
      js += `// import ${method} from '@salesforce/apex/${markup.controller || 'ControllerName'}.${method}';\n`;
    }
  }

  js += `\nexport default class ${className} extends LightningElement {\n`;

  // Add properties
  if (apiProperties.length > 0) {
    js += `    // Public properties (from aura:attribute)\n`;
    js += apiProperties.join('\n\n') + '\n\n';
  }

  if (reactiveProperties.length > 0) {
    js += `    // Private properties\n`;
    js += reactiveProperties.join('\n\n') + '\n\n';
  }
  
  // Add wire declarations
  if (wireDeclarations.length > 0) {
    js += wireDeclarations.join('\n\n') + '\n\n';
  }

  // Add methods
  if (methodStubs.length > 0) {
    js += methodStubs.join('\n\n') + '\n';
  }

  js += `}\n`;

  return { js, warnings };
}

/**
 * Convert Aura controller function to LWC method body
 */
function convertAuraControllerToLwc(func: ParsedAuraController['functions'][0], _markup: ParsedAuraMarkup): string {
  // Parse the original function body and convert patterns
  let body = func.body || '';
  
  // Convert message.getParam('recordId') -> message.recordId
  body = body.replace(/(\w+)\.getParam\s*\(\s*['"](\w+)['"]\s*\)/g, '$1.$2');
  
  // Convert component.set('v.propName', value) -> this.propName = value
  body = body.replace(/component\.set\s*\(\s*['"]v\.(\w+)['"]\s*,\s*([^)]+)\)/g, 'this.$1 = $2');
  
  // Convert component.get('v.propName') -> this.propName
  body = body.replace(/component\.get\s*\(\s*['"]v\.(\w+)['"]\s*\)/g, 'this.$1');
  
  // Convert component.find('auraId').reloadRecord() -> automatic refresh via reactive property
  // Since we're using @wire with '$contactId', changing contactId will automatically refresh
  if (body.includes('reloadRecord')) {
    body = body.replace(/(\w+)\s*=\s*component\.find\s*\(\s*['"][^'"]+['"]\s*\);?\s*\n?\s*\1\.reloadRecord\s*\(\s*\);?/g, 
      '// Wire will auto-refresh when contactId changes (reactive binding)');
    // Simpler pattern
    body = body.replace(/component\.find\s*\(\s*['"][^'"]+['"]\s*\)\.reloadRecord\s*\(\s*\);?/g, 
      '// Wire will auto-refresh when contactId changes (reactive binding)');
  }
  
  // Convert component.find('auraId') to this.template.querySelector('[data-id="auraId"]')
  body = body.replace(/component\.find\s*\(\s*['"](\w+)['"]\s*\)/g, 
    "this.template.querySelector('[data-id=\"$1\"]')");
  
  // If the body has var declarations, suggest let/const
  body = body.replace(/\bvar\s+/g, 'let ');
  
  // Clean up and format
  const lines = body.split('\n').filter(line => line.trim());
  if (lines.length === 0) {
    return '// TODO: Convert controller logic';
  }
  
  // Indent properly
  return lines.map(line => line.trim()).join('\n        ');
}

/**
 * Extract static resource name from VF expression
 * e.g., "{!URLFOR($Resource.lmsvf, 'lmsvf.css')}" -> { resourceName: 'lmsvf', path: 'lmsvf.css' }
 */
function parseStaticResourceExpression(expr: string): { resourceName: string; path?: string } | null {
  // Match URLFOR($Resource.name, 'path')
  const urlforMatch = expr.match(/URLFOR\s*\(\s*\$Resource\.(\w+)\s*,\s*['"]([^'"]+)['"]\s*\)/i);
  if (urlforMatch) {
    return { resourceName: urlforMatch[1], path: urlforMatch[2] };
  }

  // Match simple $Resource.name
  const simpleMatch = expr.match(/\$Resource\.(\w+)/);
  if (simpleMatch) {
    return { resourceName: simpleMatch[1] };
  }

  return null;
}

/**
 * Generate scaffolding JS from VF parsed data
 */
function generateVfScaffoldingJs(
  vfPage: ParsedVfPage,
  apexController?: ParsedApexController
): { js: string; warnings: string[] } {
  const warnings: string[] = [];
  const className = toPascalCase(vfPage.pageName);

  const dataAccess = generateDataAccessLayer(vfPage, apexController);
  warnings.push(...dataAccess.warnings);

  // Build imports
  const baseImports = ['LightningElement'];
  if (dataAccess.wireDeclarations.length > 0) {
    baseImports.push('wire');
  }

  // Check if we need platformResourceLoader for styles/scripts
  const hasStyles = vfPage.includedStyles.length > 0;
  const hasScripts = vfPage.includedScripts.length > 0;
  const needsResourceLoader = hasStyles || hasScripts;

  // Parse static resource references
  const styleResources: { resourceName: string; path?: string }[] = [];
  const scriptResources: { resourceName: string; path?: string }[] = [];

  for (const style of vfPage.includedStyles) {
    const parsed = parseStaticResourceExpression(style);
    if (parsed) {
      styleResources.push(parsed);
    }
  }

  for (const script of vfPage.includedScripts) {
    const parsed = parseStaticResourceExpression(script);
    if (parsed) {
      scriptResources.push(parsed);
    }
  }

  let js = `import { ${baseImports.join(', ')} } from 'lwc';\n`;

  // Add platformResourceLoader import if needed
  if (needsResourceLoader) {
    const loaderImports: string[] = [];
    if (hasStyles) loaderImports.push('loadStyle');
    if (hasScripts) loaderImports.push('loadScript');
    js += `import { ${loaderImports.join(', ')} } from 'lightning/platformResourceLoader';\n`;
  }

  // Add static resource imports
  const uniqueResources = new Set<string>();
  for (const res of [...styleResources, ...scriptResources]) {
    uniqueResources.add(res.resourceName);
  }
  for (const resourceName of uniqueResources) {
    js += `import ${resourceName}Resource from '@salesforce/resourceUrl/${resourceName}';\n`;
  }

  // Add other imports from data access layer
  for (const imp of dataAccess.imports) {
    js += `${imp}\n`;
  }

  // Add ShowToastEvent import - always needed for handleError method
  js += `import { ShowToastEvent } from 'lightning/platformShowToastEvent';\n`;

  js += `\nexport default class ${className} extends LightningElement {\n`;

  // Add flag for one-time style/script loading
  if (needsResourceLoader) {
    js += `    // Flag to prevent duplicate resource loading\n`;
    js += `    _resourcesLoaded = false;\n\n`;
  }

  // Add properties
  if (dataAccess.properties.length > 0) {
    js += `    // Properties\n`;
    for (const prop of dataAccess.properties) {
      js += `    ${prop}\n\n`;
    }
  }

  // Add wire declarations
  if (dataAccess.wireDeclarations.length > 0) {
    js += `    // Wire adapters\n`;
    for (const wire of dataAccess.wireDeclarations) {
      js += `    ${wire}\n\n`;
    }
  }

  // Add loading state for async operations
  if (vfPage.actionFunctions.length > 0 || vfPage.remoteActions.length > 0) {
    js += `    // Loading state\n`;
    js += `    isLoading = false;\n\n`;
  }

  // Add connectedCallback if page had action
  if (vfPage.pageAttributes.action) {
    js += `    // Page action - runs on component load\n`;
    js += `    connectedCallback() {\n`;
    js += `        // TODO: Implement page load action: ${vfPage.pageAttributes.action}\n`;
    js += `    }\n\n`;
  }

  // Add renderedCallback for loading static resources
  if (needsResourceLoader) {
    js += `    // Load static resources (styles/scripts)\n`;
    js += `    renderedCallback() {\n`;
    js += `        if (this._resourcesLoaded) return;\n`;
    js += `        this._resourcesLoaded = true;\n\n`;

    // Generate loadStyle calls
    if (styleResources.length > 0) {
      js += `        // Load stylesheets\n`;
      js += `        Promise.all([\n`;
      for (const res of styleResources) {
        const resourcePath = res.path
          ? `${res.resourceName}Resource + '/${res.path}'`
          : `${res.resourceName}Resource`;
        js += `            loadStyle(this, ${resourcePath}),\n`;
      }
      js += `        ])\n`;
      js += `            .then(() => {\n`;
      js += `                // Styles loaded successfully\n`;
      js += `            })\n`;
      js += `            .catch(error => {\n`;
      js += `                console.error('Error loading styles:', error);\n`;
      js += `            });\n`;
    }

    // Generate loadScript calls
    if (scriptResources.length > 0) {
      js += `\n        // Load scripts\n`;
      js += `        Promise.all([\n`;
      for (const res of scriptResources) {
        const resourcePath = res.path
          ? `${res.resourceName}Resource + '/${res.path}'`
          : `${res.resourceName}Resource`;
        js += `            loadScript(this, ${resourcePath}),\n`;
      }
      js += `        ])\n`;
      js += `            .then(() => {\n`;
      js += `                // Scripts loaded - initialize any external libraries here\n`;
      js += `            })\n`;
      js += `            .catch(error => {\n`;
      js += `                console.error('Error loading scripts:', error);\n`;
      js += `            });\n`;
    }

    js += `    }\n\n`;
  }

  // Add methods
  if (dataAccess.methods.length > 0) {
    js += `    // Methods\n`;
    for (const method of dataAccess.methods) {
      js += `    ${method}\n\n`;
    }
  }

  // Add error handler
  js += `    // Error handler\n`;
  js += `    handleError(error) {\n`;
  js += `        this.dispatchEvent(\n`;
  js += `            new ShowToastEvent({\n`;
  js += `                title: 'Error',\n`;
  js += `                message: error?.body?.message || 'An error occurred',\n`;
  js += `                variant: 'error'\n`;
  js += `            })\n`;
  js += `        );\n`;
  js += `    }\n`;

  js += `}\n`;

  return { js, warnings };
}

/**
 * Generate LWC scaffolding from Aura component
 */
export function generateAuraScaffolding(
  markup: ParsedAuraMarkup,
  transformedMarkup: TransformedMarkup,
  controller?: ParsedAuraController,
  helper?: ParsedAuraHelper,
  style?: ParsedAuraStyle
): ScaffoldingResult {
  const lwcName = toLwcName(markup.componentName);
  const allWarnings: string[] = [...transformedMarkup.warnings];
  const notes: string[] = [];

  // Generate HTML with comments
  let html = transformedMarkup.html;

  // Generate JS scaffolding
  const { js, warnings: jsWarnings } = generateAuraScaffoldingJs(markup, transformedMarkup, controller, helper);
  allWarnings.push(...jsWarnings);

  // Generate CSS
  let css: string | undefined;
  if (style) {
    css = convertAuraStyleToLwc(style);
    if (style.usesTokens) {
      notes.push('CSS uses design tokens - may need conversion to SLDS or CSS custom properties');
    }
  }

  // Generate meta XML
  const meta = generateMetaXml(lwcName, {
    description: `Converted from Aura component: ${markup.componentName}`,
    targets: markup.implements?.includes('flexipage:availableForAllPageTypes')
      ? ['lightning__RecordPage', 'lightning__AppPage', 'lightning__HomePage']
      : ['lightning__AppPage'],
  });

  // Generate notes
  if (markup.controller) {
    notes.push(`Original Apex controller: ${markup.controller}`);
  }
  if (markup.implements && markup.implements.length > 0) {
    notes.push(`Original interfaces: ${markup.implements.join(', ')}`);
  }
  if (markup.registeredEvents.length > 0) {
    notes.push(
      `Registered events to convert: ${markup.registeredEvents.map((e) => e.name).join(', ')}`
    );
  }
  if (transformedMarkup.usedDirectives.length > 0) {
    notes.push(`LWC directives used: ${transformedMarkup.usedDirectives.join(', ')}`);
  }

  // Add warnings as notes
  for (const warning of allWarnings) {
    notes.push(`WARNING: ${warning}`);
  }

  // Generate Jest tests
  const tests = generateAuraToLwcTests(markup, transformedMarkup, controller);
  const behaviorSpec = generateBehaviorSpecDocument(markup.componentName, tests.behaviorSpecs);

  // Generate before/after test comparison for behavior verification
  const testComparison = generateTestComparison(markup, transformedMarkup, controller, helper);

  logger.debug(`Generated scaffolding for ${lwcName}`);
  logger.debug(`Generated ${tests.behaviorSpecs.length} behavior specs`);
  logger.debug(`Generated ${testComparison.behaviorTests.length} behavior tests for comparison`);

  return {
    bundle: {
      name: lwcName,
      html,
      js,
      css,
      meta,
    },
    notes,
    warnings: allWarnings,
    tests,
    behaviorSpec,
    testComparison,
  };
}

/**
 * Generate LWC scaffolding from VF page
 */
export function generateVfScaffolding(
  vfPage: ParsedVfPage,
  transformedMarkup: TransformedVfMarkup,
  apexController?: ParsedApexController
): ScaffoldingResult {
  const lwcName = toLwcName(vfPage.pageName);
  const allWarnings: string[] = [...transformedMarkup.warnings];
  const notes: string[] = [];

  // Generate JS scaffolding
  const { js, warnings: jsWarnings } = generateVfScaffoldingJs(vfPage, apexController);
  allWarnings.push(...jsWarnings);

  // Generate meta XML
  const targets = [];
  if (vfPage.pageAttributes.standardController) {
    targets.push('lightning__RecordPage');
  }
  targets.push('lightning__AppPage', 'lightning__HomePage');

  const meta = generateMetaXml(lwcName, {
    description: `Converted from Visualforce page: ${vfPage.pageName}`,
    targets,
  });

  // Generate notes
  if (vfPage.pageAttributes.controller) {
    notes.push(`Original controller: ${vfPage.pageAttributes.controller}`);
  }
  if (vfPage.pageAttributes.standardController) {
    notes.push(`Standard controller: ${vfPage.pageAttributes.standardController}`);
  }
  if (vfPage.pageAttributes.extensions && vfPage.pageAttributes.extensions.length > 0) {
    notes.push(`Controller extensions: ${vfPage.pageAttributes.extensions.join(', ')}`);
  }
  if (transformedMarkup.formFields.length > 0) {
    notes.push(
      `Form fields to implement: ${transformedMarkup.formFields.map((f) => f.name).join(', ')}`
    );
  }
  if (vfPage.remoteActions.length > 0) {
    notes.push(
      `Remote actions to convert: ${vfPage.remoteActions.map((ra) => `${ra.controller}.${ra.method}`).join(', ')}`
    );
  }

  // Add warnings as notes
  for (const warning of allWarnings) {
    notes.push(`WARNING: ${warning}`);
  }

  logger.debug(`Generated VF scaffolding for ${lwcName}`);

  return {
    bundle: {
      name: lwcName,
      html: transformedMarkup.html,
      js,
      meta,
    },
    notes,
    warnings: allWarnings,
  };
}
