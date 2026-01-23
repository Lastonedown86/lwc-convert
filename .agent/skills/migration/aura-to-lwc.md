---
description: Aura to LWC migration patterns
---

# Aura to LWC Conversion

Migrate Aura components to Lightning Web Components.

## Core Concepts Mapping

| Aura Concept | LWC Equivalent | Notes |
|--------------|----------------|-------|
| `aura:component` | `LightningElement` | Base class for LWC |
| `aura:attribute` | `@api` / `@track` | `@api` for public, `@track` for reactive private (objects/arrays) |
| `aura:handler name="init"` | `connectedCallback()` | Lifecycle hook |
| `aura:registerEvent` | `CustomEvent` | Standard DOM events |
| `aura:method` | `@api` method | Publicly callable methods |
| `force:recordData` | `lightning-record-form` | Or `@wire(getRecord)` |

## Common Conversions

### Attributes to Properties

```xml
<!-- Aura -->
<aura:component>
    <aura:attribute name="message" type="String" default="Hello"/>
    <aura:attribute name="recordId" type="String"/>
</aura:component>
```

```javascript
// LWC
import { LightningElement, api } from 'lwc';

export default class MyComponent extends LightningElement {
    message = 'Hello';
    @api recordId;
}
```

### Expression Syntax

```html
<!-- Aura -->
<p>{!v.message}</p>
<lightning:button label="Click Me" onclick="{!c.handleClick}"/>

<!-- LWC -->
<p>{message}</p>
<lightning-button label="Click Me" onclick={handleClick}></lightning-button>
```

### Conditionals (aura:if)

```html
<!-- Aura -->
<aura:if isTrue="{!v.isVisible}">
    <p>Visible Content</p>
    <aura:set attribute="else">
        <p>Hidden Content</p>
    </aura:set>
</aura:if>

<!-- LWC -->
<template lwc:if={isVisible}>
    <p>Visible Content</p>
</template>
<template lwc:else>
    <p>Hidden Content</p>
</template>
```

### Iteration (aura:iteration)

```html
<!-- Aura -->
<aura:iteration items="{!v.contacts}" var="contact">
    <p>{!contact.Name}</p>
</aura:iteration>

<!-- LWC -->
<template for:each={contacts} for:item="contact">
    <p key={contact.Id}>{contact.Name}</p>
</template>
```

### Events (Component to Parent)

```javascript
// Aura Controller
var updateEvent = component.getEvent("updateEvent");
updateEvent.setParams({ "data": "value" });
updateEvent.fire();
```

```javascript
// LWC
this.dispatchEvent(new CustomEvent('update', {
    detail: { data: 'value' }
}));
```

### Parent Handling Event

```html
<!-- Aura -->
<c:childComponent updateEvent="{!c.handleUpdate}"/>

<!-- LWC -->
<c-child-component onupdate={handleUpdate}></c-child-component>
```

## Lifecycle Hooks

| Aura | LWC |
|------|-----|
| `init` handler | `connectedCallback()` |
| `render` handler | `renderedCallback()` |
| `destroy` handler | `disconnectedCallback()` |

```javascript
// LWC
connectedCallback() {
    // Component inserted into DOM
    // Good for data fetching
}

renderedCallback() {
    // Component rendered
    // Good for manual DOM manipulation (use with care)
}

disconnectedCallback() {
    // Component removed from DOM
    // Good for cleanup (event listeners, timers)
}
```

## Migration Checklist

- [ ] Identify `aura:attribute` usage and convert to properties
- [ ] Convert `aura:handler` init to `connectedCallback`
- [ ] Replace `aura:iteration` with `template for:each`
- [ ] Replace `aura:if` with `lwc:if`
- [ ] Convert `aura:registerEvent` to `CustomEvent` dispatch
- [ ] Update base components (`lightning:button` -> `lightning-button`)
- [ ] Remove two-way binding (`{!v.val}` -> `{val}` + event handler)
