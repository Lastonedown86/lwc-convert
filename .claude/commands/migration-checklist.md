# Migration Checklist Generator

Generate a comprehensive migration checklist for the component/page being converted.

## Pre-Migration Analysis
- [ ] Document current functionality
- [ ] Identify all data sources (controllers, extensions, standard controllers)
- [ ] Map user interactions and workflows
- [ ] Note any external dependencies (static resources, VF includes)
- [ ] Identify navigation patterns used

## Component Conversion (Aura → LWC)
- [ ] Convert `aura:attribute` to class properties with `@api`/`@track`
- [ ] Convert `aura:handler init` to `connectedCallback()`
- [ ] Convert `aura:if/iteration` to `lwc:if/for:each`
- [ ] Update expression syntax `{!v.x}` → `{x}`
- [ ] Convert component references `lightning:*` → `lightning-*`
- [ ] Convert events to CustomEvent dispatch
- [ ] Merge controller + helper into single class
- [ ] Update $A.* calls to standard APIs
- [ ] Add `key` to all iteration items

## Page Conversion (VF → LWC)
- [ ] Map `apex:*` components to `lightning-*`
- [ ] Convert controller methods to `@AuraEnabled`
- [ ] Replace `apex:actionFunction` with imperative Apex
- [ ] Replace `apex:pageMessages` with ShowToastEvent
- [ ] Handle `reRender` with reactive properties
- [ ] Convert `apex:repeat` to `for:each`
- [ ] Update URL parameter handling
- [ ] Convert JavaScript remoting to Apex imports

## Data Layer
- [ ] Identify all Apex methods needed
- [ ] Add `@AuraEnabled(cacheable=true)` for read methods
- [ ] Add `@AuraEnabled` for write methods
- [ ] Wire read-only data where possible
- [ ] Use imperative calls for DML operations

## Testing
- [ ] Create Jest tests for component logic
- [ ] Test all user interactions
- [ ] Test error scenarios
- [ ] Test loading states
- [ ] Verify accessibility (keyboard nav, screen reader)

## Deployment
- [ ] Add to Lightning App Builder pages
- [ ] Update any hardcoded references
- [ ] Configure component visibility/targets
- [ ] Test in sandbox
- [ ] Document breaking changes

## Post-Migration
- [ ] Monitor error logs
- [ ] Gather user feedback
- [ ] Deprecate old component/page
- [ ] Update documentation

Generate this checklist customized for the specific component being converted.
