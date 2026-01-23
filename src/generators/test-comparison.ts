/**
 * Test Comparison Generator
 * Creates before/after tests for conversion verification
 * 
 * Before Tests: Document the expected behaviors of the original Aura component
 * After Tests: Verify the converted LWC preserves those behaviors
 * Comparison: Run both and compare outputs
 */

import { ParsedAuraMarkup } from '../parsers/aura/markup-parser';
import { ParsedAuraController, AuraControllerFunction } from '../parsers/aura/controller-parser';
import { ParsedAuraHelper } from '../parsers/aura/helper-parser';
import { TransformedMarkup } from '../transformers/aura-to-lwc/markup';
import { toPascalCase, toLwcName } from '../utils/file-io';

export interface BehaviorTest {
  id: string;
  category: 'lifecycle' | 'data' | 'event' | 'ui' | 'lms' | 'apex';
  name: string;
  description: string;
  auraBehavior: AuraBehavior;
  lwcBehavior: LwcBehavior;
  testCode: {
    before: string;  // Aura component test (conceptual)
    after: string;   // LWC component test (executable)
  };
}

export interface AuraBehavior {
  pattern: string;
  code?: string;
  attributes?: Record<string, string>;
}

export interface LwcBehavior {
  pattern: string;
  code?: string;
  properties?: Record<string, string>;
}

export interface TestComparisonResult {
  componentName: string;
  lwcName: string;
  behaviorTests: BehaviorTest[];
  beforeTestFile: string;
  afterTestFile: string;
  comparisonReport: string;
}

/**
 * Extract behaviors from Aura component and generate comparison tests
 */
export function generateTestComparison(
  markup: ParsedAuraMarkup,
  transformedMarkup: TransformedMarkup,
  controller?: ParsedAuraController,
  helper?: ParsedAuraHelper
): TestComparisonResult {
  const lwcName = toLwcName(markup.componentName);
  const className = toPascalCase(markup.componentName);
  const behaviorTests: BehaviorTest[] = [];
  let testId = 1;

  // 1. Lifecycle behaviors
  const lifecycleTests = extractLifecycleBehaviors(markup, controller, helper, testId);
  behaviorTests.push(...lifecycleTests);
  testId += lifecycleTests.length;

  // 2. Data binding behaviors
  const dataTests = extractDataBindingBehaviors(markup, transformedMarkup, controller, testId);
  behaviorTests.push(...dataTests);
  testId += dataTests.length;

  // 3. Event handling behaviors
  const eventTests = extractEventBehaviors(markup, controller, helper, testId);
  behaviorTests.push(...eventTests);
  testId += eventTests.length;

  // 4. UI rendering behaviors
  const uiTests = extractUIBehaviors(markup, transformedMarkup, testId);
  behaviorTests.push(...uiTests);
  testId += uiTests.length;

  // 5. LMS behaviors
  const lmsTests = extractLMSBehaviors(transformedMarkup, controller, testId);
  behaviorTests.push(...lmsTests);
  testId += lmsTests.length;

  // 6. Apex/server call behaviors
  const apexTests = extractApexBehaviors(markup, controller, helper, testId);
  behaviorTests.push(...apexTests);

  // Generate test files
  const beforeTestFile = generateBeforeTestFile(markup.componentName, behaviorTests);
  const afterTestFile = generateAfterTestFile(lwcName, className, behaviorTests, transformedMarkup);
  const comparisonReport = generateComparisonReport(markup.componentName, lwcName, behaviorTests);

  return {
    componentName: markup.componentName,
    lwcName,
    behaviorTests,
    beforeTestFile,
    afterTestFile,
    comparisonReport,
  };
}

/**
 * Extract lifecycle-related behaviors (init, render, destroy)
 */
