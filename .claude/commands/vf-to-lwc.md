# Visualforce to LWC Conversion Assistant

You are helping with Visualforce to LWC conversion. Use these patterns:

## Component Mappings
| Visualforce | LWC |
|-------------|-----|
| `<apex:page>` | `<template>` root |
| `<apex:form>` | `<lightning-record-edit-form>` or `<form>` |
| `<apex:inputText>` | `<lightning-input>` |
| `<apex:inputTextarea>` | `<lightning-textarea>` |
| `<apex:selectList>` | `<lightning-combobox>` |
| `<apex:commandButton>` | `<lightning-button>` |
| `<apex:commandLink>` | `<lightning-button variant="base">` |
| `<apex:outputText>` | `{property}` interpolation |
| `<apex:pageBlock>` | `<lightning-card>` |
| `<apex:pageBlockTable>` | `<lightning-datatable>` |
| `<apex:repeat>` | `<template for:each>` |
| `<apex:pageMessages>` | `ShowToastEvent` |
| `<apex:actionFunction>` | Imperative Apex |

## Expression Conversion
| VF Expression | LWC |
|---------------|-----|
| `{!controllerProp}` | `{prop}` + class property |
| `{!Account.Name}` | `{record.fields.Name.value}` |
| `{!$Label.namespace.name}` | `import label from '@salesforce/label/...'` |
| `{!$Resource.name}` | `import resource from '@salesforce/resourceUrl/...'` |
| `{!$User.Id}` | `import userId from '@salesforce/user/Id'` |

## Data Access
```javascript
// VF Controller method -> LWC Apex import
import getData from '@salesforce/apex/MyController.getData';

// Wire for reactive data
@wire(getData, { param: '$reactiveVar' })
wiredData;

// Imperative for actions
async handleClick() {
    const result = await getData({ param: this.value });
}
```

## Page Messages to Toast
```javascript
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

this.dispatchEvent(new ShowToastEvent({
    title: 'Success',
    message: 'Record saved',
    variant: 'success'
}));
```

## Key Considerations
1. **No reRender** - LWC reactivity handles DOM updates
2. **No ViewState** - Use component state
3. **Apex must be @AuraEnabled** - Add to existing methods
4. **URL params** - Use `@api recordId` or `CurrentPageReference`

Apply these patterns to the user's VF conversion task.
