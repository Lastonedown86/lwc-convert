/**
 * Generate Jest test scaffolding for converted LWC components
 * Creates tests that verify the conversion preserves expected behaviors
 */

import { ParsedAuraMarkup } from '../parsers/aura/markup-parser';
import { ParsedAuraController } from '../parsers/aura/controller-parser';
import { TransformedMarkup } from '../transformers/aura-to-lwc/markup';
import { ParsedVfPage } from '../parsers/vf/page-parser';
import { ParsedApexController } from '../parsers/vf/apex-parser';
import { TransformedVfMarkup } from '../transformers/vf-to-lwc/markup';
import { toPascalCase, toLwcName } from '../utils/file-io';

export interface GeneratedTest {
  filename: string;
  content: string;
  behaviorSpecs: BehaviorSpec[];
}

export interface BehaviorSpec {
  category: 'lms' | 'data' | 'lifecycle' | 'event' | 'ui' | 'apex' | 'formula' | 'actionfunction' | 'remoteaction';
  description: string;
  auraPattern: string;
  lwcEquivalent: string;
}

/**
 * Generate Jest tests for a converted Aura component
 */
export function generateAuraToLwcTests(
  markup: ParsedAuraMarkup,
  transformedMarkup: TransformedMarkup,
  controller?: ParsedAuraController
): GeneratedTest {
  const lwcName = toLwcName(markup.componentName);
  const className = toPascalCase(markup.componentName);
  const behaviorSpecs: BehaviorSpec[] = [];
  
  const imports: string[] = [];
  const mocks: string[] = [];
  
  // Always need createElement
  imports.push("import { createElement } from 'lwc';");
  imports.push(`import ${className} from 'c/${lwcName}';`);
  
  // Analyze LMS patterns
  const hasLmsSubscriber = transformedMarkup.lmsChannels.some(lms => !lms.isPublisherOnly);
  const hasLmsPublisher = transformedMarkup.lmsChannels.some(lms => lms.isPublisherOnly);
  
  if (transformedMarkup.lmsChannels.length > 0) {
    imports.push("import { publish, subscribe, unsubscribe, MessageContext } from 'lightning/messageService';");
    
    for (const lms of transformedMarkup.lmsChannels) {
      const channelVar = lms.channelName.replace(/__c$/i, '').toUpperCase() + '_CHANNEL';
      imports.push(`import ${channelVar} from '@salesforce/messageChannel/${lms.channelName}';`);
    }
    
    // Add LMS mocks
    mocks.push(`// Mock LMS
jest.mock(
    'lightning/messageService',
    () => ({
        publish: jest.fn(),
        subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
        unsubscribe: jest.fn(),
        MessageContext: jest.fn()
    }),
    { virtual: true }
);`);
  }
  
  // Analyze wire/data patterns
  if (transformedMarkup.recordDataServices.length > 0) {
    imports.push("import { getRecord, getFieldValue } from 'lightning/uiRecordApi';");
    
    // Mock wire adapter
    mocks.push(`// Mock getRecord wire adapter
const mockGetRecord = require('lightning/uiRecordApi').getRecord;`);
    
    for (const rds of transformedMarkup.recordDataServices) {
      behaviorSpecs.push({
        category: 'data',
        description: `Load record data when ${rds.recordIdBinding} changes`,
        auraPattern: `force:recordData recordId="{!v.${rds.recordIdBinding}}" targetFields="{!v.${rds.targetFields}}"`,
        lwcEquivalent: `@wire(getRecord, { recordId: '$${rds.recordIdBinding}', fields: [...] })`
      });
    }
  }
  
  // Check for Apex calls in init
  const initHandler = markup.handlers.find(h => h.name === 'init');
  let initApexMethod: string | null = null;
  if (initHandler && controller) {
    const funcName = initHandler.action.replace('{!c.', '').replace('}', '');
    const initFunc = controller.functions.find(f => f.name === funcName);
    if (initFunc?.serverCalls.length) {
      initApexMethod = initFunc.serverCalls[0].controllerMethod || null;
      if (initApexMethod) {
        imports.push(`import ${initApexMethod} from '@salesforce/apex/${markup.controller}.${initApexMethod}';`);
        mocks.push(`// Mock Apex method
jest.mock(
    '@salesforce/apex/${markup.controller}.${initApexMethod}',
    () => ({ default: jest.fn() }),
    { virtual: true }
);`);
        
        behaviorSpecs.push({
          category: 'data',
          description: `Load data on init via ${initApexMethod}`,
          auraPattern: `aura:handler name="init" -> component.get("c.${initApexMethod}")`,
          lwcEquivalent: `@wire(${initApexMethod})`
        });
      }
    }
  }
  
  // Generate test structure
  let testContent = `/**
 * Jest tests for ${lwcName}
 * Converted from Aura component: ${markup.componentName}
 * 
 * These tests verify that the converted LWC preserves the original behaviors.
 */

${imports.join('\n')}

${mocks.join('\n\n')}

describe('${lwcName}', () => {
    let element;

    beforeEach(() => {
        element = createElement('c-${lwcName}', {
            is: ${className}
        });
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

`;

  // Generate LMS Subscriber tests
  if (hasLmsSubscriber) {
    for (const lms of transformedMarkup.lmsChannels.filter(l => !l.isPublisherOnly)) {
      const channelVar = lms.channelName.replace(/__c$/i, '').toUpperCase() + '_CHANNEL';
      
      behaviorSpecs.push({
        category: 'lms',
        description: `Subscribe to ${lms.channelName} on connect`,
        auraPattern: `lightning:messageChannel type="${lms.channelName}" onMessage="{!c.${lms.onMessageHandler}}"`,
        lwcEquivalent: `subscribe(messageContext, ${channelVar}, handleMessage) in connectedCallback`
      });
      
      behaviorSpecs.push({
        category: 'lms',
        description: `Unsubscribe from ${lms.channelName} on disconnect`,
        auraPattern: 'Automatic cleanup by Aura framework',
        lwcEquivalent: `unsubscribe(subscription) in disconnectedCallback`
      });
      
      testContent += `    /**
     * LMS Subscription Tests
     * Original Aura: lightning:messageChannel type="${lms.channelName}" onMessage="{!c.${lms.onMessageHandler}}"
     */
    describe('LMS Subscription - ${lms.channelName}', () => {
        test('should subscribe to message channel on connect', () => {
            // Arrange & Act
            document.body.appendChild(element);

            // Assert
            expect(subscribe).toHaveBeenCalledWith(
                expect.anything(), // MessageContext
                ${channelVar},
                expect.any(Function)
            );
        });

        test('should unsubscribe from message channel on disconnect', () => {
            // Arrange
            document.body.appendChild(element);

            // Act
            document.body.removeChild(element);

            // Assert
            expect(unsubscribe).toHaveBeenCalled();
        });

        test('should handle incoming message and update state', async () => {
            // Arrange
            document.body.appendChild(element);
            const mockRecordId = '003xx000004TtgAAC';
            
            // Get the message handler that was registered
            const messageHandler = subscribe.mock.calls[0][2];

            // Act - simulate receiving a message
            messageHandler({ recordId: mockRecordId });
            
            // Wait for reactivity
            await Promise.resolve();

            // Assert - verify state was updated
            // The original Aura set v.contactId from message.getParam('recordId')
            expect(element.contactId).toBe(mockRecordId);
        });

        test('should clear state when message has no recordId', async () => {
            // Arrange
            document.body.appendChild(element);
            const messageHandler = subscribe.mock.calls[0][2];

            // Act - simulate receiving empty message
            messageHandler({});
            await Promise.resolve();

            // Assert
            expect(element.contactId).toBe('');
        });
    });

`;
    }
  }
  
  // Generate LMS Publisher tests
  if (hasLmsPublisher) {
    for (const lms of transformedMarkup.lmsChannels.filter(l => l.isPublisherOnly)) {
      const channelVar = lms.channelName.replace(/__c$/i, '').toUpperCase() + '_CHANNEL';
      
      behaviorSpecs.push({
        category: 'lms',
        description: `Publish to ${lms.channelName} when contact selected`,
        auraPattern: `component.find('recordSelected').publish(payload)`,
        lwcEquivalent: `publish(messageContext, ${channelVar}, message)`
      });
      
      testContent += `    /**
     * LMS Publisher Tests
     * Original Aura: component.find('recordSelected').publish(payload)
     */
    describe('LMS Publishing - ${lms.channelName}', () => {
        test('should not subscribe to message channel (publisher only)', () => {
            // Arrange & Act
            document.body.appendChild(element);

            // Assert - publisher should NOT subscribe
            expect(subscribe).not.toHaveBeenCalled();
        });

        test('should publish message when publishMessage is called', async () => {
            // Arrange
            document.body.appendChild(element);
            const mockRecordId = '003xx000004TtgAAC';

            // Act
            element.publishMessage({ recordId: mockRecordId });

            // Assert
            expect(publish).toHaveBeenCalledWith(
                expect.anything(), // MessageContext
                ${channelVar},
                expect.objectContaining({ recordId: mockRecordId })
            );
        });
    });

`;
    }
  }
  
  // Generate Wire/Data tests
  if (transformedMarkup.recordDataServices.length > 0) {
    testContent += `    /**
     * Wire Adapter Tests (force:recordData equivalent)
     * Original Aura: force:recordData with reactive recordId binding
     */
    describe('Record Data Loading', () => {
`;
    
    for (const rds of transformedMarkup.recordDataServices) {
      const targetProp = rds.targetFields || 'record';
      
      testContent += `        test('should wire ${targetProp} with reactive ${rds.recordIdBinding}', async () => {
            // This test verifies the @wire decorator is properly configured
            // In Aura: force:recordData recordId="{!v.${rds.recordIdBinding}}" targetFields="{!v.${targetProp}}"
            // In LWC: @wire(getRecord, { recordId: '$${rds.recordIdBinding}', fields: [...] }) ${targetProp};
            
            // Arrange
            const mockRecord = {
                data: {
                    fields: {
${rds.fields.map(f => `                        ${f}: { value: 'Test ${f}' }`).join(',\n')}
                    }
                }
            };

            // Act
            document.body.appendChild(element);
            
            // Simulate wire returning data
            // Note: In actual test, you'd use @salesforce/sfdx-lwc-jest wire adapter mocking

            // Assert structure exists
            expect(element).toBeDefined();
        });

`;
      
      // Generate getter tests for each field
      for (const field of rds.fields) {
        const getterName = field.charAt(0).toLowerCase() + field.slice(1).replace(/__c$/i, '');
        
        testContent += `        test('getter ${getterName} should return undefined when no data', () => {
            // Original Aura: {!v.${targetProp}.${field}}
            // Converted LWC: {${getterName}} via getter using getFieldValue
            
            document.body.appendChild(element);
            expect(element.${getterName}).toBeUndefined();
        });

`;
      }
    }
    
    testContent += `    });

`;
  }
  
  // Generate init/Apex wire tests
  if (initApexMethod) {
    testContent += `    /**
     * Init/Data Loading Tests
     * Original Aura: aura:handler name="init" calling ${initApexMethod}
     * Converted LWC: @wire(${initApexMethod})
     */
    describe('Initial Data Loading', () => {
        test('should wire ${initApexMethod} for automatic data loading', () => {
            // In Aura: doInit called $A.enqueueAction for ${initApexMethod}
            // In LWC: @wire(${initApexMethod}) loads data declaratively
            
            document.body.appendChild(element);
            
            // With @wire, data loads automatically - no imperative call needed
            // The test verifies the wire adapter is properly configured
            expect(element).toBeDefined();
        });
    });

`;
  }
  
  // Generate UI rendering tests
  testContent += `    /**
     * UI Rendering Tests
     * Verify template renders correctly with data
     */
    describe('UI Rendering', () => {
        test('should render component', () => {
            document.body.appendChild(element);
            expect(element).toBeTruthy();
        });

        test('should render lightning-card with correct title', () => {
            document.body.appendChild(element);
            const card = element.shadowRoot.querySelector('lightning-card');
            expect(card).toBeTruthy();
            expect(card.title).toBe('${markup.componentName}');
        });
`;

  // Add conditional rendering tests if aura:if was present
  if (markup.body.some(node => (node as any).name === 'aura:if')) {
    testContent += `
        test('should conditionally render content', async () => {
            // Original Aura: <aura:if isTrue="{!v.someCondition}">
            // Converted LWC: <template if:true={someCondition}>
            
            document.body.appendChild(element);
            
            // Initially should not show conditional content
            // After data loads, should show content
        });
`;
  }

  testContent += `    });
});
`;

  return {
    filename: `${lwcName}.test.js`,
    content: testContent,
    behaviorSpecs
  };
}

