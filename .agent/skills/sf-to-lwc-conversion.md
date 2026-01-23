---
name: Salesforce to LWC Conversion
description: Patterns for converting Salesforce Classic components to Lightning Web Components
---

# Salesforce to LWC Conversion Skill

## Supported Conversions
- **Aura → LWC** - Component bundles, controllers, helpers
- **Visualforce → LWC** - Pages with Apex controller integration
- **Flow → LWC** (planned) - Screen flows to LWC
- **Custom Buttons → LWC** (planned) - URL-based actions

## Conversion Modes

### Scaffolding Mode (Default)
- Generates skeleton with TODO comments
- Preserves structure for manual completion
- Best for complex components needing human review

### Full Mode (`--full`)
- Attempts complete code transformation
- Maps Aura attributes → LWC properties
- Converts expression syntax
- Transforms event handlers

## Key Mappings

### Aura to LWC
| Aura | LWC |
|------|-----|
| `{!v.attribute}` | `{property}` |
| `<aura:attribute>` | `@api property` |
| `component.get('v.attr')` | `this.property` |
| `<aura:handler>` | `connectedCallback()` |
| `$A.enqueueAction` | `import { wire }` or `async` |

### Visualforce to LWC
| VF | LWC |
|----|-----|
| `<apex:inputText>` | `<lightning-input>` |
| `<apex:commandButton>` | `<lightning-button>` |
| `<apex:pageBlock>` | `<lightning-card>` |
| `{!controller.property}` | `{property}` |

## Project Structure

```
src/converters/
├── aura/         # Aura conversion logic
├── vf/           # Visualforce conversion logic
└── common/       # Shared utilities and types
```
