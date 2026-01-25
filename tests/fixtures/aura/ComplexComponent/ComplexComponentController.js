({
    doInit: function (component, event, helper) {
        var action = component.get("c.getData");
        action.setCallback(this, function (response) {
            // ...
        });
        $A.enqueueAction(action);

        // Dynamic creation - should trigger penalty
        $A.createComponent("c:dynamic", {}, function (newCmp) {
            // ...
        });
    },

    handleClick: function (component, event, helper) {
        // jQuery usage - penalty
        $('.container').addClass('active');
    }
})
