# Salesforce Security Review

Perform a security review of the code. Check for these issues:

## SOQL Injection
```apex
// VULNERABLE
String query = 'SELECT Id FROM Account WHERE Name = \'' + userInput + '\'';

// SAFE - Use bind variables
String query = 'SELECT Id FROM Account WHERE Name = :userInput';

// SAFE - Escape if dynamic
String safe = String.escapeSingleQuotes(userInput);
```

## CRUD/FLS Violations
```apex
// Check object accessibility
if (!Schema.sObjectType.Account.isAccessible()) {
    throw new AuraHandledException('No access');
}

// Use WITH SECURITY_ENFORCED
SELECT Id, Name FROM Account WITH SECURITY_ENFORCED

// Or stripInaccessible for DML
SObjectAccessDecision decision = Security.stripInaccessible(
    AccessType.UPDATABLE, records
);
update decision.getRecords();
```

## Sharing Model
```apex
// ALWAYS use 'with sharing' unless explicitly needed
public with sharing class SecureClass { }

// Only when record-level access should be bypassed
public without sharing class SystemClass { }
```

## XSS in Lightning
```html
<!-- SAFE - Auto-escaped -->
<p>{userInput}</p>

<!-- DANGEROUS - Unescaped HTML -->
<div lwc:dom="manual"></div>
this.template.querySelector('div').innerHTML = userInput;

<!-- Use lightning-formatted-rich-text for safe HTML -->
<lightning-formatted-rich-text value={richText}></lightning-formatted-rich-text>
```

## Sensitive Data Exposure
- Never log sensitive data (passwords, tokens, PII)
- Don't return more data than needed from Apex
- Use field-level security checks
- Validate @api inputs

## CSRF Protection
- LWC has built-in CSRF protection
- Don't disable it with `@SuppressWarnings`
- Use standard Lightning navigation

## Review Checklist
- [ ] All SOQL uses bind variables or escapeSingleQuotes
- [ ] CRUD/FLS checked before DML
- [ ] Classes use `with sharing`
- [ ] No innerHTML with user input
- [ ] Sensitive data not logged
- [ ] @AuraEnabled methods validate inputs

Report any security issues found with severity and remediation.
