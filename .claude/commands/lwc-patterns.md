# LWC Best Practices & Patterns

Apply these Lightning Web Component patterns:

## Component Architecture
```javascript
import { LightningElement, api, wire, track } from 'lwc';

export default class MyComponent extends LightningElement {
    // Public properties (parent can set)
    @api recordId;
    @api objectApiName;

    // Private reactive (primitives auto-reactive)
    searchTerm = '';

    // Complex objects need reassignment for reactivity
    items = [];

    // Getters for computed values
    get hasItems() {
        return this.items.length > 0;
    }
}
```

## Wire Service Patterns
```javascript
// Wire to property
@wire(getRecord, { recordId: '$recordId', fields: FIELDS })
record;

// Wire to function for error handling
@wire(getRecord, { recordId: '$recordId', fields: FIELDS })
wiredRecord({ error, data }) {
    if (data) {
        this.record = data;
    } else if (error) {
        this.handleError(error);
    }
}
```

## Event Patterns
```javascript
// Child dispatches
this.dispatchEvent(new CustomEvent('select', {
    detail: { id: this.recordId },
    bubbles: true,
    composed: true  // crosses shadow DOM
}));

// Parent handles
<c-child onselect={handleSelect}></c-child>

handleSelect(event) {
    const { id } = event.detail;
}
```

## Template Directives
```html
<!-- Conditionals -->
<template lwc:if={condition}>...</template>
<template lwc:elseif={other}>...</template>
<template lwc:else>...</template>

<!-- Iteration (key required!) -->
<template for:each={items} for:item="item">
    <div key={item.id}>{item.name}</div>
</template>
```

## Data Table Columns
```javascript
columns = [
    { label: 'Name', fieldName: 'Name', type: 'text' },
    { label: 'Amount', fieldName: 'Amount', type: 'currency' },
    { label: 'Link', fieldName: 'linkUrl', type: 'url',
      typeAttributes: { label: { fieldName: 'linkLabel' } } },
    { type: 'action', typeAttributes: { rowActions: this.actions } }
];
```

## Error Handling
```javascript
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { reduceErrors } from 'c/ldsUtils';

handleError(error) {
    const message = reduceErrors(error).join(', ');
    this.dispatchEvent(new ShowToastEvent({
        title: 'Error',
        message,
        variant: 'error'
    }));
}
```

Apply these patterns to create robust, maintainable LWC code.
