/**
 * Generate full LWC conversion with complete code transformation
 */

import { ParsedAuraMarkup } from '../parsers/aura/markup-parser';
import { ParsedAuraController } from '../parsers/aura/controller-parser';
import { ParsedAuraHelper } from '../parsers/aura/helper-parser';
import { ParsedAuraStyle, convertAuraStyleToLwc } from '../parsers/aura/style-parser';
import { ParsedVfPage } from '../parsers/vf/page-parser';
import { ParsedApexController } from '../parsers/vf/apex-parser';
import { transformAuraMarkup } from '../transformers/aura-to-lwc/markup';
import { transformAuraController } from '../transformers/aura-to-lwc/controller';
import { transformAuraEvent, transformEventHandler } from '../transformers/aura-to-lwc/events';
import { transformVfMarkup } from '../transformers/vf-to-lwc/markup';
import { generateDataAccessLayer } from '../transformers/vf-to-lwc/data-binding';
import { generateAuraToLwcTests, generateBehaviorSpecDocument, GeneratedTest } from './test-generator';
import { LwcBundle, toPascalCase, toLwcName } from '../utils/file-io';
import { logger } from '../utils/logger';
import {
  ConversionConfidence,
  ConfidenceFactor,
  aggregateConfidence,
  calculateComponentsConfidence,
  calculateExpressionsConfidence,
  calculateDataBindingConfidence,
  calculateApexConfidence,
  formatConfidenceScore,
} from '../utils/confidence-scorer';

export interface FullConversionResult {
  bundle: LwcBundle;
  notes: string[];
  warnings: string[];
  reviewItems: ReviewItem[];
  /** Conversion confidence metrics */
  confidence: ConversionConfidence;
  /** Generated Jest tests for the converted component */
  tests?: GeneratedTest;
  /** Behavior spec document mapping Aura patterns to LWC equivalents */
  behaviorSpec?: string;
  /** Test comparison data for before/after verification */
  testComparison?: import('./test-comparison').TestComparisonResult;
}