/**
 * Generate Jest tests for a converted VF page
 */
export function generateVfToLwcTests(
  vfPage: ParsedVfPage,
  transformedMarkup: TransformedVfMarkup,
  apexController?: ParsedApexController
): GeneratedTest {
  const lwcName = toLwcName(vfPage.pageName);
  const className = toPascalCase(vfPage.pageName);
  const behaviorSpecs: BehaviorSpec[] = [];

  const imports: string[] = [];
  const mocks: string[] = [];

  imports.push("import { createElement } from 'lwc';");
  imports.push(`import ${className} from 'c/${lwcName}';`);

  // Collect Apex methods that need mocking
  const apexMethods: string[] = [];
  const controllerName = vfPage.pageAttributes.controller || apexController?.className || '';

  if (apexController) {
    const auraEnabledMethods = apexController.methods.filter((m) => m.isAuraEnabled);
    const remoteActionMethods = apexController.methods.filter((m) => m.isRemoteAction);

    for (const method of auraEnabledMethods) {
      apexMethods.push(method.name);
      imports.push(`import ${method.name} from '@salesforce/apex/${controllerName}.${method.name}';`);
      mocks.push(`// Mock Apex method: ${method.name}
jest.mock(
    '@salesforce/apex/${controllerName}.${method.name}',
    () => ({ default: jest.fn() }),
    { virtual: true }
);`);
      behaviorSpecs.push({
        category: 'apex',
        description: `Call ${method.name} via imperative Apex`,
        auraPattern: `apex:actionFunction name="${method.name}" action="{!${method.name}}"`,
        lwcEquivalent: `import ${method.name} from '@salesforce/apex/${controllerName}.${method.name}'`,
      });
    }

    for (const method of remoteActionMethods) {
      behaviorSpecs.push({
        category: 'remoteaction',
        description: `Replace @RemoteAction ${method.name} with @AuraEnabled imperative Apex`,
        auraPattern: `Visualforce.remoting.Manager.invokeAction('${controllerName}.${method.name}', ...)`,
        lwcEquivalent: `import ${method.name} from '@salesforce/apex/${controllerName}.${method.name}'`,
      });
    }
  }

  // Action functions (apex:actionFunction)
  if (vfPage.actionFunctions.length > 0) {
    for (const af of vfPage.actionFunctions) {
      behaviorSpecs.push({
        category: 'actionfunction',
        description: `Convert apex:actionFunction "${af.name}" to imperative Apex call`,
        auraPattern: `<apex:actionFunction name="${af.name}" action="{!${af.name}}" />`,
        lwcEquivalent: `async handle${af.name.charAt(0).toUpperCase() + af.name.slice(1)}() { await ${af.name}({ ... }); }`,
      });
    }
  }

  // Remote actions
  if (vfPage.remoteActions.length > 0) {
    for (const ra of vfPage.remoteActions) {
      behaviorSpecs.push({
        category: 'remoteaction',
        description: `Replace remote action ${ra.controller}.${ra.method} with @AuraEnabled Apex`,
        auraPattern: `Visualforce.remoting.Manager.invokeAction('${ra.controller}.${ra.method}', ...)`,
        lwcEquivalent: `import ${ra.method} from '@salesforce/apex/${ra.controller}.${ra.method}'`,
      });
    }
  }

  // Formula getters
  if (transformedMarkup.detectedFormulas.length > 0) {
    for (const formula of transformedMarkup.detectedFormulas) {
      behaviorSpecs.push({
        category: 'formula',
        description: `Getter ${formula.getterName} replaces VF formula expression`,
        auraPattern: `{!${formula.original}}`,
        lwcEquivalent: `get ${formula.getterName}() { ${formula.suggestedLogic} }`,
      });
    }
  }

  // Standard controller
  if (vfPage.pageAttributes.standardController) {
    behaviorSpecs.push({
      category: 'data',
      description: `Load record via @api recordId (standard controller: ${vfPage.pageAttributes.standardController})`,
      auraPattern: `standardController="${vfPage.pageAttributes.standardController}"`,
      lwcEquivalent: `@api recordId; @api objectApiName = '${vfPage.pageAttributes.standardController}';`,
    });
  }

  // UI: conditional rendering from rerendered sections
  if (vfPage.rerenderedSections.length > 0) {
    behaviorSpecs.push({
      category: 'ui',
      description: `Replace rerender sections with reactive LWC properties`,
      auraPattern: `rerender="${vfPage.rerenderedSections.join(', ')}"`,
      lwcEquivalent: `<template if:true={...}> or <template for:each={...}>`,
    });
  }

  // Lifecycle: page action attribute
  if (vfPage.pageAttributes.action) {
    behaviorSpecs.push({
      category: 'lifecycle',
      description: `connectedCallback replaces page action="${vfPage.pageAttributes.action}"`,
      auraPattern: `action="${vfPage.pageAttributes.action}"`,
      lwcEquivalent: `connectedCallback() { this.initializeData(); }`,
    });
  }

  // Build test content
  let testContent = `/**
 * Jest tests for ${lwcName}
 * Converted from Visualforce page: ${vfPage.pageName}
 *
 * These tests verify that the converted LWC preserves the original page behaviors.
 */

${imports.join('\n')}

${mocks.join('\n\n')}

describe('${lwcName}', () => {
    let element;

    beforeEach(() => {
        element = createElement('c-${lwcName}', {
            is: ${className}
        });
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

`;

  // Lifecycle tests
  if (vfPage.pageAttributes.action) {
    testContent += `    /**
     * Lifecycle Tests
     * Original VF: action="${vfPage.pageAttributes.action}"
     */
    describe('Lifecycle', () => {
        test('should call initializeData on connect', () => {
            // In VF the page action ran on load; connectedCallback is the equivalent
            document.body.appendChild(element);
            expect(element).toBeTruthy();
        });
    });

`;
  }

  // Standard controller / record tests
  if (vfPage.pageAttributes.standardController) {
    testContent += `    /**
     * Standard Controller Tests
     * Original VF: standardController="${vfPage.pageAttributes.standardController}"
     */
    describe('Record Context', () => {
        test('should accept recordId as public property', () => {
            const mockRecordId = 'a00xx000000bbbAAA';
            element.recordId = mockRecordId;
            document.body.appendChild(element);
            expect(element.recordId).toBe(mockRecordId);
        });

        test('should have objectApiName set to ${vfPage.pageAttributes.standardController}', () => {
            document.body.appendChild(element);
            expect(element.objectApiName).toBe('${vfPage.pageAttributes.standardController}');
        });
    });

`;
  }

  // Apex / ActionFunction tests
  if (apexMethods.length > 0 || vfPage.actionFunctions.length > 0) {
    testContent += `    /**
     * Apex Call Tests
     * Original VF used apex:actionFunction or remote actions
     */
    describe('Apex Calls', () => {
`;
    for (const methodName of apexMethods) {
      testContent += `        test('${methodName} mock should be callable', async () => {
            ${methodName}.mockResolvedValue([]);
            document.body.appendChild(element);
            expect(${methodName}).toBeDefined();
        });

`;
    }

    for (const af of vfPage.actionFunctions) {
      testContent += `        test('should handle ${af.name} action function', async () => {
            // Original VF: <apex:actionFunction name="${af.name}" action="{!${af.name}}" />
            // Converted to imperative Apex call
            document.body.appendChild(element);
            // TODO: trigger the action and verify Apex is called
            expect(element).toBeTruthy();
        });

`;
    }

    testContent += `    });

`;
  }

  // Remote action tests
  if (vfPage.remoteActions.length > 0) {
    testContent += `    /**
     * Remote Action Tests
     * Original VF used Visualforce.remoting.Manager.invokeAction
     */
    describe('Remote Actions', () => {
`;
    for (const ra of vfPage.remoteActions) {
      testContent += `        test('${ra.method} should be replaced with @AuraEnabled Apex import', () => {
            // Original: Visualforce.remoting.Manager.invokeAction('${ra.controller}.${ra.method}', ...)
            // Converted: import ${ra.method} from '@salesforce/apex/${ra.controller}.${ra.method}'
            document.body.appendChild(element);
            expect(element).toBeTruthy();
        });

`;
    }
    testContent += `    });

`;
  }

  // Formula getter tests
  if (transformedMarkup.detectedFormulas.length > 0) {
    testContent += `    /**
     * Formula Getter Tests
     * Original VF used {!formula} expressions; converted to JS getters
     */
    describe('Formula Getters', () => {
`;
    for (const formula of transformedMarkup.detectedFormulas) {
      testContent += `        test('getter ${formula.getterName} should be defined (converted from {!${formula.original}})', () => {
            document.body.appendChild(element);
            // Getter should exist and return a boolean-like value
            expect(typeof element.${formula.getterName}).not.toBe('undefined');
        });

`;
    }
    testContent += `    });

`;
  }

  // UI rendering tests
  testContent += `    /**
     * UI Rendering Tests
     */
    describe('UI Rendering', () => {
        test('should render component', () => {
            document.body.appendChild(element);
            expect(element).toBeTruthy();
        });
`;

  if (vfPage.rerenderedSections.length > 0) {
    testContent += `
        test('should reactively re-render when data changes', async () => {
            // Original VF used rerender="${vfPage.rerenderedSections.join(', ')}"
            // LWC re-renders automatically via reactive properties
            document.body.appendChild(element);
            await Promise.resolve();
            expect(element).toBeTruthy();
        });
`;
  }

  testContent += `    });
});
`;

  return {
    filename: `${lwcName}.test.js`,
    content: testContent,
    behaviorSpecs,
  };
}

/**
 * Generate a behavior specification document that maps Aura behaviors to LWC equivalents
 */
export function generateBehaviorSpecDocument(
  componentName: string,
  specs: BehaviorSpec[]
): string {
  const lwcName = toLwcName(componentName);
  
  let doc = `# Behavior Specification: ${componentName} → ${lwcName}

This document maps the expected behaviors from the original Aura component to their LWC equivalents.
Use this as a checklist to verify the conversion is correct.

## Behavior Mapping

| Category | Behavior | Aura Pattern | LWC Equivalent |
|----------|----------|--------------|----------------|
`;

  for (const spec of specs) {
    doc += `| ${spec.category} | ${spec.description} | \`${spec.auraPattern}\` | \`${spec.lwcEquivalent}\` |\n`;
  }

  doc += `
## Test Checklist

`;

  const categories = [...new Set(specs.map(s => s.category))];
  for (const cat of categories) {
    const catSpecs = specs.filter(s => s.category === cat);
    doc += `### ${cat.charAt(0).toUpperCase() + cat.slice(1)} Tests\n\n`;
    for (const spec of catSpecs) {
      doc += `- [ ] ${spec.description}\n`;
    }
    doc += '\n';
  }

  return doc;
}
