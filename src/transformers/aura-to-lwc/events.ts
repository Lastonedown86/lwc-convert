/**
 * Transform Aura event patterns to LWC CustomEvent
 */

import { AuraEvent, AuraHandler } from '../../parsers/aura/markup-parser';
import { logger } from '../../utils/logger';

export interface EventTransformation {
  auraEventName: string;
  auraEventType: string;
  lwcEventName: string;
  isApplicationEvent: boolean;
  handlerMethod?: string;
  warnings: string[];
  code: EventCode;
}

export interface EventCode {
  dispatch: string;
  handler: string;
  parentBinding: string;
}

/**
 * Convert Aura event name to LWC event name
 * MyEvent -> myevent
 * onMyEvent -> myevent
 */
function toLwcEventName(auraName: string): string {
  let name = auraName;

  // Remove 'on' prefix if present
  if (name.startsWith('on')) {
    name = name.substring(2);
  }

  // Remove namespace prefix (e.g., c:MyEvent -> MyEvent)
  if (name.includes(':')) {
    name = name.split(':')[1];
  }

  // Convert to lowercase (LWC convention)
  return name.toLowerCase();
}

/**
 * Transform a registered Aura event to LWC CustomEvent
 */
export function transformAuraEvent(
  event: AuraEvent,
  handler?: AuraHandler
): EventTransformation {
  const warnings: string[] = [];
  const lwcEventName = toLwcEventName(event.name);

  // Check if this is an application event (namespace indicates)
  const isApplicationEvent =
    event.type.includes(':') && !event.type.startsWith('c:');

  if (isApplicationEvent) {
    warnings.push(
      `"${event.type}" is an application event - consider using pub/sub pattern or Lightning Message Service`
    );
  }

  // Generate dispatch code
  const dispatchCode = `
    // Fire the ${event.name} event
    this.dispatchEvent(new CustomEvent('${lwcEventName}', {
        detail: {
            // TODO: Add event data properties here
        },
        bubbles: ${isApplicationEvent},
        composed: ${isApplicationEvent}
    }));`;

  // Generate handler code
  const handlerMethod = handler?.action?.replace('{!c.', '').replace('}', '') || `handle${event.name}`;
  const handlerCode = `
    // Handler for ${event.name} event
    ${handlerMethod}(event) {
        const detail = event.detail;
        // TODO: Handle event data
    }`;

  // Generate parent binding (in parent component's template)
  const parentBinding = `on${lwcEventName}={${handlerMethod}}`;

  logger.debug(`Transformed event: ${event.name} -> ${lwcEventName}`);

  return {
    auraEventName: event.name,
    auraEventType: event.type,
    lwcEventName,
    isApplicationEvent,
    handlerMethod,
    warnings,
    code: {
      dispatch: dispatchCode.trim(),
      handler: handlerCode.trim(),
      parentBinding,
    },
  };
}

/**
 * Generate pub/sub utility for application events
 */
export function generatePubSubUtility(): string {
  return `/**
 * Pub/Sub utility for component communication
 * Use this when converting Aura application events that need cross-component communication
 */

const events = {};

const registerListener = (eventName, callback, thisArg) => {
    if (!events[eventName]) {
        events[eventName] = [];
    }
    const duplicate = events[eventName].find((listener) => {
        return listener.callback === callback && listener.thisArg === thisArg;
    });
    if (!duplicate) {
        events[eventName].push({ callback, thisArg });
    }
};

const unregisterListener = (eventName, callback, thisArg) => {
    if (events[eventName]) {
        events[eventName] = events[eventName].filter(
            (listener) =>
                listener.callback !== callback || listener.thisArg !== thisArg
        );
    }
};

const unregisterAllListeners = (thisArg) => {
    Object.keys(events).forEach((eventName) => {
        events[eventName] = events[eventName].filter(
            (listener) => listener.thisArg !== thisArg
        );
    });
};

const fireEvent = (eventName, detail) => {
    if (events[eventName]) {
        events[eventName].forEach((listener) => {
            try {
                listener.callback.call(listener.thisArg, detail);
            } catch (error) {
                console.error('Error in event listener:', error);
            }
        });
    }
};

export { registerListener, unregisterListener, unregisterAllListeners, fireEvent };
`;
}

