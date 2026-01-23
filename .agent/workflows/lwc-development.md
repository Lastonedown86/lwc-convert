---
description: Step-by-step workflows for building Lightning Web Components
---

# LWC Development Workflow

## Prerequisites
- Salesforce org with My Domain enabled
- Salesforce CLI (sf) installed
- VS Code with Salesforce Extension Pack

---

## Workflow: Create a New LWC

### Step 1: Generate the Component
```bash
sf lightning generate component --name myComponent --type lwc --output-dir force-app/main/default/lwc
```

### Step 2: Configure the Meta XML
```xml
<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>59.0</apiVersion>
    <isExposed>true</isExposed>
    <targets>
        <target>lightning__RecordPage</target>
        <target>lightning__AppPage</target>
        <target>lightning__HomePage</target>
    </targets>
    <targetConfigs>
        <targetConfig targets="lightning__RecordPage">
            <objects>
                <object>Account</object>
            </objects>
        </targetConfig>
    </targetConfigs>
</LightningComponentBundle>
```

### Step 3: Build the HTML Template
```html
<template>
    <lightning-card title="My Component" icon-name="standard:account">
        <div class="slds-p-around_medium">
            <template if:true={data}>
                <p>{data.Name}</p>
            </template>
            <template if:true={error}>
                <p class="slds-text-color_error">{error}</p>
            </template>
        </div>
    </lightning-card>
</template>
```

### Step 4: Implement the JavaScript
```javascript
import { LightningElement, api, wire } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';

const FIELDS = ['Account.Name', 'Account.Industry'];

export default class MyComponent extends LightningElement {
    @api recordId;
    
    @wire(getRecord, { recordId: '$recordId', fields: FIELDS })
    wiredRecord({ error, data }) {
        if (data) {
            this.data = data.fields;
            this.error = undefined;
        } else if (error) {
            this.error = error.body.message;
            this.data = undefined;
        }
    }
}
```

---

## Workflow: Call Apex from LWC

### Step 1: Create the Apex Controller
```apex
public with sharing class MyComponentController {
    
    @AuraEnabled(cacheable=true)
    public static List<Account> getAccounts() {
        return [SELECT Id, Name, Industry FROM Account LIMIT 10];
    }
    
    @AuraEnabled
    public static void updateAccount(Id accountId, String name) {
        Account acc = new Account(Id = accountId, Name = name);
        update acc;
    }
}
```

### Step 2: Wire for Read Operations
```javascript
import { LightningElement, wire } from 'lwc';
import getAccounts from '@salesforce/apex/MyComponentController.getAccounts';

export default class MyComponent extends LightningElement {
    accounts;
    error;
    
    @wire(getAccounts)
    wiredAccounts({ error, data }) {
        if (data) {
            this.accounts = data;
        } else if (error) {
            this.error = error.body.message;
        }
    }
}
```

### Step 3: Imperative for Write Operations
```javascript
import { LightningElement } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import updateAccount from '@salesforce/apex/MyComponentController.updateAccount';

export default class MyComponent extends LightningElement {
    
    async handleSave() {
        try {
            await updateAccount({ accountId: this.recordId, name: this.newName });
            this.dispatchEvent(new ShowToastEvent({
                title: 'Success',
                message: 'Account updated',
                variant: 'success'
            }));
        } catch (error) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error',
                message: error.body.message,
                variant: 'error'
            }));
        }
    }
}
```

---

## Workflow: Implement Component Communication

### Parent to Child (Public Properties)
```javascript
// Child component
@api accountName;

// Parent template
<c-child-component account-name={name}></c-child-component>
```

### Child to Parent (Custom Events)
```javascript
// Child component
handleClick() {
    this.dispatchEvent(new CustomEvent('selected', {
        detail: { id: this.recordId }
    }));
}

// Parent template
<c-child-component onselected={handleSelection}></c-child-component>

// Parent JS
handleSelection(event) {
    const selectedId = event.detail.id;
}
```

### Unrelated Components (Lightning Message Service)
```javascript
import { publish, subscribe, MessageContext } from 'lightning/messageService';
import MY_CHANNEL from '@salesforce/messageChannel/MyChannel__c';

@wire(MessageContext) messageContext;

// Publish
publish(this.messageContext, MY_CHANNEL, { recordId: this.recordId });

// Subscribe
connectedCallback() {
    this.subscription = subscribe(this.messageContext, MY_CHANNEL, (message) => {
        this.handleMessage(message);
    });
}
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| **Wire not firing** | Check reactive property ($), ensure cacheable=true |
| **Cannot read property of undefined** | Add null checks, use optional chaining |
| **Event not received** | Verify event name matches (lowercase), check bubbles/composed |
| **Component not visible in App Builder** | Set isExposed=true, add targets |

---

## Related Skills
- [component-architecture.md](../skills/lwc/component-architecture.md)
- [wire-adapters.md](../skills/lwc/wire-adapters.md)
- [event-handling.md](../skills/lwc/event-handling.md)
- [imperative-apex.md](../skills/lwc/imperative-apex.md)
