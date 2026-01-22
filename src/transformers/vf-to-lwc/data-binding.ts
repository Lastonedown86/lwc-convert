/**
 * Transform VF data binding patterns to LWC patterns
 */

import { ParsedVfPage, VfExpression, VfActionFunction } from '../../parsers/vf/page-parser';
import { ParsedApexController, ApexProperty, ApexMethod } from '../../parsers/vf/apex-parser';
import { logger } from '../../utils/logger';

export interface DataBindingTransformation {
  vfExpression: string;
  lwcPattern: 'wire' | 'imperative' | 'property' | 'getter' | 'import';
  code: string;
  imports: string[];
  warnings: string[];
}

export interface ControllerPropertyConversion {
  property: ApexProperty;
  lwcCode: string;
  isWireCandidate: boolean;
  warnings: string[];
}

export interface ControllerMethodConversion {
  method: ApexMethod;
  lwcCode: string;
  importStatement: string;
  isWireCandidate: boolean;
  warnings: string[];
}

export interface LmsSubscriptionBinding {
  channelName: string;
  actionFunctionName: string;
  messageProperty: string;
}

/**
 * Analyze VF page JavaScript for sforce.one.subscribe patterns that call actionFunctions
 * Pattern 1: sforce.one.subscribe(channel, function(message) { actionFunctionName(message.property); })
 * Pattern 2: sforce.one.subscribe(channel, (message) => actionFunc(message.prop))
 * Pattern 3: Config-based: { actionFunction: refreshContactsFunction, lmsSubscribe: sforce.one.subscribe }
 */
