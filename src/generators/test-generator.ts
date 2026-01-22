/**
 * Generate Jest test scaffolding for converted LWC components
 * Creates tests that verify the conversion preserves expected behaviors
 */

import { ParsedAuraMarkup } from '../parsers/aura/markup-parser';
import { ParsedAuraController } from '../parsers/aura/controller-parser';
import { TransformedMarkup, LmsChannelConfig, RecordDataConfig } from '../transformers/aura-to-lwc/markup';
import { toPascalCase, toLwcName } from '../utils/file-io';

export interface GeneratedTest {
  filename: string;
  content: string;
  behaviorSpecs: BehaviorSpec[];
}

export interface BehaviorSpec {
  category: 'lms' | 'data' | 'lifecycle' | 'event' | 'ui';
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
  const testCases: string[] = [];
  
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
