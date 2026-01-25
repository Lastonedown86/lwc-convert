# 🔄 lwc-convert

> **A precision TypeScript CLI tool for converting Salesforce Aura components and Visualforce pages to Lightning Web Components (LWC)**

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-conversion-mappings">Mappings</a> •
  <a href="#-cli-reference">CLI Reference</a> •
`lwc-convert` automates the migration of legacy Salesforce UI technologies to modern Lightning Web Components:

| Source Technology | Target | Confidence |
|-------------------|--------|------------|
| **Aura Components** | LWC | High |
| **Visualforce Pages** | LWC | Medium-High |

### What You Get

For each conversion, the tool generates a **complete LWC bundle**:

```
myComponent/
├── myComponent.html        # Converted template
├── myComponent.js          # ES6 class with decorators
├── myComponent.css         # Scoped styles
├── myComponent.js-meta.xml # Component configuration
└── CONVERSION_NOTES.md     # Action items & guidance
```

---

## ✨ Features

### 🎯 Single-Component Focus

Unlike batch tools that sacrifice accuracy, `lwc-convert` processes **one component at a time** for maximum precision and detailed error reporting.

### 📝 Two Output Modes

| Mode | Description | Best For |
|------|-------------|----------|
| **Scaffolding** (default) | Generates skeleton with `// TODO:` comments | Complex components requiring manual attention |
| **Full Conversion** (`--full`) | Complete transformation with `// REVIEW:` markers | Simple, standard components |

### 🔍 Smart Analysis

- Parses Aura markup, controllers, helpers, and styles
- Analyzes Apex controllers for VF pages
- Detects patterns and suggests modern equivalents
- Identifies potential issues upfront
- **New!** 📊 **Complexity Grading**: Analyze components before conversion to estimate effort and identify risks.

### 📋 Conversion Notes

Every conversion includes a detailed markdown file with:

- ✅ Completed transformations
- ⚠️ Items needing manual attention
- 📖 Migration guidance and best practices

---

## 🚀 Quick Start

### Interactive Mode

Just run `lwc-convert` without arguments to launch the interactive TUI:

```bash
npx lwc-convert
```

You'll be guided through:

1. **Select conversion type** (Aura or Visualforce)
2. **Choose component** from auto-discovered list or enter path
3. **Configure options** (scaffolding/full, output dir, open folder)
4. **Confirm and convert!**

### Prerequisites

- **Node.js** 18.0 or higher
- **npm** 8.0 or higher

### Installation

**Via npm (recommended):**

```bash
# Run directly with npx (no install needed)
npx lwc-convert aura AccountCard

# Or install globally
npm install -g lwc-convert
lwc-convert aura AccountCard
```

**From source (for development):**

```bash
git clone https://github.com/Lastonedown86/lwc-convert.git
cd lwc-convert
npm install
npm run build
npm link
```

### Your First Conversion

**Convert an Aura Component:**

```bash
# Just use the component name — the CLI searches automatically!
lwc-convert aura AccountCard

# Or use a full path
lwc-convert aura ./force-app/main/default/aura/AccountCard

# Full conversion mode
lwc-convert aura AccountCard --full
```

**Convert a Visualforce Page:**

```bash
# Just use the page name (with or without .page extension)
lwc-convert vf ContactList

# With Apex controller (also supports just the class name)
lwc-convert vf ContactList --controller ContactListController

# Or use full paths
lwc-convert vf ./pages/ContactList.page --controller ./classes/ContactListController.cls
```

**Preview Without Writing Files:**

```bash
lwc-convert aura MyComponent --dry-run --verbose
```

**Assess Conversion Complexity:**

```bash
# Grade a single component
lwc-convert grade AccountCard --type aura

# Scan entire project and export report
lwc-convert grade --type both --format json --output report.json
```

> **💡 Smart Path Resolution:** The CLI automatically searches common Salesforce project locations:
>
> - `force-app/main/default/aura/`, `src/aura/`, `aura/`
> - `force-app/main/default/pages/`, `src/pages/`, `pages/`
> - `force-app/main/default/classes/`, `src/classes/`, `classes/`