export interface ReviewItem {
  type: 'warning' | 'review' | 'todo';
  location: string;
  message: string;
  suggestion?: string;
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
    masterLabel?: string;
  }
): string {
  const {
    apiVersion = '59.0',
    isExposed = true,
    targets = ['lightning__RecordPage', 'lightning__AppPage', 'lightning__HomePage'],
    description,
    masterLabel,
  } = options || {};

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>${apiVersion}</apiVersion>
    <isExposed>${isExposed}</isExposed>`;

  if (description) {
    xml += `\n    <description>${escapeXml(description)}</description>`;
  }

  if (masterLabel) {
    xml += `\n    <masterLabel>${escapeXml(masterLabel)}</masterLabel>`;
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
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
 * Post-process JS to add REVIEW comments for edge cases
 */
function addReviewComments(js: string, reviewItems: ReviewItem[]): string {
  let result = js;

  // Add header comment if there are review items
  if (reviewItems.length > 0) {
    const headerComment = `/**
 * CONVERSION REVIEW ITEMS:
${reviewItems.map((item, i) => ` * ${i + 1}. [${item.type.toUpperCase()}] ${item.message}`).join('\n')}
 */\n\n`;
    result = headerComment + result;
  }

  return result;
}

/**
 * Full conversion for Aura component
 */
export function generateAuraFullConversion(
  markup: ParsedAuraMarkup,
  controller?: ParsedAuraController,
  helper?: ParsedAuraHelper,
  style?: ParsedAuraStyle
): FullConversionResult {
  const lwcName = toLwcName(markup.componentName);
  const reviewItems: ReviewItem[] = [];
  const notes: string[] = [];

  // Transform markup
  const transformedMarkup = transformAuraMarkup(markup);
  for (const warning of transformedMarkup.warnings) {
    reviewItems.push({
      type: 'review',
      location: 'HTML Template',
      message: warning,
    });
  }

  // Transform controller and helper
  const transformedController = transformAuraController(
    markup,
    controller,
    helper,
    transformedMarkup.detectedGetters
  );
  for (const warning of transformedController.warnings) {
    reviewItems.push({
      type: 'review',
      location: 'JavaScript',
      message: warning,
    });
  }

  // Handle event transformations
  for (const event of markup.registeredEvents) {
    const relatedHandler = markup.handlers.find(
      (h) => h.event === event.type || h.event.endsWith(`:${event.name}`)
    );
    const eventTransform = transformAuraEvent(event, relatedHandler);

    for (const warning of eventTransform.warnings) {
      reviewItems.push({
        type: 'warning',
        location: 'Events',
        message: warning,
        suggestion: eventTransform.code.dispatch,
      });
    }
  }

  // Transform event handlers in markup
  for (const handler of markup.handlers) {
    if (
      handler.name !== 'init' &&
      handler.name !== 'render' &&
      handler.name !== 'afterRender' &&
      handler.name !== 'destroy'
    ) {
      const { warnings } = transformEventHandler(handler);
      for (const warning of warnings) {
        reviewItems.push({
          type: 'review',
          location: 'Event Handler',
          message: warning,
        });
      }
    }
  }

  // Add REVIEW comments to JS
  let js = transformedController.js;
  js = addReviewComments(js, reviewItems.filter((r) => r.location === 'JavaScript'));

  // Transform CSS
  let css: string | undefined;
  if (style) {
    css = convertAuraStyleToLwc(style);
    if (style.usesThisSelector) {
      notes.push('CSS .THIS selectors converted to :host and removed where appropriate');
    }
    if (style.usesTokens) {
      reviewItems.push({
        type: 'todo',
        location: 'CSS',
        message: `Design tokens used: ${style.tokenReferences.join(', ')}`,
        suggestion: 'Convert to SLDS design tokens or CSS custom properties',
      });
    }
  }

  // Generate meta XML with appropriate targets
  const targets: string[] = [];
  if (markup.implements) {
    if (markup.implements.some((i) => i.includes('flexipage'))) {
      targets.push('lightning__RecordPage', 'lightning__AppPage', 'lightning__HomePage');
    }
    if (markup.implements.some((i) => i.includes('lightning:isUrlAddressable'))) {
      notes.push('Component is URL addressable - configure in Experience Builder or via NavigationMixin');
    }
    if (markup.implements.some((i) => i.includes('force:hasRecordId'))) {
      notes.push('Component uses recordId - ensure @api recordId is properly wired');
    }
    if (markup.implements.some((i) => i.includes('force:hasSObjectName'))) {
      notes.push('Component uses sObjectName - add @api objectApiName if needed');
    }
  }
  if (targets.length === 0) {
    targets.push('lightning__AppPage');
  }

  const meta = generateMetaXml(lwcName, {
    description: `Full conversion from Aura: ${markup.componentName}`,
    targets,
    masterLabel: markup.componentName,
  });

  // Compile notes
  notes.push(`Component: ${markup.componentName} -> ${lwcName}`);
  if (transformedController.apexMethods.length > 0) {
    notes.push(`Apex methods to import: ${transformedController.apexMethods.join(', ')}`);
  }
  if (transformedMarkup.usedComponents.length > 0) {
    notes.push(`Lightning components used: ${transformedMarkup.usedComponents.join(', ')}`);
  }

  logger.debug(`Full conversion completed for ${lwcName}`);
  logger.debug(`${reviewItems.length} items need review`);

  // Aura conversions are generally high confidence - create default
  const confidence: ConversionConfidence = {
    overall: 85,
    level: 'high',
    factors: [],
    summary: 'Aura to LWC conversion is well-supported with direct mappings.',
    breakdown: { components: 85, dataBinding: 85, expressions: 85, apex: 85 },
  };

  // Generate tests and behavior spec
  const tests = generateAuraToLwcTests(markup, transformedMarkup, controller);
  const behaviorSpec = generateBehaviorSpecDocument(markup.componentName, tests.behaviorSpecs);

  return {
    bundle: {
      name: lwcName,
      html: transformedMarkup.html,
      js,
      css,
      meta,
    },
    notes,
    warnings: reviewItems.filter((r) => r.type === 'warning').map((r) => r.message),
    reviewItems,
    confidence,
    tests,
    behaviorSpec,
  };
}

/**
 * Full conversion for VF page
 */
export function generateVfFullConversion(
  vfPage: ParsedVfPage,
  apexController?: ParsedApexController
): FullConversionResult {
  const lwcName = toLwcName(vfPage.pageName);
  const reviewItems: ReviewItem[] = [];
  const notes: string[] = [];

  // Transform markup
  const transformedMarkup = transformVfMarkup(vfPage);
  for (const warning of transformedMarkup.warnings) {
    reviewItems.push({
      type: 'review',
      location: 'HTML Template',
      message: warning,
    });
  }

  // Generate data access layer
  const dataAccess = generateDataAccessLayer(vfPage, apexController);
  for (const warning of dataAccess.warnings) {
    reviewItems.push({
      type: 'review',
      location: 'Data Access',
      message: warning,
    });
  }

  // Calculate confidence factors
  const confidenceFactors: ConfidenceFactor[] = [];

  // Component confidence
  const componentNames = vfPage.components.map((c) => c.name);
  confidenceFactors.push(...calculateComponentsConfidence(componentNames));

  // Expression confidence
  const expressions = vfPage.expressions.map((e) => e.original);
  confidenceFactors.push(...calculateExpressionsConfidence(expressions));

  // Data binding confidence
  confidenceFactors.push(
    ...calculateDataBindingConfidence({
      hasWireAdapters: dataAccess.wireDeclarations.length > 0,
      hasImperativeApex: dataAccess.methods.length > 0,
      hasRemoteActions: vfPage.remoteActions.length > 0,
      hasActionFunctions: vfPage.actionFunctions.length > 0,
      actionFunctionsWithParams: vfPage.actionFunctions.filter(
        (af) => af.rerender || af.oncomplete
      ).length,
      hasRemoteObjects: vfPage.components.some(
        (c) => c.name.toLowerCase() === 'apex:remoteobjects'
      ),
    })
  );

  // Apex controller confidence
  if (apexController) {
    confidenceFactors.push(
      ...calculateApexConfidence({
        totalMethods: apexController.methods.length,
        auraEnabledMethods: apexController.methods.filter((m) => m.isAuraEnabled).length,
        remoteActionMethods: apexController.methods.filter((m) => m.isRemoteAction).length,
        hasSoqlQueries: apexController.soqlQueries.length > 0,
        hasDmlOperations: apexController.dmlOperations.length > 0,
        controllerAvailable: true,
      })
    );
  } else if (vfPage.pageAttributes.controller) {
    // Controller referenced but not provided
    confidenceFactors.push(
      ...calculateApexConfidence({
        totalMethods: 0,
        auraEnabledMethods: 0,
        remoteActionMethods: 0,
        hasSoqlQueries: false,
        hasDmlOperations: false,
        controllerAvailable: false,
      })
    );
  }

  // Aggregate confidence
  const confidence = aggregateConfidence(confidenceFactors);

  // Build complete JS
  const className = toPascalCase(vfPage.pageName);
  const baseImports = ['LightningElement'];
  if (dataAccess.wireDeclarations.length > 0) {
    baseImports.push('wire');
  }
  // Check if any properties use @api
  const hasApiProps = vfPage.pageAttributes.standardController;
  if (hasApiProps) {
    baseImports.push('api');
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

  // Add imports
  for (const imp of dataAccess.imports) {
    if (imp.startsWith('//')) {
      js += `${imp}\n`;
    } else {
      js += `${imp}\n`;
    }
  }

  // Add platform imports
  if (
    transformedMarkup.usedComponents.includes('lightning-record-edit-form') ||
    transformedMarkup.usedComponents.includes('lightning-record-form')
  ) {
    js += `// For record forms - verify these are needed\n`;
    js += `// import { getRecord, getFieldValue } from 'lightning/uiRecordApi';\n`;
  }

  // Always import ShowToastEvent - needed for handleError method
  js += `import { ShowToastEvent } from 'lightning/platformShowToastEvent';\n`;

  js += `\nexport default class ${className} extends LightningElement {\n`;

  // Add flag for one-time style/script loading
  if (needsResourceLoader) {
    js += `    // Flag to prevent duplicate resource loading\n`;
    js += `    _resourcesLoaded = false;\n\n`;
  }

  // Add recordId if standard controller
  if (vfPage.pageAttributes.standardController) {
    js += `    @api recordId;\n`;
    js += `    @api objectApiName = '${vfPage.pageAttributes.standardController}';\n\n`;
    notes.push(`Standard controller object: ${vfPage.pageAttributes.standardController}`);
  }

  // Add properties
  if (dataAccess.properties.length > 0) {
    for (const prop of dataAccess.properties) {
      const lines = prop.split('\n');
      for (const line of lines) {
        js += `    ${line}\n`;
      }
      js += '\n';
    }
  }

  // Add controller property bindings detected from VF expressions
  if (transformedMarkup.controllerProperties.length > 0) {
    js += `    // Controller properties detected from VF bindings\n`;
    for (const prop of transformedMarkup.controllerProperties) {
      js += `    ${prop.name} = null; // Fields used: ${prop.fields.join(', ')}\n`;
    }
    js += '\n';
  }

  // Add loading state
  if (vfPage.actionFunctions.length > 0 || vfPage.remoteActions.length > 0) {
    js += `    isLoading = false;\n\n`;
  }

  // Add wire declarations
  if (dataAccess.wireDeclarations.length > 0) {
    for (const wire of dataAccess.wireDeclarations) {
      const lines = wire.split('\n');
      for (const line of lines) {
        js += `    ${line}\n`;
      }
      js += '\n';
    }
  }

  // Add getters for VF formula expressions (NOT, ISBLANK, AND, OR, etc.)
  if (transformedMarkup.detectedFormulas.length > 0) {
    js += `    // Getters converted from VF formula expressions\n`;
    for (const formula of transformedMarkup.detectedFormulas) {
      js += `    /**\n`;
      js += `     * Converted from VF: {!${formula.original}}\n`;
      js += `     */\n`;
      js += `    get ${formula.getterName}() {\n`;
      js += `        ${formula.suggestedLogic}\n`;
      js += `    }\n\n`;
    }
  }

  // Add connectedCallback if page had action
  if (vfPage.pageAttributes.action) {
    js += `    // Runs on component load (from page action attribute)\n`;
    js += `    connectedCallback() {\n`;
    js += `        this.initializeData();\n`;
    js += `    }\n\n`;
    js += `    async initializeData() {\n`;
    js += `        this.isLoading = true;\n`;
    js += `        try {\n`;
    js += `            // REVIEW: Original page action: ${vfPage.pageAttributes.action}\n`;
    js += `            // TODO: Implement initialization logic\n`;
    js += `        } catch (error) {\n`;
    js += `            this.handleError(error);\n`;
    js += `        } finally {\n`;
    js += `            this.isLoading = false;\n`;
    js += `        }\n`;
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
    for (const method of dataAccess.methods) {
      const lines = method.split('\n');
      for (const line of lines) {
        js += `    ${line}\n`;
      }
      js += '\n';
    }
  }

  // Add error handler
  js += `    handleError(error) {\n`;
  js += `        console.error('Error:', error);\n`;
  js += `        this.dispatchEvent(\n`;
  js += `            new ShowToastEvent({\n`;
  js += `                title: 'Error',\n`;
  js += `                message: error?.body?.message || error?.message || 'An error occurred',\n`;
  js += `                variant: 'error'\n`;
  js += `            })\n`;
  js += `        );\n`;
  js += `    }\n`;

  js += `}\n`;

  // Add review comments
  js = addReviewComments(js, reviewItems.filter((r) => r.location !== 'HTML Template'));

  // Determine targets
  const targets: string[] = [];
  if (vfPage.pageAttributes.standardController) {
    targets.push('lightning__RecordPage');
  }
  targets.push('lightning__AppPage', 'lightning__HomePage');

  // Generate meta XML
  const meta = generateMetaXml(lwcName, {
    description: `Full conversion from VF page: ${vfPage.pageName}`,
    targets,
    masterLabel: vfPage.pageName,
  });

  // Compile notes
  notes.push(`Page: ${vfPage.pageName} -> ${lwcName}`);
  if (vfPage.pageAttributes.controller) {
    notes.push(`Custom controller: ${vfPage.pageAttributes.controller}`);
  }
  if (vfPage.pageAttributes.extensions) {
    notes.push(`Extensions: ${vfPage.pageAttributes.extensions.join(', ')}`);
  }
  if (transformedMarkup.usedComponents.length > 0) {
    notes.push(`Lightning components used: ${transformedMarkup.usedComponents.join(', ')}`);
  }
  if (transformedMarkup.dataTableColumns.length > 0) {
    notes.push(`Data table columns generated: ${transformedMarkup.dataTableColumns.length}`);
  }
  if (apexController) {
    notes.push(`Apex methods available: ${apexController.methods.filter((m) => m.isPublic).map((m) => m.name).join(', ')}`);
  }

  logger.debug(`Full VF conversion completed for ${lwcName}`);
  logger.debug(`${reviewItems.length} items need review`);
  logger.debug(`Confidence: ${formatConfidenceScore(confidence)}`);

  return {
    bundle: {
      name: lwcName,
      html: transformedMarkup.html,
      js,
      meta,
    },
    notes,
    warnings: reviewItems.filter((r) => r.type === 'warning').map((r) => r.message),
    reviewItems,
    confidence,
  };
}
