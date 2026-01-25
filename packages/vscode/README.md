# LWC Convert for VS Code

Convert Aura components and Visualforce pages to Lightning Web Components directly from VS Code.

## Features

### Context Menu Conversion
Right-click on any `.cmp` or `.page` file to convert it to LWC.

![Context Menu](images/context-menu.png)

### Component Explorer
Browse all Aura and Visualforce components in your workspace with conversion grades.

![Component Explorer](images/component-explorer.png)

### CodeLens Actions
Inline actionable links above component declarations:
- **Convert to LWC** - Start conversion with preview
- **Grade** - View complexity analysis
- **View Dependencies** - Show component relationships

### Grading Integration
- Automatic complexity grading (A-F scale)
- Effort estimation for each component
- Category breakdown (markup, JS patterns, data binding, etc.)

### Dependency Graph
Visualize component dependencies to plan migration order.

## Requirements

- VS Code 1.85.0 or higher
- Node.js 18+
- A Salesforce project with Aura or Visualforce components

## Extension Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `lwcConvert.outputDirectory` | Output directory for converted LWC | `force-app/main/default/lwc` |
| `lwcConvert.conversionMode` | Conversion mode (scaffolding/full) | `scaffolding` |
| `lwcConvert.showGradeDecorations` | Show inline grade decorations | `true` |
| `lwcConvert.autoGradeOnOpen` | Auto-grade when files are opened | `false` |
| `lwcConvert.showCodeLens` | Show CodeLens actions | `true` |

## Commands

| Command | Description |
|---------|-------------|
| `LWC Convert: Convert to LWC` | Convert the selected component |
| `LWC Convert: Convert to LWC (Preview)` | Preview conversion before applying |
| `LWC Convert: Grade Conversion Complexity` | Analyze component complexity |
| `LWC Convert: Grade All Components` | Grade all components in workspace |
| `LWC Convert: Show Dependency Graph` | Visualize dependencies |
| `LWC Convert: Show Conversion Order` | Recommended migration order |

## Usage

1. Open a Salesforce project with Aura or Visualforce components
2. Open the LWC Convert sidebar (lightning bolt icon)
3. Browse components and their grades
4. Right-click a component to convert

## Related

- [lwc-convert CLI](https://github.com/Lastonedown86/lwc-convert) - The CLI tool this extension is built on

## License

MIT
