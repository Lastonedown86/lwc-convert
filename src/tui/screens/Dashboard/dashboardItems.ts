import type { ScreenType, ProjectHealth, RecentConversion } from '../../types.js';
import type {
  QuickActionItem,
  ProjectStatItem,
  RecentConversionItem,
} from './types.js';

/**
 * Create quick action items for navigation
 */
export function createQuickActions(
  navigate: (screen: ScreenType) => void,
  auraCount: number,
  vfCount: number
): QuickActionItem[] {
  const hasComponents = auraCount > 0 || vfCount > 0;

  return [
    {
      id: 'quick-convert',
      type: 'quick-action',
      label: 'Convert Component',
      description: 'Start converting Aura or Visualforce components to Lightning Web Components',
      detailedDescription:
        'Launch the interactive conversion wizard to transform your legacy components into modern LWC. Choose scaffolding mode for manual completion or full mode for automatic transformation.',
      icon: '⚡',
      category: 'quick-start',
      shortcut: 'C',
      enabled: hasComponents,
      action: () => navigate('wizard'),
      steps: [
        'Select component to convert',
        'Choose conversion mode (scaffolding or full)',
        'Configure output settings',
        'Review and execute conversion',
      ],
    },
    {
      id: 'quick-grade',
      type: 'quick-action',
      label: 'Grade Complexity',
      description: 'Analyze component complexity and conversion difficulty',
      detailedDescription:
        'Run complexity analysis on all components to understand which ones are easiest to convert. Grades range from A (simple) to F (very complex).',
      icon: '📊',
      category: 'quick-start',
      shortcut: 'G',
      enabled: hasComponents,
      action: () => navigate('grading'),
      steps: [
        'Scan all components in project',
        'Analyze complexity metrics',
        'Generate grade reports',
        'View detailed results',
      ],
    },
    {
      id: 'quick-browse',
      type: 'quick-action',
      label: 'Browse Components',
      description: 'Explore project components in an interactive tree view',
      detailedDescription:
        'Navigate through all Aura and Visualforce components in your project. View file structures, search by name, and filter by type.',
      icon: '📦',
      category: 'quick-start',
      shortcut: 'B',
      enabled: hasComponents,
      action: () => navigate('browser'),
      steps: [
        'View component tree structure',
        'Search and filter components',
        'Inspect component files',
        'Select components for conversion',
      ],
    },
    {
      id: 'quick-settings',
      type: 'quick-action',
      label: 'Settings',
      description: 'Configure conversion defaults and display preferences',
      detailedDescription:
        'Customize your experience by setting default conversion modes, output directories, theme preferences, and more.',
      icon: '⚙️',
      category: 'quick-start',
      shortcut: 'S',
      enabled: true,
      action: () => navigate('settings'),
      steps: [
        'Set conversion defaults',
        'Configure display options',
        'Manage session preferences',
        'Customize keyboard shortcuts',
      ],
    },
  ];
}

/**
 * Create project health statistics
 */
export function createProjectStats(projectHealth: ProjectHealth | null): ProjectStatItem[] {
  if (!projectHealth) {
    return [
      {
        id: 'stat-components',
        type: 'project-stat',
        label: 'Components',
        description: 'Total components found in project',
        value: 'None',
        category: 'project-health',
        icon: '📦',
        color: 'textMuted',
      },
    ];
  }

  const totalComponents = projectHealth.auraCount + projectHealth.vfCount;

  return [
    {
      id: 'stat-components',
      type: 'project-stat',
      label: 'Total Components',
      description: 'Aura and Visualforce components in your project',
      value: totalComponents,
      category: 'project-health',
      icon: '📦',
      detailLabel: `${projectHealth.auraCount} Aura, ${projectHealth.vfCount} Visualforce`,
    },
    {
      id: 'stat-grade',
      type: 'project-stat',
      label: 'Average Grade',
      description: 'Average complexity grade across all components',
      value: `${projectHealth.avgGrade} (${projectHealth.avgScore})`,
      category: 'project-health',
      icon: '🎯',
    },
    {
      id: 'stat-ready',
      type: 'project-stat',
      label: 'Ready to Convert',
      description: 'Components ready for conversion',
      value: projectHealth.readyToConvert,
      category: 'project-health',
      icon: '✓',
      color: 'success',
    },
  ];
}

/**
 * Create recent conversion items
 */
export function createRecentItems(
  recentConversions: RecentConversion[]
): RecentConversionItem[] {
  return recentConversions.slice(0, 5).map((conversion, index) => ({
    id: `recent-${index}`,
    type: 'recent-conversion',
    label: conversion.name,
    description: `${conversion.type.toUpperCase()} → LWC conversion`,
    category: 'recent',
    timestamp: conversion.timestamp,
    success: conversion.success,
    componentName: conversion.name,
    componentType: conversion.type,
    grade: conversion.grade,
    score: conversion.score,
    icon: conversion.success ? '✓' : '✗',
  }));
}
