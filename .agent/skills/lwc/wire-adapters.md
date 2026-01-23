---
description: Wire adapters for reactive data binding in LWC
---

# Wire Adapters Usage

Wire adapters provide reactive data binding in Lightning Web Components.

## Wire Syntax

```javascript
import { LightningElement, wire } from 'lwc';
import getAccount from '@salesforce/apex/AccountController.getAccount';

export default class MyComponent extends LightningElement {
    // Wire to a property
    @wire(getAccount, { accountId: '$recordId' })
    account;
    
    // Wire to a function for more control
    @wire(getAccount, { accountId: '$recordId' })
    wiredAccount({ data, error }) {
        if (data) {
            this.account = data;
        } else if (error) {
            this.handleError(error);
        }
    }
}
```

## Reactive Parameters

Use `$` prefix for reactive parameters:

```javascript
// This re-fetches when recordId changes
@wire(getAccount, { accountId: '$recordId' })
account;

// Multiple reactive parameters
@wire(searchAccounts, { 
    searchTerm: '$searchTerm',
    filterBy: '$selectedFilter'
})
searchResults;
```

## Built-in Wire Adapters

### Record Data
```javascript
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import NAME_FIELD from '@salesforce/schema/Account.Name';
import INDUSTRY_FIELD from '@salesforce/schema/Account.Industry';

export default class AccountViewer extends LightningElement {
    @api recordId;
    
    @wire(getRecord, { 
        recordId: '$recordId', 
        fields: [NAME_FIELD, INDUSTRY_FIELD] 
    })
    account;
    
    get accountName() {
        return getFieldValue(this.account.data, NAME_FIELD);
    }
}
```

### Record List
```javascript
import { getListUi } from 'lightning/uiListApi';
import ACCOUNT_OBJECT from '@salesforce/schema/Account';

@wire(getListUi, {
    objectApiName: ACCOUNT_OBJECT,
    listViewApiName: 'AllAccounts'
})
listView;
```

### Current User
```javascript
import { getRecord } from 'lightning/uiRecordApi';
import Id from '@salesforce/user/Id';
import NAME_FIELD from '@salesforce/schema/User.Name';

export default class CurrentUser extends LightningElement {
    @wire(getRecord, { recordId: Id, fields: [NAME_FIELD] })
    user;
}
```

## Custom Apex Wire Adapter

```apex
// AccountController.cls
public with sharing class AccountController {
    
    @AuraEnabled(cacheable=true)
    public static List<Account> getAccounts(String searchTerm) {
        String key = '%' + searchTerm + '%';
        return [
            SELECT Id, Name, Industry 
            FROM Account 
            WHERE Name LIKE :key
            LIMIT 10
        ];
    }
}
```

```javascript
// In LWC
import getAccounts from '@salesforce/apex/AccountController.getAccounts';

@wire(getAccounts, { searchTerm: '$searchKey' })
accounts;
```

## Wire vs Imperative Apex

| Feature | Wire | Imperative |
|---------|------|------------|
| Automatic refresh | ✓ | Manual |
| Cached | ✓ | No |
| Control timing | No | ✓ |
| Handle errors | Reactive | Try-catch |
| DML operations | ✗ | ✓ |

## Best Practices

1. **Use wire for read operations** - Automatic caching
2. **Use imperative for DML** - Wire doesn't support non-cacheable
3. **Always handle errors** - Check both data and error
4. **Use field imports** - Reference safety
5. **Refresh when needed** - Use refreshApex()
