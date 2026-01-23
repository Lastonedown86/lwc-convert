# Classic to Lightning Migration

This category contains guides and best practices for migrating Salesforce Classic (Visualforce) and Aura components to Lightning Web Components (LWC).

## Available Guides

- **[Classic to Lightning Strategy](./classic-to-lightning.md)**: Comprehensive framework for migration strategy, assessment, and feature mapping.
- **[Visualforce to LWC](./vf-to-lwc.md)**: Patterns for converting Visualforce pages and tags to LWC.
- **[Aura to LWC](./aura-to-lwc.md)**: Mapping Aura concepts, attributes, and events to LWC equivalents.
- **[Apex Communication](./apex-communication.md)**: Migrating data access from `RemoteAction` and `action.setCallback` to `@wire` and Imperative Apex.
- **[JavaScript Button Replacement](./js-button-replacement.md)**: Strategies for replacing legacy JavaScript buttons.

## General Migration Strategy

1. **Analyze**: Identify the functionality and dependencies of the existing component.
2. **Map**: Find the LWC equivalent for each feature (UI, Logic, Data).
3. **Refactor**: Move business logic from the controller/helper to the LWC JavaScript class.
4. **Rebuild**: Create the LWC HTML template using SLDS and base components.
5. **Test**: Verify functionality in a Lightning App or Record Page.