---

## 📖 CLI Reference

### Commands

```bash
lwc-convert aura <name-or-path>   # Convert Aura component bundle
lwc-convert vf <name-or-path>     # Convert Visualforce page
lwc-convert grade [target]        # Assess conversion complexity
```

### Global Options

| Option | Description |
|--------|-------------|
| `-V, --version` | Display version |
| `-h, --help` | Show help |

### Aura Command Options

```bash
lwc-convert aura <bundle-path> [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--full` | Full conversion instead of scaffolding | `false` |
| `-o, --output <dir>` | Output directory | `./lwc-output` |
| `--open` | Open output folder in file explorer | `false` |
| `--dry-run` | Preview without writing files | `false` |
| `--verbose` | Show detailed logs | `false` |

### VF Command Options

```bash
lwc-convert vf <page-path> [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--full` | Full conversion instead of scaffolding | `false` |
| `-o, --output <dir>` | Output directory | `./lwc-output` |
| `--controller <path>` | Apex controller for enhanced analysis | — |
| `--open` | Open output folder in file explorer | `false` |
| `--dry-run` | Preview without writing files | `false` |
| `--verbose` | Show detailed logs | `false` |

### Grade Command Options

```bash
lwc-convert grade [target] [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --type <type>` | Component type (`aura`, `vf`, `both`) | `both` |
| `-o, --output <file>` | Output file for report | — |
| `--format <format>` | Output format (`json`, `console`, `md`) | `console` |
| `--detailed` | Show detailed breakdown | `false` |
| `--sort-by <field>` | Sort by `score`, `complexity`, or `name` | `score` |
| `--filter <filter>` | Filter results (e.g., `grade:D,F`) | — |

---

## 🔄 Output Modes

### Scaffolding Mode (Default)

Generates an LWC skeleton optimized for manual completion:

```javascript
import { LightningElement, api } from 'lwc';

// TODO: Import Apex method - verify class and method name
// import getRecords from '@salesforce/apex/MyController.getRecords';

export default class MyComponent extends LightningElement {
    // TODO: Verify if this should be @api (public) or private
    @api recordId;

    // Converted from aura:attribute "items"
    items = [];

    // TODO: Migrate logic from Aura init handler
    connectedCallback() {
        // Original init logic goes here
    }

    // TODO: Implement - converted from controller.handleSave
    handleSave(event) {
        // Original: component.get("v.record"), then server call
    }
}
```

### Full Conversion Mode (`--full`)

Attempts complete code transformation:

```javascript
import { LightningElement, api, wire } from 'lwc';
import getRecords from '@salesforce/apex/MyController.getRecords';

export default class MyComponent extends LightningElement {
    @api recordId;
    items = [];
    isLoading = false;

    connectedCallback() {
        this.loadRecords();
    }

    async loadRecords() {
        this.isLoading = true;
        try {
            // REVIEW: Verify Apex method parameters
            this.items = await getRecords({ recordId: this.recordId });
        } catch (error) {
            console.error('Error loading records:', error);
        } finally {
            this.isLoading = false;
        }
    }

    handleSave(event) {
        // REVIEW: Complex logic converted - verify behavior
        const record = { ...this.currentRecord };
        // ... conversion continues
    }
}
```

---

## 📋 Conversion Mappings

### Aura to LWC

<details>
<summary><strong>🏷️ Component Tags</strong></summary>

| Aura | LWC |
|------|-----|
| `<aura:component>` | `<template>` |
| `<aura:if isTrue="{!v.show}">` | `<template if:true={show}>` |
| `<aura:if isFalse="{!v.hide}">` | `<template if:false={hide}>` |
| `<aura:iteration items="{!v.list}" var="item">` | `<template for:each={list} for:item="item">` |
| `<aura:set attribute="x">` | Named slots or JavaScript |
| `<aura:html tag="div">` | Direct HTML element |

</details>

<details>
<summary><strong>📝 Expressions</strong></summary>

| Aura | LWC |
|------|-----|
| `{!v.propertyName}` | `{propertyName}` |
| `{!v.object.field}` | `{object.field}` |
| `{!c.handleClick}` | `{handleClick}` |
| `{!globalId}` | `data-id` attribute |
| `{!$Label.ns.name}` | Import from `@salesforce/label` |