function extractLifecycleBehaviors(
  markup: ParsedAuraMarkup,
  controller?: ParsedAuraController,
  helper?: ParsedAuraHelper,
  startId: number = 1
): BehaviorTest[] {
  const tests: BehaviorTest[] = [];
  let id = startId;

  // Init handler
  const initHandler = markup.handlers.find(h => h.name === 'init');
  if (initHandler) {
    const funcName = initHandler.action.replace('{!c.', '').replace('}', '');
    const initFunc = controller?.functions.find(f => f.name === funcName);
    
    // Analyze what init does
    const setsAttributes: string[] = [];
    const callsServer = initFunc?.serverCalls.length ? true : false;
    const callsHelper: string[] = [];

    if (initFunc) {
      // Find component.set calls
      const setMatches = initFunc.body.matchAll(/component\.set\s*\(\s*["']v\.(\w+)["']/g);
      for (const match of setMatches) {
        setsAttributes.push(match[1]);
      }
      // Find helper calls
      const helperMatches = initFunc.body.matchAll(/helper\.(\w+)\s*\(/g);
      for (const match of helperMatches) {
        callsHelper.push(match[1]);
      }
    }

    tests.push({
      id: `behavior-${id++}`,
      category: 'lifecycle',
      name: 'Component Initialization',
      description: `When component initializes, ${funcName} is called`,
      auraBehavior: {
        pattern: `aura:handler name="init" action="{!c.${funcName}}"`,
        code: initFunc?.body,
        attributes: { handler: funcName },
      },
      lwcBehavior: {
        pattern: 'connectedCallback()',
        properties: { lifecycle: 'connectedCallback' },
      },
      testCode: {
        before: generateInitBeforeTest(funcName, setsAttributes, callsServer, callsHelper),
        after: generateInitAfterTest(setsAttributes, callsServer),
      },
    });

    // If init sets specific attributes, add individual tests
    for (const attr of setsAttributes) {
      tests.push({
        id: `behavior-${id++}`,
        category: 'lifecycle',
        name: `Init sets ${attr}`,
        description: `On init, ${attr} property is set`,
        auraBehavior: {
          pattern: `component.set("v.${attr}", ...)`,
        },
        lwcBehavior: {
          pattern: `this.${attr} = ...`,
        },
        testCode: {
          before: `// Aura: After init, v.${attr} should be set\nexpect(component.get("v.${attr}")).toBeDefined();`,
          after: `test('should set ${attr} on init', async () => {\n    document.body.appendChild(element);\n    await Promise.resolve();\n    // LWC: After connectedCallback, ${attr} should be set\n    expect(element.${attr}).toBeDefined();\n});`,
        },
      });
    }
  }

  // Render handler
  const renderHandler = markup.handlers.find(h => h.name === 'render' || h.name === 'afterRender');
  if (renderHandler) {
    tests.push({
      id: `behavior-${id++}`,
      category: 'lifecycle',
      name: 'After Render Callback',
      description: 'Code runs after component renders',
      auraBehavior: {
        pattern: `aura:handler name="${renderHandler.name}" action="${renderHandler.action}"`,
      },
      lwcBehavior: {
        pattern: 'renderedCallback()',
      },
      testCode: {
        before: `// Aura: ${renderHandler.name} handler is called after render`,
        after: `// LWC: renderedCallback is called after each render\n// Note: Add isRendered flag to prevent repeated execution`,
      },
    });
  }

  // Destroy handler
  const destroyHandler = markup.handlers.find(h => h.name === 'destroy');
  if (destroyHandler) {
    tests.push({
      id: `behavior-${id++}`,
      category: 'lifecycle',
      name: 'Component Cleanup',
      description: 'Cleanup runs when component is destroyed',
      auraBehavior: {
        pattern: `aura:handler name="destroy" action="${destroyHandler.action}"`,
      },
      lwcBehavior: {
        pattern: 'disconnectedCallback()',
      },
      testCode: {
        before: `// Aura: destroy handler cleans up resources`,
        after: `test('should cleanup on disconnect', () => {\n    document.body.appendChild(element);\n    document.body.removeChild(element);\n    // Verify cleanup occurred\n});`,
      },
    });
  }

  return tests;
}

/**
 * Extract data binding behaviors (attributes, getters)
 */
function extractDataBindingBehaviors(
  markup: ParsedAuraMarkup,
  transformedMarkup: TransformedMarkup,
  controller?: ParsedAuraController,
  startId: number = 1
): BehaviorTest[] {
  const tests: BehaviorTest[] = [];
  let id = startId;

  // Public attributes
  for (const attr of markup.attributes) {
    const isPublic = !attr.access || attr.access === 'public' || attr.access === 'global';
    
    if (isPublic) {
      tests.push({
        id: `behavior-${id++}`,
        category: 'data',
        name: `Public property: ${attr.name}`,
        description: `${attr.name} is exposed as a public property`,
        auraBehavior: {
          pattern: `<aura:attribute name="${attr.name}" type="${attr.type}" access="${attr.access || 'public'}"/>`,
          attributes: {
            name: attr.name,
            type: attr.type,
            default: attr.default || '',
          },
        },
        lwcBehavior: {
          pattern: `@api ${attr.name}`,
          properties: {
            decorator: '@api',
            type: attr.type,
          },
        },
        testCode: {
          before: `// Aura: v.${attr.name} is accessible from parent\nexpect(component.get("v.${attr.name}")).toBeDefined();`,
          after: generatePropertyAfterTest(attr.name, attr.type, attr.default),
        },
      });
    }
  }

  // force:recordData bindings
  for (const rds of transformedMarkup.recordDataServices) {
    tests.push({
      id: `behavior-${id++}`,
      category: 'data',
      name: `Wire record data: ${rds.auraId}`,
      description: `Record data loaded via ${rds.recordIdBinding}`,
      auraBehavior: {
        pattern: `<force:recordData aura:id="${rds.auraId}" recordId="{!v.${rds.recordIdBinding}}" fields="[${rds.fields.join(', ')}]"/>`,
        attributes: {
          recordIdBinding: rds.recordIdBinding,
          fields: rds.fields.join(', '),
        },
      },
      lwcBehavior: {
        pattern: `@wire(getRecord, { recordId: '$${rds.recordIdBinding}', fields: [${rds.fields.map(f => `'${f}'`).join(', ')}] })`,
      },
      testCode: {
        before: `// Aura: force:recordData loads record when recordId changes`,
        after: generateWireAfterTest(rds.recordIdBinding, rds.fields),
      },
    });
  }

  return tests;
}

/**
 * Extract event handling behaviors
 */
function extractEventBehaviors(
  markup: ParsedAuraMarkup,
  controller?: ParsedAuraController,
  helper?: ParsedAuraHelper,
  startId: number = 1
): BehaviorTest[] {
  const tests: BehaviorTest[] = [];
  let id = startId;

  // Registered events (component events)
  for (const event of markup.registeredEvents) {
    tests.push({
      id: `behavior-${id++}`,
      category: 'event',
      name: `Fires event: ${event.name}`,
      description: `Component can fire ${event.name} event`,
      auraBehavior: {
        pattern: `<aura:registerEvent name="${event.name}" type="${event.type}"/>`,
        code: `component.getEvent("${event.name}").fire()`,
      },
      lwcBehavior: {
        pattern: `this.dispatchEvent(new CustomEvent('${event.name.toLowerCase()}'))`,
      },
      testCode: {
        before: `// Aura: Component fires ${event.name} event\nconst evt = component.getEvent("${event.name}");\nevt.fire();`,
        after: generateEventAfterTest(event.name),
      },
    });
  }

  // Event handlers from controller
  if (controller) {
    for (const func of controller.functions) {
      // Skip init handler (already covered in lifecycle)
      if (func.name === 'doInit') continue;
      
      // Check if it's an event handler (starts with handle, on, or is called from markup)
      if (func.name.startsWith('handle') || func.name.startsWith('on')) {
        const eventName = func.name.replace(/^(handle|on)/, '').toLowerCase();
        
        tests.push({
          id: `behavior-${id++}`,
          category: 'event',
          name: `Handle: ${func.name}`,
          description: `${func.name} handles user interaction`,
          auraBehavior: {
            pattern: `{!c.${func.name}}`,
            code: func.body,
          },
          lwcBehavior: {
            pattern: `${func.name}(event)`,
          },
          testCode: {
            before: `// Aura: ${func.name} is called on ${eventName} event`,
            after: generateHandlerAfterTest(func.name, eventName, func),
          },
        });
      }
    }
  }

  return tests;
}

/**
 * Extract UI rendering behaviors
 */
function extractUIBehaviors(
  markup: ParsedAuraMarkup,
  transformedMarkup: TransformedMarkup,
  startId: number = 1
): BehaviorTest[] {
  const tests: BehaviorTest[] = [];
  let id = startId;

  // Conditional rendering (aura:if)
  const conditionalExpressions = markup.expressions.filter(e => 
    e.original.includes('isTrue') || e.original.includes('isFalse')
  );
  
  for (const component of transformedMarkup.usedComponents) {
    tests.push({
      id: `behavior-${id++}`,
      category: 'ui',
      name: `Renders ${component}`,
      description: `Component includes ${component}`,
      auraBehavior: {
        pattern: `<${component.replace('lightning-', 'lightning:')}>`,
      },
      lwcBehavior: {
        pattern: `<${component}>`,
      },
      testCode: {
        before: `// Aura: ${component.replace('lightning-', 'lightning:')} is rendered`,
        after: `test('should render ${component}', () => {\n    document.body.appendChild(element);\n    const comp = element.shadowRoot.querySelector('${component}');\n    expect(comp).toBeTruthy();\n});`,
      },
    });
  }

  // Iteration rendering
  if (transformedMarkup.usedDirectives.includes('for:each')) {
    tests.push({
      id: `behavior-${id++}`,
      category: 'ui',
      name: 'List rendering',
      description: 'Component renders a list of items',
      auraBehavior: {
        pattern: '<aura:iteration items="{!v.items}" var="item">',
      },
      lwcBehavior: {
        pattern: '<template for:each={items} for:item="item">',
      },
      testCode: {
        before: `// Aura: aura:iteration renders list items`,
        after: `test('should render list items', async () => {\n    element.items = [{Id: '1', Name: 'Test'}];\n    document.body.appendChild(element);\n    await Promise.resolve();\n    // Verify items rendered\n});`,
      },
    });
  }

  // Conditional rendering
  if (transformedMarkup.usedDirectives.includes('lwc:if')) {
    tests.push({
      id: `behavior-${id++}`,
      category: 'ui',
      name: 'Conditional rendering',
      description: 'Component conditionally shows/hides content',
      auraBehavior: {
        pattern: '<aura:if isTrue="{!v.condition}">',
      },
      lwcBehavior: {
        pattern: '<template lwc:if={condition}>',
      },
      testCode: {
        before: `// Aura: Content shown/hidden based on condition`,
        after: `test('should conditionally render content', async () => {\n    element.condition = false;\n    document.body.appendChild(element);\n    await Promise.resolve();\n    // Verify content hidden\n    \n    element.condition = true;\n    await Promise.resolve();\n    // Verify content shown\n});`,
      },
    });
  }

  return tests;
}

/**
 * Extract LMS (Lightning Message Service) behaviors
 */
function extractLMSBehaviors(
  transformedMarkup: TransformedMarkup,
  controller?: ParsedAuraController,
  startId: number = 1
): BehaviorTest[] {
  const tests: BehaviorTest[] = [];
  let id = startId;

  for (const lms of transformedMarkup.lmsChannels) {
    if (lms.isPublisherOnly) {
      // Publisher pattern
      tests.push({
        id: `behavior-${id++}`,
        category: 'lms',
        name: `LMS Publisher: ${lms.channelName}`,
        description: `Publishes messages to ${lms.channelName}`,
        auraBehavior: {
          pattern: `<lightning:messageChannel type="${lms.channelName}" aura:id="${lms.auraId}"/>`,
          code: `component.find('${lms.auraId}').publish(payload)`,
        },
        lwcBehavior: {
          pattern: `publish(this.messageContext, CHANNEL, message)`,
        },
        testCode: {
          before: `// Aura: Publishes to ${lms.channelName}`,
          after: generateLmsPublisherAfterTest(lms.channelName),
        },
      });
    } else {
      // Subscriber pattern
      tests.push({
        id: `behavior-${id++}`,
        category: 'lms',
        name: `LMS Subscriber: ${lms.channelName}`,
        description: `Subscribes to ${lms.channelName} messages`,
        auraBehavior: {
          pattern: `<lightning:messageChannel type="${lms.channelName}" onMessage="{!c.${lms.onMessageHandler}}"/>`,
        },
        lwcBehavior: {
          pattern: `subscribe(messageContext, CHANNEL, handleMessage) in connectedCallback`,
        },
        testCode: {
          before: `// Aura: Receives messages from ${lms.channelName}`,
          after: generateLmsSubscriberAfterTest(lms.channelName, lms.onMessageHandler || 'handleMessage'),
        },
      });

      // Unsubscribe test
      tests.push({
        id: `behavior-${id++}`,
        category: 'lms',
        name: `LMS Unsubscribe: ${lms.channelName}`,
        description: `Unsubscribes from ${lms.channelName} on destroy`,
        auraBehavior: {
          pattern: 'Automatic cleanup by Aura framework',
        },
        lwcBehavior: {
          pattern: 'unsubscribe(subscription) in disconnectedCallback',
        },
        testCode: {
          before: `// Aura: Framework handles cleanup automatically`,
          after: `test('should unsubscribe on disconnect', () => {\n    document.body.appendChild(element);\n    document.body.removeChild(element);\n    expect(unsubscribe).toHaveBeenCalled();\n});`,
        },
      });
    }
  }

  return tests;
}

/**
 * Extract Apex/server call behaviors
 */
function extractApexBehaviors(
  markup: ParsedAuraMarkup,
  controller?: ParsedAuraController,
  helper?: ParsedAuraHelper,
  startId: number = 1
): BehaviorTest[] {
  const tests: BehaviorTest[] = [];
  let id = startId;

  // Find all server calls
  const serverCalls: Array<{ method: string; calledFrom: string }> = [];
  
  if (controller) {
    for (const func of controller.functions) {
      for (const call of func.serverCalls) {
        if (call.controllerMethod) {
          serverCalls.push({ method: call.controllerMethod, calledFrom: func.name });
        }
      }
    }
  }

  if (helper) {
    for (const func of helper.functions) {
      for (const call of func.serverCalls) {
        serverCalls.push({ method: call, calledFrom: `helper.${func.name}` });
      }
    }
  }

  // Create unique server call tests
  const uniqueMethods = [...new Set(serverCalls.map(c => c.method))];
  for (const method of uniqueMethods) {
    const callers = serverCalls.filter(c => c.method === method).map(c => c.calledFrom);
    
    tests.push({
      id: `behavior-${id++}`,
      category: 'apex',
      name: `Apex call: ${method}`,
      description: `Calls ${markup.controller}.${method} from ${callers.join(', ')}`,
      auraBehavior: {
        pattern: `component.get("c.${method}")`,
        code: `var action = component.get("c.${method}");\naction.setParams({...});\n$A.enqueueAction(action);`,
      },
      lwcBehavior: {
        pattern: `@wire(${method}) or await ${method}({...})`,
      },
      testCode: {
        before: `// Aura: Server action ${method} is called`,
        after: generateApexAfterTest(method, markup.controller || ''),
      },
    });
  }

  return tests;
}

// ============ Test Generation Helpers ============

function generateInitBeforeTest(funcName: string, setsAttributes: string[], callsServer: boolean, callsHelper: string[]): string {
  let test = `// Aura: When component loads, ${funcName} is invoked\n`;
  test += `// Expected behaviors:\n`;
  if (setsAttributes.length > 0) {
    test += `//   - Sets attributes: ${setsAttributes.join(', ')}\n`;
  }
  if (callsServer) {
    test += `//   - Makes server call\n`;
  }
  if (callsHelper.length > 0) {
    test += `//   - Calls helper: ${callsHelper.join(', ')}\n`;
  }
  return test;
}

function generateInitAfterTest(setsAttributes: string[], callsServer: boolean): string {
  let test = `test('should initialize component state', async () => {\n`;
  test += `    document.body.appendChild(element);\n`;
  test += `    await Promise.resolve(); // Wait for connectedCallback\n\n`;
  
  if (setsAttributes.length > 0) {
    test += `    // Verify initial state is set\n`;
    for (const attr of setsAttributes) {
      test += `    expect(element.${attr}).toBeDefined();\n`;
    }
  }
  
  if (callsServer) {
    test += `    // Verify data loading was triggered\n`;
    test += `    // (Check wire adapter or Apex mock was called)\n`;
  }
  
  test += `});`;
  return test;
}

function generatePropertyAfterTest(name: string, type: string, defaultVal?: string): string {
  let test = `test('should expose ${name} as @api property', () => {\n`;
  test += `    const testValue = ${getTestValueForType(type)};\n`;
  test += `    element.${name} = testValue;\n`;
  test += `    document.body.appendChild(element);\n`;
  test += `    expect(element.${name}).toEqual(testValue);\n`;
  test += `});`;
  
  if (defaultVal && defaultVal.trim()) {
    test += `\n\ntest('should have default value for ${name}', () => {\n`;
    test += `    document.body.appendChild(element);\n`;
    test += `    expect(element.${name}).toEqual(${defaultVal});\n`;
    test += `});`;
  }
  
  return test;
}

function generateWireAfterTest(recordIdBinding: string, fields: string[]): string {
  let test = `test('should wire record data when ${recordIdBinding} is set', async () => {\n`;
  test += `    element.${recordIdBinding} = '001xx000003DGbYAAW';\n`;
  test += `    document.body.appendChild(element);\n`;
  test += `    \n`;
  test += `    // Emit mock wire data\n`;
  test += `    // const mockRecord = { data: { fields: { ${fields.map(f => `${f}: { value: 'test' }`).join(', ')} }}};\n`;
  test += `    // Use @salesforce/sfdx-lwc-jest emit() to send wire data\n`;
  test += `    \n`;
  test += `    await Promise.resolve();\n`;
  test += `    // Verify getters return field values\n`;
  test += `});`;
  return test;
}

function generateEventAfterTest(eventName: string): string {
  let test = `test('should dispatch ${eventName} event', () => {\n`;
  test += `    const handler = jest.fn();\n`;
  test += `    element.addEventListener('${eventName.toLowerCase()}', handler);\n`;
  test += `    document.body.appendChild(element);\n`;
  test += `    \n`;
  test += `    // Trigger action that fires event\n`;
  test += `    // e.g., click a button, call a method\n`;
  test += `    \n`;
  test += `    expect(handler).toHaveBeenCalled();\n`;
  test += `    expect(handler.mock.calls[0][0].detail).toBeDefined();\n`;
  test += `});`;
  return test;
}

function generateHandlerAfterTest(funcName: string, eventName: string, func: AuraControllerFunction): string {
  let test = `test('should handle ${eventName} event', async () => {\n`;
  test += `    document.body.appendChild(element);\n`;
  test += `    \n`;
  test += `    // Find element that triggers ${funcName}\n`;
  test += `    // const button = element.shadowRoot.querySelector('lightning-button');\n`;
  test += `    // button.click();\n`;
  test += `    \n`;
  test += `    await Promise.resolve();\n`;
  test += `    // Verify expected outcome\n`;
  test += `});`;
  return test;
}

function generateLmsPublisherAfterTest(channelName: string): string {
  const channelVar = channelName.replace(/__c$/i, '').toUpperCase() + '_CHANNEL';
  let test = `test('should publish to ${channelName}', () => {\n`;
  test += `    document.body.appendChild(element);\n`;
  test += `    \n`;
  test += `    // Call method that publishes\n`;
  test += `    element.publishMessage({ recordId: '001xx000003DGbY' });\n`;
  test += `    \n`;
  test += `    expect(publish).toHaveBeenCalledWith(\n`;
  test += `        expect.anything(),\n`;
  test += `        ${channelVar},\n`;
  test += `        expect.objectContaining({ recordId: '001xx000003DGbY' })\n`;
  test += `    );\n`;
  test += `});`;
  return test;
}

function generateLmsSubscriberAfterTest(channelName: string, handlerName: string): string {
  const channelVar = channelName.replace(/__c$/i, '').toUpperCase() + '_CHANNEL';
  let test = `test('should subscribe to ${channelName} on connect', () => {\n`;
  test += `    document.body.appendChild(element);\n`;
  test += `    \n`;
  test += `    expect(subscribe).toHaveBeenCalledWith(\n`;
  test += `        expect.anything(),\n`;
  test += `        ${channelVar},\n`;
  test += `        expect.any(Function)\n`;
  test += `    );\n`;
  test += `});\n\n`;
  test += `test('should handle incoming message', async () => {\n`;
  test += `    document.body.appendChild(element);\n`;
  test += `    const messageHandler = subscribe.mock.calls[0][2];\n`;
  test += `    \n`;
  test += `    // Simulate message\n`;
  test += `    messageHandler({ recordId: '001xx000003DGbY' });\n`;
  test += `    await Promise.resolve();\n`;
  test += `    \n`;
  test += `    // Verify component state updated\n`;
  test += `});`;
  return test;
}

function generateApexAfterTest(method: string, controller: string): string {
  let test = `test('should call ${method} Apex method', async () => {\n`;
  test += `    // Mock Apex response\n`;
  test += `    ${method}.mockResolvedValue({ /* expected data */ });\n`;
  test += `    \n`;
  test += `    document.body.appendChild(element);\n`;
  test += `    await Promise.resolve();\n`;
  test += `    \n`;
  test += `    // If using @wire, data loads automatically\n`;
  test += `    // If imperative, call the method that triggers it\n`;
  test += `    \n`;
  test += `    // Verify Apex was called\n`;
  test += `    // expect(${method}).toHaveBeenCalled();\n`;
  test += `});`;
  return test;
}

function getTestValueForType(type: string): string {
  switch (type.toLowerCase()) {
    case 'string': return "'test-value'";
    case 'boolean': return 'true';
    case 'integer':
    case 'decimal':
    case 'double':
    case 'number': return '42';
    case 'list':
    case 'object[]': return '[]';
    case 'object':
    case 'map': return '{}';
    default: return "'test-value'";
  }
}

// ============ Test File Generators ============

function generateBeforeTestFile(componentName: string, tests: BehaviorTest[]): string {
  let content = `/**
 * BEFORE CONVERSION: Expected Behaviors for ${componentName}
 * 
 * This document describes the expected behaviors of the original Aura component.
 * These behaviors should be preserved in the converted LWC.
 * 
 * Generated by lwc-convert
 */

/**
 * Behavior Inventory
 * ==================
 * 
 * The following behaviors were identified in the Aura component:
 */

`;

  const categories = [...new Set(tests.map(t => t.category))];
  
  for (const category of categories) {
    const categoryTests = tests.filter(t => t.category === category);
    content += `// ============ ${category.toUpperCase()} BEHAVIORS ============\n\n`;
    
    for (const test of categoryTests) {
      content += `/**
 * ${test.id}: ${test.name}
 * ${test.description}
 * 
 * Aura Pattern:
 *   ${test.auraBehavior.pattern}
 */
${test.testCode.before}

`;
    }
  }

  content += `
/**
 * Summary
 * =======
 * 
 * Total behaviors identified: ${tests.length}
 * - Lifecycle: ${tests.filter(t => t.category === 'lifecycle').length}
 * - Data: ${tests.filter(t => t.category === 'data').length}
 * - Events: ${tests.filter(t => t.category === 'event').length}
 * - UI: ${tests.filter(t => t.category === 'ui').length}
 * - LMS: ${tests.filter(t => t.category === 'lms').length}
 * - Apex: ${tests.filter(t => t.category === 'apex').length}
 * 
 * Run the "after" tests to verify all behaviors are preserved.
 */
`;

  return content;
}

function generateAfterTestFile(lwcName: string, className: string, tests: BehaviorTest[], transformedMarkup: TransformedMarkup): string {
  const imports: string[] = [
    `import { createElement } from 'lwc';`,
    `import ${className} from 'c/${lwcName}';`,
  ];
  
  const mocks: string[] = [];
  
  // Add LMS mocks if needed
  if (tests.some(t => t.category === 'lms')) {
    imports.push(`import { publish, subscribe, unsubscribe, MessageContext } from 'lightning/messageService';`);
    
    for (const lms of transformedMarkup.lmsChannels) {
      const channelVar = lms.channelName.replace(/__c$/i, '').toUpperCase() + '_CHANNEL';
      imports.push(`import ${channelVar} from '@salesforce/messageChannel/${lms.channelName}';`);
    }
    
    mocks.push(`jest.mock(
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
  
  // Add wire mocks if needed
  if (tests.some(t => t.category === 'data' && t.lwcBehavior.pattern.includes('@wire'))) {
    imports.push(`import { getRecord, getFieldValue } from 'lightning/uiRecordApi';`);
  }
  
  // Add Apex mocks if needed
  const apexTests = tests.filter(t => t.category === 'apex');
  for (const test of apexTests) {
    const method = test.name.replace('Apex call: ', '');
    // Extract controller name from description: "Calls ControllerName.method from ..."
    const controllerMatch = test.description.match(/Calls\s+([\w]+)\./);
    const controller = controllerMatch ? controllerMatch[1] : 'ApexController';
    
    // Add import for the Apex method
    imports.push(`import ${method} from '@salesforce/apex/${controller}.${method}';`);
    
    mocks.push(`jest.mock(
    '@salesforce/apex/${controller}.${method}',
    () => ({ default: jest.fn() }),
    { virtual: true }
);`);
  }

  let content = `/**
 * AFTER CONVERSION: Jest Tests for ${lwcName}
 * Converted from Aura component
 * 
 * These tests verify that the converted LWC preserves all original behaviors.
 * Each test is linked to a specific behavior from the "before" document.
 * 
 * Generated by lwc-convert
 */

${imports.join('\n')}

${mocks.length > 0 ? '\n// Mocks\n' + mocks.join('\n\n') + '\n' : ''}

describe('${lwcName} - Behavior Verification', () => {
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

  const categories = [...new Set(tests.map(t => t.category))];
  
  for (const category of categories) {
    const categoryTests = tests.filter(t => t.category === category);
    content += `    // ============ ${category.toUpperCase()} TESTS ============\n`;
    content += `    describe('${category.charAt(0).toUpperCase() + category.slice(1)} Behaviors', () => {\n`;
    
    for (const test of categoryTests) {
      content += `        /**
         * ${test.id}: ${test.name}
         * LWC Pattern: ${test.lwcBehavior.pattern}
         */
        ${test.testCode.after}

`;
    }
    
    content += `    });\n\n`;
  }

  content += `});

/**
 * Test Results Comparison
 * =======================
 * 
 * Run these tests with: npm test -- --testPathPattern="${lwcName}"
 * 
 * Expected: All ${tests.length} behavior tests should pass
 * 
 * If a test fails, compare with the corresponding "before" behavior
 * to understand what the original Aura component did.
 */
`;

  return content;
}

function generateComparisonReport(componentName: string, lwcName: string, tests: BehaviorTest[]): string {
  let report = `# Conversion Behavior Comparison Report

## Component: ${componentName} → ${lwcName}

This report documents the behavioral mapping between the original Aura component
and the converted LWC. Use this to verify the conversion is complete and correct.

## Behavior Summary

| Category | Count | Status |
|----------|-------|--------|
`;

  const categories = ['lifecycle', 'data', 'event', 'ui', 'lms', 'apex'] as const;
  for (const cat of categories) {
    const count = tests.filter(t => t.category === cat).length;
    const status = count > 0 ? '⏳ Pending verification' : '✓ N/A';
    report += `| ${cat.charAt(0).toUpperCase() + cat.slice(1)} | ${count} | ${status} |\n`;
  }

  report += `| **Total** | **${tests.length}** | |\n`;

  report += `
## Detailed Behavior Mapping

`;

  for (const cat of categories) {
    const categoryTests = tests.filter(t => t.category === cat);
    if (categoryTests.length === 0) continue;
    
    report += `### ${cat.charAt(0).toUpperCase() + cat.slice(1)} Behaviors

`;
    
    for (const test of categoryTests) {
      report += `#### ${test.id}: ${test.name}

- **Description**: ${test.description}
- **Aura Pattern**: \`${test.auraBehavior.pattern}\`
- **LWC Pattern**: \`${test.lwcBehavior.pattern}\`
- **Test Status**: ⬜ Not run

`;
    }
  }

  report += `
## Verification Checklist

Run the test suite and update this checklist:

`;

  for (const test of tests) {
    report += `- [ ] ${test.id}: ${test.name}\n`;
  }

  report += `
## How to Run Tests

\`\`\`bash
# Run all tests for this component
npm test -- --testPathPattern="${lwcName}"

# Run with coverage
npm test -- --testPathPattern="${lwcName}" --coverage

# Run in watch mode
npm test -- --testPathPattern="${lwcName}" --watch
\`\`\`

## Notes

- Tests marked with "⏳ Pending verification" need manual review
- If a test fails, compare the Aura and LWC patterns to understand the difference
- Some behaviors may require manual implementation (marked as TODO in tests)
`;

  return report;
}
