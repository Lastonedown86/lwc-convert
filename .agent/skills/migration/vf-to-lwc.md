---
description: Visualforce to LWC conversion patterns
---

# Visualforce to LWC Conversion

Migrate Visualforce pages to Lightning Web Components.

## Common Conversions

### Controller Properties to Reactive Variables

```apex
// Visualforce Controller
public class MyController {
    public String accountName { get; set; }
    public List<Contact> contacts { get; set; }

    public MyController() {
        accountName = '';
        contacts = new List<Contact>();
    }
}
```

```javascript
// LWC Equivalent
import { LightningElement, track } from 'lwc';

export default class MyComponent extends LightningElement {
    accountName = '';
    contacts = [];
}
```

### apex:inputText to lightning-input

```html
<!-- Visualforce -->
<apex:inputText value="{!accountName}" id="accName"/>

<!-- LWC -->
<lightning-input
    label="Account Name"
    value={accountName}
    onchange={handleNameChange}>
</lightning-input>
```

```javascript
handleNameChange(event) {
    this.accountName = event.target.value;
}
```

### apex:commandButton to lightning-button

```html
<!-- Visualforce -->
<apex:commandButton value="Save" action="{!saveAccount}" rerender="messages"/>

<!-- LWC -->
<lightning-button
    label="Save"
    variant="brand"
    onclick={handleSave}>
</lightning-button>
```

### apex:pageBlockTable to lightning-datatable

```html
<!-- Visualforce -->
<apex:pageBlockTable value="{!contacts}" var="c">
    <apex:column value="{!c.FirstName}"/>
    <apex:column value="{!c.LastName}"/>
    <apex:column value="{!c.Email}"/>
</apex:pageBlockTable>

<!-- LWC -->
<lightning-datatable
    key-field="Id"
    data={contacts}
    columns={columns}>
</lightning-datatable>
```

```javascript
columns = [
    { label: 'First Name', fieldName: 'FirstName' },
    { label: 'Last Name', fieldName: 'LastName' },
    { label: 'Email', fieldName: 'Email', type: 'email' }
];
```

### apex:actionFunction to Imperative Apex

```html
<!-- Visualforce -->
<apex:actionFunction name="refreshData" action="{!refresh}" rerender="dataPanel"/>
<button onclick="refreshData()">Refresh</button>

<!-- LWC -->
<lightning-button label="Refresh" onclick={handleRefresh}></lightning-button>
```

```javascript
import refreshData from '@salesforce/apex/MyController.refresh';

async handleRefresh() {
    try {
        this.data = await refreshData();
    } catch (error) {
        this.showError(error);
    }
}
```

## Page Messages to Toast

```html
<!-- Visualforce -->
<apex:pageMessages id="messages"/>
```

```javascript
// LWC
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

showSuccess(message) {
    this.dispatchEvent(new ShowToastEvent({
        title: 'Success',
        message: message,
        variant: 'success'
    }));
}

showError(error) {
    this.dispatchEvent(new ShowToastEvent({
        title: 'Error',
        message: error.body?.message || 'Unknown error',
        variant: 'error'
    }));
}
```

## URL Parameters

```apex
// Visualforce
String recordId = ApexPages.currentPage().getParameters().get('id');
```

```javascript
// LWC (record page)
import { LightningElement, api } from 'lwc';

export default class MyComponent extends LightningElement {
    @api recordId;  // Automatically populated on record pages
}

// LWC (standalone with URL params)
connectedCallback() {
    const url = new URL(window.location.href);
    const recordId = url.searchParams.get('c__recordId');
}
```

## Migration Checklist

- [ ] Identify VF page functionality
- [ ] Map `apex:*` tags to `lightning-*` components
- [ ] Convert controller to @AuraEnabled Apex
- [ ] Create LWC with equivalent UI
- [ ] Migrate JavaScript logic
- [ ] Test in Lightning context
- [ ] Update navigation references
- [ ] Deprecate VF page