</details>

<details>
<summary><strong>🎛️ Attributes</strong></summary>

| Aura | LWC |
|------|-----|
| `<aura:attribute name="x" type="String"/>` | `@api x;` |
| `<aura:attribute access="private"/>` | Property without `@api` |
| `<aura:attribute default="value"/>` | `x = 'value';` |
| `aura:id="elementId"` | `data-id="elementId"` |

</details>

<details>
<summary><strong>⚡ JavaScript Patterns</strong></summary>

| Aura | LWC |
|------|-----|
| `component.get("v.name")` | `this.name` |
| `component.set("v.name", val)` | `this.name = val` |
| `component.find("auraId")` | `this.template.querySelector('[data-id="auraId"]')` |
| `helper.doSomething(cmp)` | `this.doSomething()` |
| `$A.enqueueAction(action)` | Imperative Apex call |
| `$A.getCallback(fn)` | Direct function call |

</details>

<details>
<summary><strong>🔄 Lifecycle Hooks</strong></summary>

| Aura Handler | LWC Lifecycle |
|--------------|---------------|
| `init` | `connectedCallback()` |
| `render` | `renderedCallback()` |
| `afterRender` | `renderedCallback()` |
| `unrender` | `disconnectedCallback()` |
| `destroy` | `disconnectedCallback()` |

</details>

<details>
<summary><strong>📡 Events</strong></summary>

| Aura | LWC |
|------|-----|
| `$A.get("e.c:myEvent")` | `new CustomEvent('myevent', {...})` |
| `event.fire()` | `this.dispatchEvent(event)` |
| `event.setParams({...})` | `{ detail: {...} }` in CustomEvent |
| `event.getParam("x")` | `event.detail.x` |
| `<aura:handler event="c:MyEvt" action="{!c.handle}"/>` | `onmyevent={handle}` |
| `<aura:registerEvent name="x"/>` | Document in JSDoc |

</details>

<details>
<summary><strong>⚡ Lightning Components</strong></summary>

| Aura | LWC |
|------|-----|
| `<lightning:button>` | `<lightning-button>` |
| `<lightning:input>` | `<lightning-input>` |
| `<lightning:card>` | `<lightning-card>` |
| `<lightning:datatable>` | `<lightning-datatable>` |
| `<lightning:recordEditForm>` | `<lightning-record-edit-form>` |
| `iconName="standard:account"` | `icon-name="standard:account"` |

</details>

<details>
<summary><strong>🛠️ Utility Functions</strong></summary>

| Aura | LWC |
|------|-----|
| `$A.util.isEmpty(x)` | `!x \|\| x.length === 0` |
| `$A.util.isUndefinedOrNull(x)` | `x === undefined \|\| x === null` |
| `$A.util.addClass(el, 'cls')` | `el.classList.add('cls')` |
| `$A.util.removeClass(el, 'cls')` | `el.classList.remove('cls')` |
| `$A.util.toggleClass(el, 'cls')` | `el.classList.toggle('cls')` |

</details>

### Visualforce to LWC

<details>
<summary><strong>📄 Page Structure</strong></summary>

| Visualforce | LWC |
|-------------|-----|
| `<apex:page>` | `<template>` |
| `<apex:form>` | `<lightning-record-edit-form>` or `<form>` |
| `<apex:pageBlock>` | `<lightning-card>` |
| `<apex:pageBlockSection>` | `<lightning-layout>` |
| `<apex:pageBlockButtons>` | SLDS button group |

</details>

<details>
<summary><strong>📝 Input Components</strong></summary>

| Visualforce | LWC |
|-------------|-----|
| `<apex:inputText>` | `<lightning-input type="text">` |
| `<apex:inputTextarea>` | `<lightning-textarea>` |
| `<apex:inputCheckbox>` | `<lightning-input type="checkbox">` |
| `<apex:inputField>` | `<lightning-input-field>` |
| `<apex:selectList>` | `<lightning-combobox>` |
| `<apex:selectRadio>` | `<lightning-radio-group>` |

