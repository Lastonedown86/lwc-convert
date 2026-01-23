---
description: Imperative Apex calls for DML and non-cacheable operations
---

# Imperative Apex Calls

Use imperative calls when wire adapters aren't suitable.

## When to Use Imperative

- **DML operations** (insert, update, delete)
- **Non-cacheable queries** (real-time data needed)
- **User-initiated actions** (button clicks)
- **Conditional calls** (based on user input)

## Basic Pattern

```javascript
import { LightningElement } from 'lwc';
import createAccount from '@salesforce/apex/AccountController.createAccount';

export default class AccountCreator extends LightningElement {
    accountName = '';
    isLoading = false;
    error;
    
    handleNameChange(event) {
        this.accountName = event.target.value;
    }
    
    async handleCreate() {
        this.isLoading = true;
        this.error = undefined;
        
        try {
            const accountId = await createAccount({ 
                name: this.accountName 
            });
            
            this.dispatchEvent(new CustomEvent('accountcreated', {
                detail: { accountId }
            }));
            
            this.showToast('Success', 'Account created', 'success');
            
        } catch (error) {
            this.error = error.body?.message || 'Unknown error';
            this.showToast('Error', this.error, 'error');
            
        } finally {
            this.isLoading = false;
        }
    }
    
    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({
            title, message, variant
        }));
    }
}
```

## Apex Controller Setup

```apex
public with sharing class AccountController {
    
    // For wire adapter (cacheable)
    @AuraEnabled(cacheable=true)
    public static List<Account> getAccounts() {
        return [SELECT Id, Name FROM Account LIMIT 10];
    }
    
    // For imperative call (not cacheable - does DML)
    @AuraEnabled
    public static Id createAccount(String name) {
        Account acc = new Account(Name = name);
        insert acc;
        return acc.Id;
    }
    
    // Returning complex data
    @AuraEnabled
    public static Map<String, Object> processAccount(Id accountId) {
        Account acc = [SELECT Id, Name FROM Account WHERE Id = :accountId];
        
        return new Map<String, Object>{
            'account' => acc,
            'success' => true,
            'timestamp' => DateTime.now()
        };
    }
}
```

## Refreshing Wire After Imperative

```javascript
import { refreshApex } from '@salesforce/apex';
import getAccounts from '@salesforce/apex/AccountController.getAccounts';

export default class AccountManager extends LightningElement {
    wiredAccountsResult;
    
    @wire(getAccounts)
    wiredAccounts(result) {
        this.wiredAccountsResult = result;
        // Handle data...
    }
    
    async handleCreate() {
        try {
            await createAccount({ name: this.newName });
            
            // Refresh the wire adapter
            await refreshApex(this.wiredAccountsResult);
            
        } catch (error) {
            // Handle error
        }
    }
}
```

## Error Handling Patterns

```javascript
import { reduceErrors } from 'c/ldsUtils';

async handleSave() {
    try {
        await saveRecord({ record: this.record });
    } catch (error) {
        // Salesforce errors can be complex
        const messages = reduceErrors(error);
        this.errorMessages = messages;
    }
}
```

```javascript
// ldsUtils.js - Utility for parsing errors
export function reduceErrors(errors) {
    if (!Array.isArray(errors)) {
        errors = [errors];
    }

    return errors
        .filter(error => !!error)
        .map(error => {
            if (Array.isArray(error.body)) {
                return error.body.map(e => e.message);
            } else if (error.body && typeof error.body.message === 'string') {
                return error.body.message;
            } else if (typeof error.message === 'string') {
                return error.message;
            }
            return error.statusText;
        })
        .flat();
}
```

## Best Practices

1. **Always use try-catch** - Apex calls can fail
2. **Show loading state** - Disable buttons, show spinner
3. **Use finally block** - Reset loading state
4. **Refresh after DML** - Keep wire data in sync
5. **Parse errors properly** - Salesforce error format varies
