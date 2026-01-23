---
description: Lightning Web Component architecture patterns and best practices
---

# Component Architecture Patterns

Build maintainable and reusable Lightning Web Components.

## Component Structure

```
myComponent/
├── myComponent.html      # Template
├── myComponent.js        # Controller
├── myComponent.css       # Styles
├── myComponent.js-meta.xml  # Configuration
└── __tests__/           # Jest tests
    └── myComponent.test.js
```

## Basic Component Pattern

```javascript
// myComponent.js
import { LightningElement, api, wire } from 'lwc';
import getAccounts from '@salesforce/apex/AccountController.getAccounts';

export default class MyComponent extends LightningElement {
    @api recordId;          // Public property (parent can set)
    @api label = 'Default'; // With default value
    
    accounts = [];
    error;
    isLoading = true;
    
    @wire(getAccounts, { recordId: '$recordId' })
    wiredAccounts({ data, error }) {
        this.isLoading = false;
        if (data) {
            this.accounts = data;
            this.error = undefined;
        } else if (error) {
            this.error = error.body.message;
            this.accounts = [];
        }
    }
    
    get hasAccounts() {
        return this.accounts.length > 0;
    }
    
    handleClick(event) {
        const accountId = event.target.dataset.id;
        this.dispatchEvent(new CustomEvent('select', {
            detail: { accountId }
        }));
    }
}
```

```html
<!-- myComponent.html -->
<template>
    <lightning-card title={label}>
        <template if:true={isLoading}>
            <lightning-spinner alternative-text="Loading"></lightning-spinner>
        </template>
        
        <template if:true={error}>
            <p class="slds-text-color_error">{error}</p>
        </template>
        
        <template if:true={hasAccounts}>
            <template for:each={accounts} for:item="account">
                <div key={account.Id} class="account-row">
                    <a data-id={account.Id} onclick={handleClick}>
                        {account.Name}
                    </a>
                </div>
            </template>
        </template>
    </lightning-card>
</template>
```

## Container/Presentational Pattern

**Container Component** - Handles data and logic:
```javascript
// accountListContainer.js
import { LightningElement, wire } from 'lwc';
import getAccounts from '@salesforce/apex/AccountController.getAccounts';

export default class AccountListContainer extends LightningElement {
    @wire(getAccounts)
    accounts;
    
    handleRefresh() {
        // Refresh data
    }
}
```

**Presentational Component** - Pure UI:
```javascript
// accountList.js
import { LightningElement, api } from 'lwc';

export default class AccountList extends LightningElement {
    @api accounts = [];
    @api selectedId;
    
    handleSelect(event) {
        this.dispatchEvent(new CustomEvent('accountselect', {
            detail: event.target.dataset.id
        }));
    }
}
```

## Service Component Pattern

Create headless components for reusable logic:

```javascript
// dataService.js
import { LightningElement, api } from 'lwc';

export default class DataService extends LightningElement {
    @api
    async fetchData(endpoint) {
        const response = await fetch(endpoint);
        return response.json();
    }
    
    @api
    formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(value);
    }
}
```

## Best Practices

1. **Keep components small** - Single responsibility
2. **Use @api for public interface** - Clear contract
3. **Prefer composition** - Small reusable pieces
4. **Separate concerns** - Container vs presentational
5. **Use getters for computed values** - Not methods in template
