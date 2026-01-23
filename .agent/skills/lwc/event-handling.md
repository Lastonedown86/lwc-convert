---
description: Event handling patterns in Lightning Web Components
---

# Event Handling

LWC uses standard DOM events with Salesforce-specific patterns.

## Event Types

1. **Standard DOM Events** - click, change, input
2. **Custom Events** - Component communication
3. **Lightning Message Service** - Cross-DOM communication
4. **Platform Events** - Server-to-client push

## Custom Events (Child to Parent)

```javascript
// childComponent.js
export default class ChildComponent extends LightningElement {
    handleClick() {
        // Simple event
        this.dispatchEvent(new CustomEvent('select'));
        
        // Event with data
        this.dispatchEvent(new CustomEvent('accountselect', {
            detail: { 
                accountId: this.accountId,
                accountName: this.accountName 
            }
        }));
        
        // Bubbling event (crosses shadow DOM)
        this.dispatchEvent(new CustomEvent('notify', {
            bubbles: true,
            composed: true,
            detail: { message: 'Important!' }
        }));
    }
}
```

```html
<!-- parentComponent.html -->
<c-child-component 
    onselect={handleSelect}
    onaccountselect={handleAccountSelect}>
</c-child-component>
```

```javascript
// parentComponent.js
handleAccountSelect(event) {
    const { accountId, accountName } = event.detail;
    console.log(`Selected: ${accountName} (${accountId})`);
}
```

## Public Methods (Parent to Child)

```javascript
// childComponent.js
export default class ChildComponent extends LightningElement {
    @api
    refresh() {
        // Called by parent
        this.loadData();
    }
    
    @api
    focus() {
        this.template.querySelector('input').focus();
    }
}
```

```javascript
// parentComponent.js
handleRefresh() {
    this.template.querySelector('c-child-component').refresh();
}
```

## Lightning Message Service

For communication across DOM hierarchies:

```javascript
// messageChannel/MyChannel.messageChannel-meta.xml
<?xml version="1.0" encoding="UTF-8"?>
<LightningMessageChannel xmlns="http://soap.sforce.com/2006/04/metadata">
    <masterLabel>My Channel</masterLabel>
    <isExposed>true</isExposed>
    <lightningMessageFields>
        <fieldName>recordId</fieldName>
        <description>Record ID to display</description>
    </lightningMessageFields>
</LightningMessageChannel>
```

```javascript
// Publisher component
import { publish, MessageContext } from 'lightning/messageService';
import MY_CHANNEL from '@salesforce/messageChannel/MyChannel__c';

export default class Publisher extends LightningElement {
    @wire(MessageContext)
    messageContext;
    
    sendMessage() {
        publish(this.messageContext, MY_CHANNEL, {
            recordId: this.selectedId
        });
    }
}
```

```javascript
// Subscriber component
import { subscribe, unsubscribe, MessageContext } from 'lightning/messageService';
import MY_CHANNEL from '@salesforce/messageChannel/MyChannel__c';

export default class Subscriber extends LightningElement {
    subscription = null;
    
    @wire(MessageContext)
    messageContext;
    
    connectedCallback() {
        this.subscription = subscribe(
            this.messageContext,
            MY_CHANNEL,
            (message) => this.handleMessage(message)
        );
    }
    
    disconnectedCallback() {
        unsubscribe(this.subscription);
        this.subscription = null;
    }
    
    handleMessage(message) {
        this.recordId = message.recordId;
    }
}
```

## Best Practices

1. **Use custom events for parent-child** - Simple and performant
2. **Use LMS for sibling/cross-DOM** - When direct reference isn't possible
3. **Keep detail simple** - Primitives or plain objects
4. **Clean up subscriptions** - Unsubscribe in disconnectedCallback
5. **Use bubbles sparingly** - Can cause unexpected handlers
