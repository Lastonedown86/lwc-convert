import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { Modal } from '../components/layout/Modal.js';
import { RadioGroup, Checkbox } from '../components/forms/Checkbox.js';
import { TextInput } from '../components/forms/TextInput.js';
import { useStore } from '../store/index.js';
import { getTheme } from '../themes/index.js';
import { useKeyBindings } from '../hooks/useKeyBindings.js';
import type { KeyBinding } from '../types.js';
import fs from 'fs-extra';

type ExportFormat = 'json' | 'csv' | 'html' | 'md';

interface ExportOptions {
  format: ExportFormat;
  includeSummary: boolean;
  includeDetails: boolean;
  includeRecommendations: boolean;
  outputPath: string;
}

export function ExportModal(): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const closeModal = useStore((state) => state.closeModal);
  const gradingResults = useStore((state) => state.gradingResults);
  const gradingSummary = useStore((state) => state.gradingSummary);

  const theme = getTheme(preferences.theme);

  const [options, setOptions] = useState<ExportOptions>({
    format: preferences.defaultExportFormat as ExportFormat,
    includeSummary: true,
    includeDetails: true,
    includeRecommendations: true,
    outputPath: `./grading-report.${preferences.defaultExportFormat}`,
  });

  const [focusedField, setFocusedField] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExport = async (): Promise<void> => {
    setIsExporting(true);
    setExportError(null);

    try {
      const data = buildExportData(options);
      let content: string;

      switch (options.format) {
        case 'json':
          content = JSON.stringify(data, null, 2);
          break;
        case 'csv':
          content = convertToCSV(data);
          break;
        case 'html':
          content = convertToHTML(data);
          break;
        case 'md':
          content = convertToMarkdown(data);
          break;
        default:
          content = JSON.stringify(data, null, 2);
      }

      await fs.writeFile(options.outputPath, content);
      setExportSuccess(true);

      // Close after a short delay
      setTimeout(() => {
        closeModal();
      }, 1500);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const buildExportData = (opts: ExportOptions): Record<string, unknown> => {
    const data: Record<string, unknown> = {};

    if (opts.includeSummary && gradingSummary) {
      data.summary = gradingSummary;
    }

    if (opts.includeDetails) {
      data.components = gradingResults.map((result) => {
        const component: Record<string, unknown> = {
          name: result.componentName,
          type: result.componentType,
          path: result.filePath,
          score: result.overallScore,
          grade: result.letterGrade,
          complexity: result.complexity,
          effort: result.conversionEffort.manualHours.estimate,
        };

        if (opts.includeRecommendations && result.recommendations) {
          component.recommendations = result.recommendations;
        }

        return component;
      });
    }

    return data;
  };

  const footerBindings: KeyBinding[] = [
    { key: 'escape', action: closeModal, description: 'Cancel' },
    {
      key: 'return',
      action: handleExport,
      description: 'Export',
    },
    {
      key: 'tab',
      action: () => setFocusedField((f) => (f + 1) % 5),
      description: 'Next',
    },
  ];

  useKeyBindings(footerBindings);

  const formatOptions: Array<{ label: string; value: ExportFormat }> = [
    { label: 'JSON', value: 'json' },
    { label: 'CSV', value: 'csv' },
    { label: 'HTML', value: 'html' },
    { label: 'Markdown', value: 'md' },
  ];

  return (
    <Modal title="Export Results" onClose={closeModal} width={50}>
      <Box flexDirection="column">
        {exportSuccess ? (
          <Box flexDirection="column" alignItems="center" paddingY={2}>
            <Text color={theme.success} bold>
              ✓ Export successful!
            </Text>
            <Text color={theme.textMuted}>{options.outputPath}</Text>
          </Box>
        ) : (
          <>
            {/* Format selection */}
            <Box flexDirection="column" marginBottom={1}>
              <Text color={theme.text} bold>
                Format
              </Text>
              <Box gap={2} marginTop={1}>
                {formatOptions.map((fmt) => (
                  <Text
                    key={fmt.value}
                    color={
                      options.format === fmt.value ? theme.primary : theme.textMuted
                    }
                    bold={options.format === fmt.value}
                  >
                    {options.format === fmt.value ? '[●]' : '[ ]'} {fmt.label}
                  </Text>
                ))}
              </Box>
            </Box>

            {/* Include options */}
            <Box flexDirection="column" marginBottom={1}>
              <Text color={theme.text} bold>
                Include
              </Text>
              <Box flexDirection="column" marginTop={1}>
                <Checkbox
                  label="Summary Statistics"
                  checked={options.includeSummary}
                  onChange={(checked) =>
                    setOptions((o) => ({ ...o, includeSummary: checked }))
                  }
                  isFocused={focusedField === 1}
                />
                <Checkbox
                  label="Component Details"
                  checked={options.includeDetails}
                  onChange={(checked) =>
                    setOptions((o) => ({ ...o, includeDetails: checked }))
                  }
                  isFocused={focusedField === 2}
                />
                <Checkbox
                  label="Recommendations"
                  checked={options.includeRecommendations}
                  onChange={(checked) =>
                    setOptions((o) => ({ ...o, includeRecommendations: checked }))
                  }
                  isFocused={focusedField === 3}
                />
              </Box>
            </Box>

            {/* Output path */}
            <Box flexDirection="column" marginBottom={1}>
              <TextInput
                label="Output Path"
                value={options.outputPath}
                onChange={(path) => setOptions((o) => ({ ...o, outputPath: path }))}
                focus={focusedField === 4}
              />
            </Box>

            {/* Error message */}
            {exportError && (
              <Box marginBottom={1}>
                <Text color={theme.error}>Error: {exportError}</Text>
              </Box>
            )}

            {/* Actions */}
            <Box justifyContent="flex-end" gap={2} marginTop={1}>
              <Text color={theme.textMuted}>[Esc] Cancel</Text>
              <Text color={theme.primary}>[Enter] Export</Text>
            </Box>
          </>
        )}
      </Box>
    </Modal>
  );
}

function convertToCSV(data: Record<string, unknown>): string {
  const components = (data.components as Array<Record<string, unknown>>) || [];
  if (components.length === 0) return '';

  const headers = ['Name', 'Type', 'Path', 'Score', 'Grade', 'Complexity', 'Effort'];
  const rows = components.map((c) =>
    [c.name, c.type, c.path, c.score, c.grade, c.complexity, c.effort]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

function convertToHTML(data: Record<string, unknown>): string {
  const summary = data.summary as Record<string, unknown> | undefined;
  const components = (data.components as Array<Record<string, unknown>>) || [];

  return `<!DOCTYPE html>
<html>
<head>
  <title>Grading Report</title>
  <style>
    body { font-family: system-ui; margin: 2rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
    .grade-A { color: #059669; }
    .grade-B { color: #2563eb; }
    .grade-C { color: #d97706; }
    .grade-D { color: #ea580c; }
    .grade-F { color: #dc2626; }
  </style>
</head>
<body>
  <h1>LWC Convert Grading Report</h1>
  ${summary ? `
  <h2>Summary</h2>
  <p>Total: ${summary.totalComponents} | Average: ${summary.averageScore} (${summary.averageGrade})</p>
  ` : ''}
  <h2>Components</h2>
  <table>
    <tr><th>Name</th><th>Type</th><th>Score</th><th>Grade</th><th>Complexity</th></tr>
    ${components.map((c) => `
    <tr>
      <td>${c.name}</td>
      <td>${c.type}</td>
      <td>${c.score}</td>
      <td class="grade-${c.grade}">${c.grade}</td>
      <td>${c.complexity}</td>
    </tr>
    `).join('')}
  </table>
</body>
</html>`;
}

function convertToMarkdown(data: Record<string, unknown>): string {
  const summary = data.summary as Record<string, unknown> | undefined;
  const components = (data.components as Array<Record<string, unknown>>) || [];

  let md = '# LWC Convert Grading Report\n\n';

  if (summary) {
    md += '## Summary\n\n';
    md += `- Total Components: ${summary.totalComponents}\n`;
    md += `- Average Score: ${summary.averageScore}\n`;
    md += `- Average Grade: ${summary.averageGrade}\n\n`;
  }

  md += '## Components\n\n';
  md += '| Name | Type | Score | Grade | Complexity |\n';
  md += '|------|------|-------|-------|------------|\n';

  for (const c of components) {
    md += `| ${c.name} | ${c.type} | ${c.score} | ${c.grade} | ${c.complexity} |\n`;
  }

  return md;
}
