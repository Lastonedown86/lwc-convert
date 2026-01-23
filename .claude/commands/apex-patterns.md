# Apex Best Practices for LWC

Apply these Apex patterns when working with LWC:

## AuraEnabled Methods
```apex
public with sharing class MyController {
    // Cacheable for wire adapter (read-only)
    @AuraEnabled(cacheable=true)
    public static List<Account> getAccounts(String searchTerm) {
        String key = '%' + String.escapeSingleQuotes(searchTerm) + '%';
        return [SELECT Id, Name FROM Account WHERE Name LIKE :key LIMIT 50];
    }

    // Non-cacheable for DML operations
    @AuraEnabled
    public static Account saveAccount(Account acc) {
        upsert acc;
        return acc;
    }
}
```

## Error Handling Pattern
```apex
@AuraEnabled
public static void processRecord(Id recordId) {
    try {
        // Business logic
    } catch (DmlException e) {
        throw new AuraHandledException(e.getDmlMessage(0));
    } catch (Exception e) {
        throw new AuraHandledException(e.getMessage());
    }
}
```

## Bulkification
```apex
// BAD - SOQL in loop
for (Account acc : accounts) {
    List<Contact> contacts = [SELECT Id FROM Contact WHERE AccountId = :acc.Id];
}

// GOOD - Bulk query
Map<Id, Account> accountMap = new Map<Id, Account>(accounts);
List<Contact> allContacts = [
    SELECT Id, AccountId FROM Contact
    WHERE AccountId IN :accountMap.keySet()
];
```

## Security (CRUD/FLS)
```apex
// With sharing enforces record access
public with sharing class SecureController {

    @AuraEnabled(cacheable=true)
    public static List<Account> getAccounts() {
        // Check CRUD
        if (!Schema.sObjectType.Account.isAccessible()) {
            throw new AuraHandledException('Insufficient access');
        }
        return [SELECT Id, Name FROM Account WITH SECURITY_ENFORCED];
    }
}
```

## Governor Limit Awareness
- **SOQL**: 100 queries per transaction
- **DML**: 150 statements per transaction
- **Heap**: 6MB synchronous, 12MB async
- **CPU**: 10,000ms synchronous

## Testing Pattern
```apex
@isTest
private class MyControllerTest {
    @TestSetup
    static void setup() {
        // Create test data
    }

    @isTest
    static void testGetAccounts() {
        Test.startTest();
        List<Account> results = MyController.getAccounts('Test');
        Test.stopTest();

        System.assertEquals(1, results.size());
    }
}
```

Apply these patterns for secure, efficient Apex code.
