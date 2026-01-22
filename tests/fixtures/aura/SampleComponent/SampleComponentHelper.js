({
    loadAccountData: function(component) {
        var recordId = component.get("v.recordId");

        if (!recordId) {
            component.set("v.isLoading", false);
            return;
        }

        var action = component.get("c.getAccountWithContacts");
        action.setParams({
            accountId: recordId
        });

        action.setCallback(this, function(response) {
            var state = response.getState();
            if (state === "SUCCESS") {
                var result = response.getReturnValue();
                component.set("v.accountName", result.Name);
                component.set("v.contacts", result.Contacts);
            } else {
                this.showError(component, response.getError());
            }
            component.set("v.isLoading", false);
        });

        $A.enqueueAction(action);
    },

    showError: function(component, errors) {
        var message = "Unknown error";
        if (errors && errors[0] && errors[0].message) {
            message = errors[0].message;
        }

        var toastEvent = $A.get("e.force:showToast");
        toastEvent.setParams({
            title: "Error",
            message: message,
            type: "error"
        });
        toastEvent.fire();
    }
})
