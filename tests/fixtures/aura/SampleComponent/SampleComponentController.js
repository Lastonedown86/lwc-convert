({
    doInit: function(component, event, helper) {
        component.set("v.isLoading", true);
        helper.loadAccountData(component);
    },

    handleRefresh: function(component, event, helper) {
        helper.loadAccountData(component);
    },

    handleSelect: function(component, event, helper) {
        var accountName = component.get("v.accountName");
        var recordId = component.get("v.recordId");

        var selectEvent = component.getEvent("accountSelected");
        selectEvent.setParams({
            "accountId": recordId,
            "accountName": accountName
        });
        selectEvent.fire();
    }
})
