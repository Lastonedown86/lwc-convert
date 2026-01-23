---
description: Step-by-step workflows for migrating Classic to Lightning (VF, Aura, JS Buttons)
---

# Classic to Lightning Migration Workflow

## Prerequisites
- Understanding of source component (VF, Aura, or JS Button)
- Lightning Experience enabled in target org

---

## Workflow: Migrate Visualforce Page to LWC

### Step 1: Analyze the VF Page
Document the following:
- **Data sources**: Controllers, Standard Controllers, Extensions
- **UI components**: apex:pageBlock, apex:dataTable, etc.
- **Actions**: Save, Cancel, Custom buttons
- **Parameters**: URL parameters, record context

### Step 2: Map VF Tags to LWC
| Visualforce | LWC |
|-------------|-----|
| `<apex:page>` | `<template>` + `<lightning-card>` |
| `<apex:form>` | `<lightning-record-edit-form>` |
| `<apex:inputField>` | `<lightning-input-field>` |
| `<apex:outputField>` | `<lightning-output-field>` |
| `<apex:pageBlockTable>` | `<lightning-datatable>` |
| `<apex:commandButton>` | `<lightning-button>` |

### Step 3: Convert Controller to @AuraEnabled
```apex
// Before: VF Controller Extension
public class AccountExtension {
    public Account account { get; set; }
    public AccountExtension(ApexPages.StandardController std) {
        this.account = (Account) std.getRecord();
    }
}

// After: LWC Controller
public with sharing class AccountController {
    @AuraEnabled(cacheable=true)
    public static Account getAccount(Id recordId) {
        return [SELECT Id, Name, Industry FROM Account WHERE Id = :recordId];
    }
}
```

### Step 4: Create LWC Component
See [lwc-development workflow](./lwc-development.md) for detailed steps.

---

## Workflow: Migrate Aura Component to LWC

### Step 1: Map Aura to LWC Syntax
| Aura | LWC |
|------|-----|
| `<aura:attribute name="x" type="String"/>` | `@api x;` |
| `<aura:handler name="init" action="{!c.init}"/>` | `connectedCallback()` |
| `{!v.attributeName}` | `{attributeName}` |
| `component.get("v.x")` | `this.x` |
| `component.set("v.x", value)` | `this.x = value` |
| `$A.enqueueAction(action)` | `import method from '@salesforce/apex/...'` |

### Step 2: Convert Controller & Helper
```javascript
// Aura Controller + Helper
({
    doInit : function(cmp, event, helper) {
        var action = cmp.get("c.getAccounts");
        action.setCallback(this, function(response) {
            if (response.getState() === "SUCCESS") {
                cmp.set("v.accounts", response.getReturnValue());
            }
        });
        $A.enqueueAction(action);
    }
})

// LWC equivalent
import { LightningElement, wire } from 'lwc';
import getAccounts from '@salesforce/apex/AccountController.getAccounts';

export default class AccountList extends LightningElement {
    @wire(getAccounts)
    accounts;
}
```

### Step 3: Convert Events
```javascript
// Aura: Fire component event
var evt = cmp.getEvent("recordSelected");
evt.setParams({ "recordId" : recordId });
evt.fire();

// LWC: Dispatch custom event
this.dispatchEvent(new CustomEvent('recordselected', {
    detail: { recordId: recordId }
}));
```

---

## Workflow: Replace JavaScript Button

### Step 1: Identify Button Functionality
Common patterns:
- Open URL with parameters
- Create/update records
- Mass update selected records
- Callout to external system

### Step 2: Choose Replacement Strategy
| Original Function | Replacement |
|-------------------|-------------|
| Open URL | Quick Action + LWC, Flow |
| Update record | Screen Flow, Quick Action |
| Mass action | List View Button + Flow |
| Complex logic | LWC + Apex |

### Step 3: Build Quick Action with LWC
```xml
<!-- Meta XML -->
<LightningComponentBundle>
    <isExposed>true</isExposed>
    <targets>
        <target>lightning__RecordAction</target>
    </targets>
    <targetConfigs>
        <targetConfig targets="lightning__RecordAction">
            <actionType>ScreenAction</actionType>
        </targetConfig>
    </targetConfigs>
</LightningComponentBundle>
```

```javascript
// Close modal after action
import { CloseActionScreenEvent } from 'lightning/actions';

handleSuccess() {
    this.dispatchEvent(new CloseActionScreenEvent());
}
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| **VF page in iframe** | Use Lightning Out for embedding |
| **RemoteAction timing** | Use promises with async/await |
| **JS Button expressions** | Move logic to Apex/Flow |

---

## Related Skills
- [vf-to-lwc.md](../skills/migration/vf-to-lwc.md)
- [aura-to-lwc.md](../skills/migration/aura-to-lwc.md)
- [apex-communication.md](../skills/migration/apex-communication.md)
- [js-button-replacement.md](../skills/migration/js-button-replacement.md)
