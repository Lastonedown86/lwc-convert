---
description: JavaScript button replacement strategies for Lightning
---

# JavaScript Button Replacement

Replace Classic JavaScript buttons with Lightning alternatives.

## Replacement Options

| Classic Method | Lightning Replacement |
|----------------|----------------------|
| JavaScript Button | Quick Action with LWC |
| URL Button (URLFOR) | Quick Action or URL Button |
| Detail Page Button | Quick Action |
| List View Button | Flow or List View Action |
| Related List Button | Quick Action on Child |

## Quick Action with LWC

Replace JavaScript button with a Quick Action backed by LWC:

```javascript
// classicButton.js (old JavaScript button)
{!REQUIRESCRIPT("/soap/ajax/29.0/connection.js")}
var record = new sforce.SObject("Opportunity");
record.Id = "{!Opportunity.Id}";
record.StageName = "Closed Won";
sforce.connection.update([record]);
location.reload();
```

```javascript
// lwcQuickAction.js (Lightning replacement)
import { LightningElement, api } from 'lwc';
import { CloseActionScreenEvent } from 'lightning/actions';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import updateOpportunity from '@salesforce/apex/OpportunityController.closeWon';

export default class CloseOpportunityAction extends LightningElement {
    @api recordId;
    isLoading = false;

    async connectedCallback() {
        // Auto-execute on open (mimics JS button behavior)
        await this.closeOpportunity();
    }

    async closeOpportunity() {
        this.isLoading = true;

        try {
            await updateOpportunity({ opportunityId: this.recordId });

            this.dispatchEvent(new ShowToastEvent({
                title: 'Success',
                message: 'Opportunity marked as Closed Won',
                variant: 'success'
            }));

            // Close action and refresh
            this.dispatchEvent(new CloseActionScreenEvent());

            // Refresh the record page
            eval("$A.get('e.force:refreshView').fire();");

        } catch (error) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error',
                message: error.body?.message || 'Unknown error',
                variant: 'error'
            }));
        } finally {
            this.isLoading = false;
        }
    }
}
```

```xml
<!-- lwcQuickAction.js-meta.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>59.0</apiVersion>
    <isExposed>true</isExposed>
    <targets>
        <target>lightning__RecordAction</target>
    </targets>
    <targetConfigs>
        <targetConfig targets="lightning__RecordAction">
            <actionType>Action</actionType>
        </targetConfig>
    </targetConfigs>
</LightningComponentBundle>
```

## URL Button Replacement

Classic URLFOR patterns and Lightning equivalents:

```javascript
// Classic: New record with prepopulated fields
{!URLFOR($Action.Contact.New, null, [
    acc.id=Account.Id,
    retURL=Account.Id
])}

// Lightning: Use lightning/navigation
import { NavigationMixin } from 'lightning/navigation';

export default class CreateContact extends NavigationMixin(LightningElement) {
    @api recordId; // Account Id

    handleCreateContact() {
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: 'Contact',
                actionName: 'new'
            },
            state: {
                defaultFieldValues: `AccountId=${this.recordId}`
            }
        });
    }
}
```

## List Button with Flow

For list view buttons, use Screen Flow with record collection:

```
// Flow Configuration
Type: Screen Flow
Object: Opportunity (collection)

Input Variables:
- ids (Collection of Text) - Selected record IDs

Flow Steps:
1. Get Records using ids
2. Loop through records
3. Update each record
4. Show confirmation screen
```

```xml
<!-- Add to object's buttons/actions -->
<actionType>Flow</actionType>
<targetFlow>Update_Selected_Opportunities</targetFlow>
```

## Common Patterns

### URL Hacking Replacement

```javascript
// Classic: Open edit page with modifications
{!URLFOR($Action.Account.Edit, Account.Id, [
    retURL="/lightning/o/Account/list"
])}

// Lightning: Use NavigationMixin
this[NavigationMixin.Navigate]({
    type: 'standard__recordPage',
    attributes: {
        recordId: this.recordId,
        actionName: 'edit'
    }
});
```

### Confirmation Dialog

```javascript
// Classic: JavaScript confirm
if (confirm("Are you sure?")) { /* proceed */ }

// LWC: Use lightning-modal or custom component
import LightningConfirm from 'lightning/confirm';

async handleAction() {
    const result = await LightningConfirm.open({
        message: 'Are you sure you want to proceed?',
        theme: 'warning',
        label: 'Confirm Action'
    });

    if (result) {
        // User clicked OK
    }
}
```

## Migration Steps

1. Inventory all JavaScript buttons
2. Categorize by type (detail, list, sidebar)
3. Create LWC Quick Actions for each
4. Add to page layouts
5. Test in Lightning Experience
6. Remove Classic buttons