</details>

<details>
<summary><strong>📊 Output Components</strong></summary>

| Visualforce | LWC |
|-------------|-----|
| `<apex:outputText>` | `{value}` or `<lightning-formatted-text>` |
| `<apex:outputField>` | `<lightning-output-field>` |
| `<apex:outputLabel>` | `<label>` |
| `<apex:outputLink>` | `<a>` or NavigationMixin |

</details>

<details>
<summary><strong>📋 Data Components</strong></summary>

| Visualforce | LWC |
|-------------|-----|
| `<apex:pageBlockTable>` | `<lightning-datatable>` |
| `<apex:dataTable>` | `<lightning-datatable>` |
| `<apex:repeat>` | `<template for:each>` |
| `<apex:dataList>` | `<template for:each>` with `<ul>` |
| `<apex:detail>` | `<lightning-record-form>` |
| `<apex:relatedList>` | `<lightning-related-list-view>` |

</details>

<details>
<summary><strong>🎬 Action Components</strong></summary>

| Visualforce | LWC |
|-------------|-----|
| `<apex:commandButton>` | `<lightning-button onclick={handler}>` |
| `<apex:commandLink>` | `<lightning-button variant="base">` |
| `<apex:actionFunction>` | Imperative Apex call |
| `<apex:actionSupport>` | Event handler (onclick, onchange) |
| `<apex:actionPoller>` | `setInterval` in `connectedCallback` |
| `<apex:actionStatus>` | `<lightning-spinner>` with loading state |

</details>

<details>
<summary><strong>💬 Messages</strong></summary>

| Visualforce | LWC |
|-------------|-----|
| `<apex:pageMessages>` | `ShowToastEvent` |
| `<apex:messages>` | `ShowToastEvent` |
| `<apex:message>` | `<lightning-helptext>` or validation |

</details>

<details>
<summary><strong>🌐 Global Variables</strong></summary>

| Visualforce | LWC |
|-------------|-----|
| `{!$CurrentPage.parameters.id}` | `@wire(CurrentPageReference)` |
| `{!$User.Id}` | `import userId from '@salesforce/user/Id'` |
| `{!$Label.ns.name}` | `import label from '@salesforce/label/ns.name'` |
| `{!$Resource.name}` | `import res from '@salesforce/resourceUrl/name'` |

</details>

<details>
<summary><strong>🔌 Data Access Patterns</strong></summary>

| Visualforce | LWC |
|-------------|-----|
| Controller getter property | `@wire` decorator |
| Controller action method | Imperative Apex with `@AuraEnabled` |
| `@RemoteAction` | Imperative Apex with `@AuraEnabled` |
| `rerender="sectionId"` | Reactive property update |
| `oncomplete="js()"` | Promise `.then()` or `async/await` |

</details>

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Parsers     │────▶│  Transformers   │────▶│   Generators    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ • Aura Markup   │     │ • Markup Trans. │     │ • Scaffolding   │
│ • Aura JS       │     │ • JS Transform  │     │ • Full Convert  │
│ • Aura CSS      │     │ • Event Trans.  │     │ • Meta XML      │
│ • VF Page       │     │ • Data Binding  │     │ • Conv. Notes   │
│ • Apex Class    │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Processing Pipeline

1. **Parse** — Read and analyze source files (`.cmp`, `Controller.js`, `Helper.js`, `.css`, `.page`, `.cls`)
2. **Extract** — Build intermediate representation (attributes, handlers, events, dependencies)
3. **Transform** — Apply conversion rules (tag mappings, expressions, JavaScript patterns)
4. **Generate** — Create complete LWC bundle (HTML, JS, CSS, meta XML)
5. **Document** — Generate conversion notes with action items

---

## 📁 Project Structure