/**
 * Generate Lightning Message Service channel definition
 */
export function generateMessageChannel(eventName: string, description?: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<LightningMessageChannel xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>${description || `Message channel for ${eventName} communication`}</description>
    <isExposed>true</isExposed>
    <lightningMessageFields>
        <description>The payload of the message</description>
        <fieldName>payload</fieldName>
    </lightningMessageFields>
    <masterLabel>${eventName}</masterLabel>
</LightningMessageChannel>
`;
}

/**
 * Generate LMS usage code for publishing
 */
export function generateLmsPublishCode(channelName: string): string {
  return `
// Import the message channel
import { publish, MessageContext } from 'lightning/messageService';
import ${channelName.toUpperCase()}_CHANNEL from '@salesforce/messageChannel/${channelName}__c';

// Wire the message context
@wire(MessageContext)
messageContext;

// Publish a message
publishMessage(data) {
    const message = {
        payload: data
    };
    publish(this.messageContext, ${channelName.toUpperCase()}_CHANNEL, message);
}`;
}

/**
 * Generate LMS usage code for subscribing
 */
export function generateLmsSubscribeCode(channelName: string): string {
  return `
// Import the message channel
import {
    subscribe,
    unsubscribe,
    APPLICATION_SCOPE,
    MessageContext
} from 'lightning/messageService';
import ${channelName.toUpperCase()}_CHANNEL from '@salesforce/messageChannel/${channelName}__c';

// Wire the message context
@wire(MessageContext)
messageContext;

subscription = null;

// Subscribe in connectedCallback
connectedCallback() {
    this.subscribeToChannel();
}

subscribeToChannel() {
    if (!this.subscription) {
        this.subscription = subscribe(
            this.messageContext,
            ${channelName.toUpperCase()}_CHANNEL,
            (message) => this.handleMessage(message),
            { scope: APPLICATION_SCOPE }
        );
    }
}

handleMessage(message) {
    const payload = message.payload;
    // TODO: Handle the received message
}

// Unsubscribe in disconnectedCallback
disconnectedCallback() {
    if (this.subscription) {
        unsubscribe(this.subscription);
        this.subscription = null;
    }
}`;
}

/**
 * Transform Aura component event handler binding
 */
export function transformEventHandler(handler: AuraHandler): {
  templateBinding: string;
  methodName: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  let templateBinding = '';
  let methodName = '';

  // Extract method name from {!c.methodName}
  const actionMatch = handler.action.match(/\{!c\.(\w+)\}/);
  if (actionMatch) {
    methodName = actionMatch[1];
  } else {
    methodName = handler.action;
    warnings.push(`Could not parse action "${handler.action}" - verify method name`);
  }

  // Handle different event types
  if (handler.event.startsWith('c:')) {
    // Custom component event - use on<eventname> binding
    const eventName = handler.event.substring(2).toLowerCase();
    templateBinding = `on${eventName}={${methodName}}`;
  } else if (handler.event.includes(':')) {
    // Namespace event - might be platform event
    const eventName = handler.event.split(':')[1].toLowerCase();
    if (handler.event.startsWith('force:')) {
      warnings.push(
        `Platform event "${handler.event}" - may need alternative approach in LWC`
      );
    }
    templateBinding = `on${eventName}={${methodName}}`;
  } else {
    // Simple event name
    templateBinding = `on${handler.event.toLowerCase()}={${methodName}}`;
  }

  // Handle phase attribute (capture vs bubble)
  if (handler.phase === 'capture') {
    warnings.push(
      'Capture phase handler found - LWC supports this via addEventListener with { capture: true }'
    );
  }

  return {
    templateBinding,
    methodName,
    warnings,
  };
}