function analyzeLmsToActionFunctionBindings(
  customJavaScript: string[],
  actionFunctions: VfActionFunction[]
): LmsSubscriptionBinding[] {
  const bindings: LmsSubscriptionBinding[] = [];
  const actionFunctionNames = new Set(actionFunctions.map(af => af.name));
  
  for (const js of customJavaScript) {
    // Pattern 1 & 2: Direct sforce.one.subscribe(channel, function(message) { actionFunc(message.prop); })
    const subscribePattern = /sforce\.one\.subscribe\s*\(\s*([^,]+),\s*(?:function\s*\(\s*(\w+)\s*\)|(?:\(\s*(\w+)\s*\)\s*=>))/gi;
    let match;
    
    while ((match = subscribePattern.exec(js)) !== null) {
      const channelRef = match[1].trim();
      const messageParam = match[2] || match[3];
      
      // Find the function body after this match
      const afterMatch = js.substring(match.index + match[0].length);
      
      // Look for actionFunction calls in the body
      for (const afName of actionFunctionNames) {
        // Pattern: actionFunctionName(message.propertyName) or actionFunctionName(message['propertyName'])
        const afCallPattern = new RegExp(
          `${afName}\\s*\\(\\s*${messageParam}\\.(\\w+)|${afName}\\s*\\(\\s*${messageParam}\\[['"]([\\w]+)['"]\\]`,
          'i'
        );
        const afMatch = afterMatch.match(afCallPattern);
        
        if (afMatch) {
          const messageProperty = afMatch[1] || afMatch[2];
          bindings.push({
            channelName: channelRef,
            actionFunctionName: afName,
            messageProperty: messageProperty || 'recordId', // Default to recordId
          });
          break; // Found a binding for this subscribe, move to next
        }
        
        // Also check for simpler pattern: just calling the actionFunction with message param
        const simplePattern = new RegExp(`${afName}\\s*\\(\\s*${messageParam}\\s*\\)`, 'i');
        if (simplePattern.test(afterMatch)) {
          bindings.push({
            channelName: channelRef,
            actionFunctionName: afName,
            messageProperty: 'recordId', // Default
          });
          break;
        }
      }
    }
    
    // Pattern 3: Config-based pattern where actionFunction and lmsSubscribe are passed to a config object
    // Example: setPageConfigs({ messageChannel: '...', actionFunction: refreshContactsFunction, lmsSubscribe: sforce.one.subscribe })
    // This indicates the external JS will wire them together, typically with message.recordId
    if (js.includes('lmsSubscribe') && js.includes('sforce.one.subscribe')) {
      // Look for actionFunction: functionName pattern in config objects
      const configActionFunctionPattern = /actionFunction\s*:\s*(\w+)/gi;
      let configMatch;
      
      while ((configMatch = configActionFunctionPattern.exec(js)) !== null) {
        const afName = configMatch[1];
        if (actionFunctionNames.has(afName)) {
          // Check if there's already a binding for this actionFunction
          const existingBinding = bindings.find(b => b.actionFunctionName === afName);
          if (!existingBinding) {
            // This is a config-based pattern - the external JS typically uses message.recordId
            bindings.push({
              channelName: 'config-based',
              actionFunctionName: afName,
              messageProperty: 'recordId', // Standard convention
            });
          }
        }
      }
    }
  }
  
  return bindings;
}

/**
 * Determine if a property should use @wire
 */
function shouldUseWire(property: ApexProperty): boolean {
  // Getters that just return data are good candidates for wire
  // Setters or properties with side effects should use imperative
  return property.hasGetter && !property.hasSetter && property.isPublic;
}

/**
 * Determine if a method should use @wire vs imperative
 */
function shouldMethodUseWire(method: ApexMethod): boolean {
  // Wire is best for:
  // - Methods that take no params or only recordId
  // - Read-only operations
  // - Cacheable methods

  if (method.isCacheable) return true;

  // Methods with many parameters are better suited for imperative
  if (method.parameters.length > 2) return false;

  // Methods that likely modify data (based on name) should be imperative
  const modifyingPrefixes = ['save', 'update', 'delete', 'insert', 'create', 'remove', 'upsert'];
  const nameLower = method.name.toLowerCase();
  if (modifyingPrefixes.some((p) => nameLower.startsWith(p))) return false;

  // Default to wire for simple getters
  return method.parameters.length <= 1 && method.returnType !== 'void';
}

/**
 * Convert VF global variable expression to LWC
 */
export function convertGlobalVariable(
  expression: VfExpression,
  lmsBinding?: LmsSubscriptionBinding
): DataBindingTransformation {
  const imports: string[] = [];
  const warnings: string[] = [];
  let code = '';
  let pattern: DataBindingTransformation['lwcPattern'] = 'property';

  const expr = expression.reference;

  // $CurrentPage.parameters.x or $CurrentPage.Name
  if (expr.includes('$CurrentPage')) {
    pattern = 'wire';
    imports.push("import { CurrentPageReference } from 'lightning/navigation';");

    const paramMatch = expr.match(/\$CurrentPage\.parameters\.(\w+)/);
    const nameMatch = expr.match(/\$CurrentPage\.Name/i);

    if (paramMatch) {
      const paramName = paramMatch[1];
      code = `// Access URL parameter: ${paramName}
@wire(CurrentPageReference)
pageRef;

get ${paramName}() {
    return this.pageRef?.state?.${paramName};
}`;
    } else if (nameMatch) {
      code = `// Access current page name
@wire(CurrentPageReference)
pageRef;

get pageName() {
    return this.pageRef?.attributes?.name || this.pageRef?.state?.c__pageName || '';
}`;
    } else {
      code = `@wire(CurrentPageReference)
pageRef;`;
    }
  }
  // $MessageChannel.Channel_Name__c - Lightning Message Service
  else if (expr.includes('$MessageChannel')) {
    pattern = 'wire';
    const channelMatch = expr.match(/\$MessageChannel\.([^}'"]+)/);
    const channelName = channelMatch ? channelMatch[1] : 'Unknown_Channel__c';
    const channelVar = channelName.replace(/__c$/i, '').toUpperCase() + '_CHANNEL';

    imports.push("import { publish, subscribe, unsubscribe, MessageContext } from 'lightning/messageService';");
    imports.push(`import ${channelVar} from '@salesforce/messageChannel/${channelName}';`);

    // Generate handleMessage body based on LMS binding analysis
    let handleMessageBody: string;
    if (lmsBinding) {
      handleMessageBody = `// Auto-detected from VF: calls ${lmsBinding.actionFunctionName} with message.${lmsBinding.messageProperty}
    if (message.${lmsBinding.messageProperty}) {
        this.${lmsBinding.actionFunctionName}(message.${lmsBinding.messageProperty})
            .then(result => {
                // Update component state with result
                // Example: this.contactRecord = result;
            })
            .catch(error => {
                this.handleError(error);
            });
    }`;
      warnings.push(`LMS handleMessage auto-wired to ${lmsBinding.actionFunctionName}(message.${lmsBinding.messageProperty})`);
    } else {
      handleMessageBody = `// TODO: Handle message payload
    // Example: this.recordId = message.recordId;`;
    }

    code = `// Lightning Message Service: ${channelName}
@wire(MessageContext)
messageContext;

// Subscription reference for cleanup
_subscription = null;

// Lifecycle: Subscribe to message channel
connectedCallback() {
    this.subscribeToMessageChannel();
}

// Lifecycle: Cleanup subscription
disconnectedCallback() {
    this.unsubscribeFromMessageChannel();
}

// Subscribe to messages
subscribeToMessageChannel() {
    if (!this._subscription) {
        this._subscription = subscribe(
            this.messageContext,
            ${channelVar},
            (message) => this.handleMessage(message)
        );
    }
}

// Unsubscribe from messages
unsubscribeFromMessageChannel() {
    unsubscribe(this._subscription);
    this._subscription = null;
}

// Handle incoming messages
handleMessage(message) {
    ${handleMessageBody}
}

// Publish a message
publishMessage(payload) {
    publish(this.messageContext, ${channelVar}, payload);
}`;

    warnings.push(`Lightning Message Service detected: ${channelName} - connectedCallback/disconnectedCallback auto-generated`);
  }
  // $User.x
  else if (expr.includes('$User')) {
    pattern = 'import';
    const fieldMatch = expr.match(/\$User\.(\w+)/);

    if (fieldMatch) {
      const field = fieldMatch[1];
      if (field === 'Id') {
        imports.push("import userId from '@salesforce/user/Id';");
        code = `// Current user ID
userId = userId;`;
      } else {
        imports.push("import { getRecord } from 'lightning/uiRecordApi';");
        imports.push("import userId from '@salesforce/user/Id';");
        imports.push(`import USER_${field.toUpperCase()}_FIELD from '@salesforce/schema/User.${field}';`);
        code = `// Current user ${field}
@wire(getRecord, { recordId: userId, fields: [USER_${field.toUpperCase()}_FIELD] })
user;

get user${field}() {
    return this.user?.data?.fields?.${field}?.value;
}`;
        pattern = 'wire';
      }
    }
  }
  // $Label.namespace.labelName
  else if (expr.includes('$Label')) {
    pattern = 'import';
    const labelMatch = expr.match(/\$Label\.(\w+)\.(\w+)/);
    if (labelMatch) {
      const [, namespace, labelName] = labelMatch;
      imports.push(`import ${labelName} from '@salesforce/label/${namespace}.${labelName}';`);
      code = `// Label: ${namespace}.${labelName}
label = {
    ${labelName}
};`;
    }
  }
  // $Resource.resourceName
  else if (expr.includes('$Resource')) {
    pattern = 'import';
    const resourceMatch = expr.match(/\$Resource\.(\w+)/);
    if (resourceMatch) {
      const resourceName = resourceMatch[1];
      imports.push(`import ${resourceName} from '@salesforce/resourceUrl/${resourceName}';`);
      code = `// Static resource: ${resourceName}
${resourceName}Url = ${resourceName};`;
    }
  }
  // $Action
  else if (expr.includes('$Action')) {
    pattern = 'imperative';
    warnings.push('$Action expressions need NavigationMixin for navigation');
    imports.push("import { NavigationMixin } from 'lightning/navigation';");
    code = `// Navigation action - use NavigationMixin
// Example: this[NavigationMixin.Navigate]({
//     type: 'standard__recordPage',
//     attributes: { recordId: id, actionName: 'view' }
// });`;
  }
  // $ObjectType
  else if (expr.includes('$ObjectType')) {
    pattern = 'import';
    const objectMatch = expr.match(/\$ObjectType\.(\w+)\.fields\.(\w+)/);
    if (objectMatch) {
      const [, objectName, fieldName] = objectMatch;
      imports.push(
        `import ${fieldName.toUpperCase()}_FIELD from '@salesforce/schema/${objectName}.${fieldName}';`
      );
      code = `// Field reference: ${objectName}.${fieldName}
// Use in wire adapter or getFieldValue`;
    }
  } else {
    warnings.push(`Unknown global variable pattern: ${expr}`);
    code = `// TODO: Convert ${expr}`;
  }

  return {
    vfExpression: expression.original,
    lwcPattern: pattern,
    code,
    imports,
    warnings,
  };
}

/**
 * Convert Apex controller property to LWC
 */
export function convertControllerProperty(
  property: ApexProperty,
  controllerName: string
): ControllerPropertyConversion {
  const warnings: string[] = [];
  const isWireCandidate = shouldUseWire(property);

  let code = '';

  if (isWireCandidate) {
    // Use wire adapter
    code = `// Property: ${property.name} (from ${controllerName})
// Option 1: Wire to Apex getter
@wire(get${capitalize(property.name)})
${property.name};

// Option 2: Simple reactive property
${property.name};

// If using wire, add this to imports:
// import get${capitalize(property.name)} from '@salesforce/apex/${controllerName}.get${capitalize(property.name)}';`;
  } else {
    // Use imperative or reactive property
    code = `// Property: ${property.name}
${property.name}${property.initialValue ? ` = ${property.initialValue}` : ''};`;

    if (property.hasSetter) {
      code += `

// This property had a setter in VF - update via method call
async update${capitalize(property.name)}(value) {
    this.${property.name} = value;
    // TODO: If this needs to persist, call Apex method
}`;
    }
  }

  return {
    property,
    lwcCode: code,
    isWireCandidate,
    warnings,
  };
}

/**
 * Convert Apex controller method to LWC
 */
export function convertControllerMethod(
  method: ApexMethod,
  controllerName: string
): ControllerMethodConversion {
  const warnings: string[] = [];
  const isWireCandidate = shouldMethodUseWire(method);

  let importStatement = '';
  let code = '';

  // Check if method already has @AuraEnabled
  if (!method.isAuraEnabled && !method.isRemoteAction) {
    warnings.push(
      `Method "${method.name}" needs @AuraEnabled annotation to be called from LWC`
    );
  }

  importStatement = `import ${method.name} from '@salesforce/apex/${controllerName}.${method.name}';`;

  if (isWireCandidate) {
    // Generate wire-based code
    if (method.parameters.length === 0) {
      code = `// Wired Apex method: ${method.name}
@wire(${method.name})
${method.name}Result;

get ${method.name}Data() {
    return this.${method.name}Result?.data;
}

get ${method.name}Error() {
    return this.${method.name}Result?.error;
}`;
    } else {
      // Wire with parameters
      const params = method.parameters
        .map((p) => `${p.name}: this.${p.name}`)
        .join(', ');
      code = `// Wired Apex method: ${method.name}
@wire(${method.name}, { ${params} })
${method.name}Result;`;
    }

    if (method.isCacheable) {
      code += `

// Note: This method is cacheable. Use refreshApex() to refresh:
// import { refreshApex } from '@salesforce/apex';
// await refreshApex(this.${method.name}Result);`;
    }
  } else {
    // Generate imperative call code
    const params = method.parameters.map((p) => p.name).join(', ');
    const paramObj = method.parameters.length > 0
      ? `{ ${method.parameters.map((p) => p.name).join(', ')} }`
      : '';

    code = `// Imperative Apex call: ${method.name}
async call${capitalize(method.name)}(${params}) {
    try {
        const result = await ${method.name}(${paramObj});
        return result;
    } catch (error) {
        console.error('Error calling ${method.name}:', error);
        throw error;
    }
}`;
  }

  return {
    method,
    lwcCode: code,
    importStatement,
    isWireCandidate,
    warnings,
  };
}

/**
 * Generate complete data access layer for VF page
 */
export function generateDataAccessLayer(
  vfPage: ParsedVfPage,
  apexController?: ParsedApexController
): {
  imports: string[];
  properties: string[];
  methods: string[];
  wireDeclarations: string[];
  warnings: string[];
} {
  const imports: string[] = [];
  const properties: string[] = [];
  const methods: string[] = [];
  const wireDeclarations: string[] = [];
  const warnings: string[] = [];

  // Analyze VF page JavaScript for LMS-to-actionFunction bindings
  const lmsBindings = analyzeLmsToActionFunctionBindings(
    vfPage.customJavaScript,
    vfPage.actionFunctions
  );

  // Process global variable expressions
  const processedExpressions = new Set<string>();
  for (const expr of vfPage.expressions) {
    // Avoid processing the same expression multiple times
    if (processedExpressions.has(expr.reference)) continue;
    processedExpressions.add(expr.reference);

    if (expr.type === 'global' || expr.reference.includes('$MessageChannel')) {
      // Find matching LMS binding for this MessageChannel
      let matchingBinding: LmsSubscriptionBinding | undefined;
      if (expr.reference.includes('$MessageChannel')) {
        matchingBinding = lmsBindings.find(b => {
          // The binding channelName might be a variable reference or the actual channel name
          return lmsBindings.length > 0; // Use first binding if any exist
        });
        if (lmsBindings.length > 0 && !matchingBinding) {
          matchingBinding = lmsBindings[0]; // Default to first binding
        }
      }
      
      const conversion = convertGlobalVariable(expr, matchingBinding);
      imports.push(...conversion.imports);
      if (conversion.lwcPattern === 'wire') {
        wireDeclarations.push(conversion.code);
      } else {
        properties.push(conversion.code);
      }
      warnings.push(...conversion.warnings);
    }
  }

  // Process Remote Objects from VF components
  const remoteObjects = findRemoteObjects(vfPage.components);
  if (remoteObjects.length > 0) {
    for (const ro of remoteObjects) {
      const fields = ro.fields.split(',').map(f => f.trim());
      const objectNameLower = ro.objectName.toLowerCase();

      // Generate wire adapter scaffolding
      wireDeclarations.push(`// Wire adapter for ${ro.objectName} (converted from apex:remoteObjectModel)
// TODO: Create Apex controller method to replace Remote Objects
//
// Example Apex controller:
// @AuraEnabled(cacheable=true)
// public static List<${ro.objectName}> get${ro.objectName}s() {
//     return [SELECT ${ro.fields} FROM ${ro.objectName} LIMIT 10];
// }
//
// @wire(get${ro.objectName}s)
// ${objectNameLower}s;
//
// Or use lightning/uiRecordApi for standard objects:
// import { getRecords } from 'lightning/uiRecordApi';
`);

      imports.push(`// import get${ro.objectName}s from '@salesforce/apex/YourController.get${ro.objectName}s';`);

      warnings.push(`Remote Object "${ro.objectName}" detected - create Apex controller method to replace`);
    }
  }

  // Process Apex controller if available
  if (apexController) {
    // Process properties
    for (const prop of apexController.properties) {
      const conversion = convertControllerProperty(prop, apexController.className);
      if (conversion.isWireCandidate) {
        wireDeclarations.push(conversion.lwcCode);
      } else {
        properties.push(conversion.lwcCode);
      }
      warnings.push(...conversion.warnings);
    }

    // Process methods
    for (const method of apexController.methods) {
      if (method.isPublic || method.isAuraEnabled || method.isRemoteAction) {
        const conversion = convertControllerMethod(method, apexController.className);
        imports.push(conversion.importStatement);
        if (conversion.isWireCandidate) {
          wireDeclarations.push(conversion.lwcCode);
        } else {
          methods.push(conversion.lwcCode);
        }
        warnings.push(...conversion.warnings);
      }
    }

    // Note about SOQL queries
    if (apexController.soqlQueries.length > 0) {
      warnings.push(
        `Controller has ${apexController.soqlQueries.length} SOQL queries - ensure FLS/CRUD checks are in place`
      );
    }

    // Note about DML operations
    if (apexController.dmlOperations.length > 0) {
      warnings.push(
        `Controller has DML operations (${apexController.dmlOperations.join(', ')}) - these should use imperative calls`
      );
    }
  }

  // Process remote actions from VF page
  for (const ra of vfPage.remoteActions) {
    warnings.push(
      `RemoteAction "${ra.controller}.${ra.method}" - add @AuraEnabled annotation and import`
    );
    imports.push(`// import ${ra.method} from '@salesforce/apex/${ra.controller}.${ra.method}';`);
  }

  // Process action functions
  // Action functions with parameters should use imperative Apex pattern instead of wire
  for (const af of vfPage.actionFunctions) {
    // Check if this action function has parameters (apex:param children)
    const hasParams = findActionFunctionParams(vfPage.components, af.name);
    
    if (hasParams.length > 0) {
      // Use imperative pattern for actionFunction with params
      const paramNames = hasParams.map(p => p.name);
      const paramDeclaration = paramNames.join(', ');
      const paramObject = paramNames.length > 0 
        ? `{ ${paramNames.join(', ')} }` 
        : '';
      
      // Extract the method name from the action (e.g., "{!doSomething}" -> "doSomething")
      const methodName = extractMethodFromAction(af.action);
      
      methods.push(`// Converted from apex:actionFunction "${af.name}" (imperative - has parameters)
// Parameters: ${paramNames.join(', ')}
async ${af.name}(${paramDeclaration}) {
    this.isLoading = true;
    try {
        const result = await ${methodName || af.name}(${paramObject});
        ${af.rerender ? `// Originally rerendered: ${af.rerender} - update reactive properties to trigger re-render` : ''}
        ${af.oncomplete ? `// Original oncomplete callback: ${af.oncomplete}` : ''}
        return result;
    } catch (error) {
        console.error('Error calling ${af.name}:', error);
        throw error;
    } finally {
        this.isLoading = false;
    }
}`);

      // Add import for the Apex method if we can determine the controller
      if (methodName && apexController) {
        imports.push(`import ${methodName} from '@salesforce/apex/${apexController.className}.${methodName}';`);
      } else if (methodName) {
        imports.push(`// import ${methodName} from '@salesforce/apex/YourController.${methodName}';`);
      }
      
      warnings.push(`actionFunction "${af.name}" has ${hasParams.length} parameters - using imperative Apex pattern`);
    } else {
      // Simple action function without params can potentially use wire (but still default to imperative for consistency)
      methods.push(`// Converted from apex:actionFunction "${af.name}"
async ${af.name}() {
    this.isLoading = true;
    try {
        // TODO: Implement - original action: ${af.action}
        ${af.rerender ? `// Originally rerendered: ${af.rerender}` : ''}
        ${af.oncomplete ? `// Had oncomplete: ${af.oncomplete}` : ''}
    } catch (error) {
        console.error('Error calling ${af.name}:', error);
        throw error;
    } finally {
        this.isLoading = false;
    }
}`);
    }
  }

  // Deduplicate imports
  const uniqueImports = [...new Set(imports)];

  return {
    imports: uniqueImports,
    properties,
    methods,
    wireDeclarations,
    warnings,
  };
}

/**
 * Helper: capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Find Remote Objects in VF components
 */
interface RemoteObjectInfo {
  objectName: string;
  fields: string;
}

function findRemoteObjects(components: import('../../parsers/vf/page-parser').VfComponent[]): RemoteObjectInfo[] {
  const remoteObjects: RemoteObjectInfo[] = [];

  function traverse(comp: import('../../parsers/vf/page-parser').VfComponent): void {
    if (comp.name.toLowerCase() === 'apex:remoteobjectmodel') {
      const objectName = comp.attributes.name || 'Unknown';
      const fields = comp.attributes.fields || 'Id';
      remoteObjects.push({ objectName, fields });
    }

    // Check children
    for (const child of comp.children) {
      traverse(child);
    }
  }

  for (const comp of components) {
    traverse(comp);
  }

  return remoteObjects;
}

/**
 * Find apex:param children of a specific actionFunction
 */
interface ActionParam {
  name: string;
  value?: string;
  assignTo?: string;
}

function findActionFunctionParams(
  components: import('../../parsers/vf/page-parser').VfComponent[],
  actionFunctionName: string
): ActionParam[] {
  const params: ActionParam[] = [];

  function traverse(comp: import('../../parsers/vf/page-parser').VfComponent): void {
    const lowerName = comp.name.toLowerCase();
    
    // Found the action function
    if (lowerName === 'apex:actionfunction' && comp.attributes.name === actionFunctionName) {
      // Look for apex:param children
      for (const child of comp.children) {
        if (child.name.toLowerCase() === 'apex:param') {
          const param: ActionParam = {
            name: child.attributes.name || child.attributes.assignto?.replace(/\{!|\}/g, '') || 'param',
            value: child.attributes.value,
            assignTo: child.attributes.assignto,
          };
          params.push(param);
        }
      }
      return;
    }

    // Keep searching in children
    for (const child of comp.children) {
      traverse(child);
    }
  }

  for (const comp of components) {
    traverse(comp);
  }

  return params;
}

/**
 * Extract method name from VF action expression
 * e.g., "{!doSomething}" -> "doSomething"
 *       "{!controller.myMethod}" -> "myMethod"
 */
function extractMethodFromAction(action: string): string | null {
  if (!action) return null;
  
  // Remove {! and } delimiters
  const cleaned = action.replace(/\{!|\}/g, '').trim();
  
  // Handle controller.method pattern
  if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    return parts[parts.length - 1];
  }
  
  return cleaned;
}
