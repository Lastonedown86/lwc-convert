# Aura to LWC Conversion Assistant

You are helping with Aura to LWC conversion. Use these patterns:

## Core Mappings
| Aura | LWC |
|------|-----|
| `{!v.attribute}` | `{property}` |
| `{!c.handler}` | `{handler}` |
| `<aura:attribute>` | `@api` / class property |
| `<aura:handler name="init">` | `connectedCallback()` |
| `<aura:if isTrue>` | `<template lwc:if>` |
| `<aura:iteration>` | `<template for:each>` |
| `<aura:registerEvent>` | `CustomEvent` dispatch |
| `component.get('v.x')` | `this.x` |
| `component.set('v.x', val)` | `this.x = val` |
| `$A.enqueueAction` | `@wire` or imperative Apex |
| `lightning:*` | `lightning-*` (kebab-case) |

## Lifecycle Mapping
| Aura Handler | LWC Hook |
|--------------|----------|
| `init` | `connectedCallback()` |
| `render` | `renderedCallback()` |
| `destroy` | `disconnectedCallback()` |

## Event Conversion
```javascript
// Aura: Fire event
var evt = component.getEvent("myEvent");
evt.setParams({ "data": value });
evt.fire();

// LWC: Dispatch event
this.dispatchEvent(new CustomEvent('myevent', {
    detail: { data: value }
}));
```

## Key Differences
1. **No two-way binding** - Use `onchange` handlers
2. **No helper.js** - Methods go in the class
3. **No $A** - Use standard JS/LWC APIs
4. **Kebab-case** - Component tags use `lightning-button` not `lightning:button`
5. **Key required** - `for:each` needs `key={item.Id}` on first child

## Extended Components (Component Inheritance)

When an Aura component uses `extends="c:BaseComponent"`:

### Detection
The tool identifies extended components and marks them in grading:
- `↱` indicator in component list
- "Extends: c:BaseComponent" in details
- "Simple extension" flag if minimal customization

### Conversion Strategy

**Option 1: Class Inheritance (Recommended)**
```javascript
// LWC: Extend the parent class
import BaseComponent from 'c/baseComponent';

export default class ChildComponent extends BaseComponent {
    // Override or add methods
    additionalMethod() { }
}
```

**Option 2: Composition**
```html
<!-- LWC: Use the parent as a child component -->
<template>
    <c-base-component record-id={recordId}>
        <slot name="content"></slot>
    </c-base-component>
</template>
```

**Option 3: Remove (Simple Extensions)**
If the child just extends with no customization, consider:
- Using the parent directly where the child was used
- Removing the child component entirely

### Conversion Order
**Always convert parent components before children:**
1. Convert `c:BaseComponent` to LWC
2. Then convert `c:ChildComponent` that extends it

Apply these patterns to the user's conversion task. Generate working LWC code.
