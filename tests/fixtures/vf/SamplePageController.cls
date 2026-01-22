public with sharing class SamplePageController {
    public Account account { get; set; }
    public List<Contact> contacts { get; private set; }
    public Id selectedContactId { get; set; }

    private ApexPages.StandardController stdController;

    public SamplePageController(ApexPages.StandardController controller) {
        this.stdController = controller;
        this.account = (Account)controller.getRecord();
        loadContacts();
    }

    public void loadContacts() {
        contacts = [
            SELECT Id, Name, Email, Phone
            FROM Contact
            WHERE AccountId = :account.Id
            ORDER BY Name
        ];
    }

    public PageReference editContact() {
        selectedContactId = ApexPages.currentPage().getParameters().get('contactId');
        return new PageReference('/' + selectedContactId + '/e');
    }

    @AuraEnabled(cacheable=true)
    public static Account getAccountWithContacts(Id accountId) {
        return [
            SELECT Id, Name, Industry, Phone, Website,
                   BillingStreet, BillingCity, BillingState, BillingPostalCode,
                   (SELECT Id, Name, Email, Phone FROM Contacts ORDER BY Name)
            FROM Account
            WHERE Id = :accountId
        ];
    }

    @AuraEnabled
    public static void saveAccount(Account acc) {
        update acc;
    }

    @RemoteAction
    public static List<Contact> searchContacts(String searchTerm, Id accountId) {
        String searchPattern = '%' + searchTerm + '%';
        return [
            SELECT Id, Name, Email, Phone
            FROM Contact
            WHERE AccountId = :accountId
            AND Name LIKE :searchPattern
            ORDER BY Name
            LIMIT 10
        ];
    }
}
