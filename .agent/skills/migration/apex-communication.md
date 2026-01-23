---
description: Migrating Apex communication to LWC
---

# Apex Communication Migration

Migrate data access and Apex calls from Visualforce/Aura to LWC.

## Comparison

| Feature | Visualforce | Aura | LWC |
|---------|-------------|------|-----|
| **Read Data** | `{get; set;}` / `{!prop}` | `action.setCallback` | `@wire` (Reactive) |
| **Write Data** | `PageReference` methods | `action.setCallback` | Imperative Apex |
| **Cache** | View State | Client-side Action Cache | Lightning Data Service (LDS) |
| **Error Handling** | `ApexPages.addMessage` | Callback `state === "ERROR"` | `try/catch` or `error` property |

## The Wire Service (Read)

The preferred way to read data in LWC. It's reactive and manages cache automatically.

```javascript
// Apex
@AuraEnabled(cacheable=true)
public static List<Contact> getContacts(String searchKey) { ... }
```

```javascript
// LWC
import { LightningElement, wire } from 'lwc';
import getContacts from '@salesforce/apex/ContactController.getContacts';

export default class ContactList extends LightningElement {
    searchKey = '';

    @wire(getContacts, { searchKey: '$searchKey' })
    contacts; // { data, error }
}
```

## Imperative Apex (Write / Manual Control)

Use when you need to control *when* the call happens (e.g., button click) or for non-cacheable actions (DML).

```javascript
// Apex
@AuraEnabled // No cacheable=true for DML
public static void saveContact(Contact con) { ... }
```

```javascript
// LWC
import saveContact from '@salesforce/apex/ContactController.saveContact';

handleSave() {
    saveContact({ con: this.contact })
        .then(result => {
            // Success
        })
        .catch(error => {
            // Error
        });
}
```

## Migrating from Visualforce RemoteAction

### Visualforce

```javascript
Visualforce.remoting.Manager.invokeAction(
    '{!$RemoteAction.MyController.getItem}',
    itemId,
    function(result, event) {
        if (event.status) {
            // Success
        }
    }
);
```

### LWC Equivalent

Use **Imperative Apex**.

```javascript
import getItem from '@salesforce/apex/MyController.getItem';

// ... inside a method
try {
    const result = await getItem({ itemId: this.itemId });
} catch (error) {
    // Handle error
}
```

## Migrating from Aura Action

### Aura

```javascript
var action = component.get("c.getItems");
action.setParams({ status: "Active" });
action.setCallback(this, function(response) {
    var state = response.getState();
    if (state === "SUCCESS") {
        component.set("v.items", response.getReturnValue());
    }
});
$A.enqueueAction(action);
```

### LWC Equivalent

Use **@wire** if read-only and cacheable, otherwise **Imperative Apex**.

```javascript
// If cacheable=true
@wire(getItems, { status: 'Active' })
items;

// If not cacheable
async loadItems() {
    this.items = await getItems({ status: 'Active' });
}
```

## Refreshing Data

### Aura

Re-run the action manually.

### LWC

Use `refreshApex` with `@wire` results.

```javascript
import { refreshApex } from '@salesforce/apex';

@wire(getContacts) contacts;

handleRefresh() {
    // Refreshes the cache and the wired property
    return refreshApex(this.contacts);
}
```

## Best Practices

1. **Cacheable=true**: Mark Apex methods as `cacheable=true` whenever possible (read-only) to use the Wire service.
2. **Error Handling**: Always handle errors in `@wire` (check `error` property) and imperative calls (`catch` block).
3. **LDS First**: Prefer Lightning Data Service (`lightning-record-form`, `getRecord`) over custom Apex for simple CRUD.
4. **Parameters**: LWC passes parameters as a single object with keys matching Apex parameter names.