```
lwc-convert/
├── src/
│   ├── index.ts                    # CLI entry point
│   ├── cli/
│   │   ├── commands/
│   │   │   ├── aura.ts             # Aura conversion command
│   │   │   └── vf.ts               # VF conversion command
│   │   └── options.ts              # CLI option definitions
│   ├── parsers/
│   │   ├── aura/                   # Aura file parsers
│   │   └── vf/                     # VF/Apex parsers
│   ├── transformers/
│   │   ├── aura-to-lwc/            # Aura transformation rules
│   │   └── vf-to-lwc/              # VF transformation rules
│   ├── generators/
│   │   ├── scaffolding.ts          # Skeleton generator
│   │   └── full-conversion.ts      # Complete converter
│   ├── mappings/                   # Conversion mapping configs
│   └── utils/                      # Shared utilities
├── tests/
│   ├── fixtures/                   # Sample components for testing
│   └── __tests__/                  # Test suites
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🧪 Development

### Setup

```bash
npm install        # Install dependencies
npm run build      # Compile TypeScript
npm run dev -- aura ./path/to/component  # Run with ts-node
```

### Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript → JavaScript |
| `npm run dev` | Run CLI with ts-node |
| `npm test` | Run Jest test suite |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |

### Testing

```bash
npm test                              # Run all tests
npm test -- --testPathPattern=parsers # Run parser tests only
npm test -- --coverage                # Generate coverage report
```

### Tech Stack

| Category | Technology |
|----------|------------|
| Language | TypeScript 5.x |
| Runtime | Node.js 18+ |
| CLI | Commander.js |
| HTML/XML | htmlparser2 + domhandler |
| JavaScript AST | Babel (parser, traverse, generator) |
| CSS | PostCSS |
| Testing | Jest + ts-jest |
| Linting | ESLint |
| Formatting | Prettier |

---

## ⚠️ Limitations

### General

- **Single component only** — No batch processing by design
- **Static analysis** — Cannot detect runtime behavior
- **Manual testing required** — Generated code should be tested

### Aura-Specific

- Complex/nested expressions may need manual adjustment
- `$A.createComponent` patterns require manual migration
- Application events need manual pub/sub or LMS setup
- Custom renderers need manual conversion

### Visualforce-Specific

- `apex:actionRegion` needs architectural redesign
- Page includes need component composition
- `renderAs="pdf"` has no LWC equivalent
- Inline JavaScript needs manual migration

---

## 🔧 Troubleshooting

<details>
<summary><strong>"No .cmp file found in Aura bundle"</strong></summary>

Ensure you're pointing to the component folder containing the `.cmp` file, not a parent directory.

```bash
# ✅ Correct
lwc-convert aura ./aura/MyComponent

# ❌ Incorrect
lwc-convert aura ./aura
```

</details>

<details>
<summary><strong>"Expected a .page file"</strong></summary>

The VF command requires a `.page` file path, not a directory.

```bash
# ✅ Correct
lwc-convert vf ./pages/MyPage.page

# ❌ Incorrect
lwc-convert vf ./pages/
```

</details>

<details>
<summary><strong>Build Errors</strong></summary>

1. Ensure Node.js 18+ is installed
2. Delete `node_modules` and run `npm install`
3. Check for TypeScript errors: `npm run build`

</details>

### Getting Help

1. Run with `--verbose` for detailed output
2. Use `--dry-run` to preview without writing files
3. Check the generated `CONVERSION_NOTES.md` file
4. Review `// TODO:` and `// REVIEW:` comments in generated code

---

## 🤝 Contributing

Contributions are welcome! Here's how to help:

### Reporting Issues

1. Check existing issues first
2. Include reproduction steps
3. Attach sample component (sanitized) if possible
4. Include CLI output with `--verbose`

### Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for new functionality
4. Ensure all tests pass (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines

- Follow existing code style
- Add tests for new features
- Update documentation for new mappings
- Keep commits focused and atomic

---

## 📄 License

MIT License — Copyright © 2025

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.

---

## 🙏 Acknowledgments

- [Salesforce Lightning Web Components](https://developer.salesforce.com/docs/component-library/documentation/en/lwc) documentation
- [Aura Components Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/)
- [Visualforce Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.pages.meta/pages/)
- The open source community for excellent parsing libraries

---

<p align="center">
  <strong>Made with ❤️ for Salesforce developers migrating to Lightning Web Components</strong>
</p>
