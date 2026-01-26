import fs from 'fs-extra';
import path from 'path';
import type { ComponentInfo, GradeLevel } from '../types.js';

export interface DiscoveryResult {
  aura: ComponentInfo[];
  vf: ComponentInfo[];
  avgScore: number;
  avgGrade: GradeLevel;
}

export async function discoverComponents(
  projectPath: string
): Promise<DiscoveryResult> {
  const auraComponents: ComponentInfo[] = [];
  const vfComponents: ComponentInfo[] = [];

  // Common paths to search for Salesforce components
  const searchPaths = [
    'force-app/main/default/aura',
    'src/aura',
    'aura',
    'force-app/main/default/pages',
    'src/pages',
    'pages',
  ];

  for (const searchPath of searchPaths) {
    const fullPath = path.join(projectPath, searchPath);

    if (await fs.pathExists(fullPath)) {
      if (searchPath.includes('aura')) {
        const components = await discoverAuraComponents(fullPath);
        auraComponents.push(...components);
      } else if (searchPath.includes('pages')) {
        const pages = await discoverVfPages(fullPath);
        vfComponents.push(...pages);
      }
    }
  }

  // Also check for .component files (VF components)
  const vfComponentPaths = [
    'force-app/main/default/components',
    'src/components',
    'components',
  ];

  for (const searchPath of vfComponentPaths) {
    const fullPath = path.join(projectPath, searchPath);
    if (await fs.pathExists(fullPath)) {
      const components = await discoverVfComponents(fullPath);
      vfComponents.push(...components);
    }
  }

  // Calculate average score
  const allComponents = [...auraComponents, ...vfComponents];
  const avgScore =
    allComponents.length > 0
      ? Math.round(
          allComponents.reduce((sum, c) => sum + (c.score || 75), 0) /
            allComponents.length
        )
      : 0;

  const avgGrade = scoreToGrade(avgScore);

  return {
    aura: auraComponents,
    vf: vfComponents,
    avgScore,
    avgGrade,
  };
}

async function discoverAuraComponents(
  auraPath: string
): Promise<ComponentInfo[]> {
  const components: ComponentInfo[] = [];

  try {
    const entries = await fs.readdir(auraPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const componentPath = path.join(auraPath, entry.name);
        const files = await fs.readdir(componentPath);

        // Check if this is a valid Aura component (has .cmp file)
        const cmpFile = files.find((f) => f.endsWith('.cmp'));
        if (cmpFile) {
          components.push({
            id: `aura-${entry.name}`,
            name: entry.name,
            type: 'aura',
            path: componentPath,
            files: files.filter(
              (f) =>
                f.endsWith('.cmp') ||
                f.endsWith('.js') ||
                f.endsWith('.css') ||
                f.endsWith('.auradoc') ||
                f.endsWith('.design') ||
                f.endsWith('.svg')
            ),
            score: estimateComponentScore(files),
            grade: scoreToGrade(estimateComponentScore(files)),
          });
        }
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
  }

  return components;
}

async function discoverVfPages(pagesPath: string): Promise<ComponentInfo[]> {
  const pages: ComponentInfo[] = [];

  try {
    const entries = await fs.readdir(pagesPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.page')) {
        const name = entry.name.replace('.page', '');
        const pagePath = path.join(pagesPath, entry.name);

        // Check for related files
        const relatedFiles = [entry.name];
        const metaFile = `${entry.name}-meta.xml`;
        if (await fs.pathExists(path.join(pagesPath, metaFile))) {
          relatedFiles.push(metaFile);
        }

        pages.push({
          id: `vf-${name}`,
          name,
          type: 'vf',
          path: pagePath,
          files: relatedFiles,
          score: 70, // Default score for VF pages
          grade: 'C',
        });
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
  }

  return pages;
}

async function discoverVfComponents(
  componentsPath: string
): Promise<ComponentInfo[]> {
  const components: ComponentInfo[] = [];

  try {
    const entries = await fs.readdir(componentsPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.component')) {
        const name = entry.name.replace('.component', '');
        const componentPath = path.join(componentsPath, entry.name);

        components.push({
          id: `vf-component-${name}`,
          name,
          type: 'vf',
          path: componentPath,
          files: [entry.name],
          score: 70,
          grade: 'C',
        });
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
  }

  return components;
}

function estimateComponentScore(files: string[]): number {
  // Simple heuristic based on file count and types
  let score = 90;

  // More files = more complex
  if (files.length > 5) score -= 10;
  if (files.length > 8) score -= 10;

  // Has helper = more complex
  if (files.some((f) => f.includes('Helper'))) score -= 5;

  // Has controller = more complex
  if (files.some((f) => f.includes('Controller'))) score -= 5;

  return Math.max(30, Math.min(100, score));
}

function scoreToGrade(score: number): GradeLevel {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
