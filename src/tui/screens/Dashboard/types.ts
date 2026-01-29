import type { ScreenType, GradeLevel, ComponentType } from '../../types.js';

export type DashboardItemType = 'quick-action' | 'project-stat' | 'recent-conversion';

export type QuickActionId = 'convert' | 'grade' | 'browse' | 'settings';

export interface DashboardItem {
  id: string;
  type: DashboardItemType;
  label: string;
  description: string;
  icon?: string;
  category: string;
  metadata?: Record<string, unknown>;
}

export interface QuickActionItem extends DashboardItem {
  type: 'quick-action';
  shortcut: string;
  enabled: boolean;
  action: () => void;
  detailedDescription: string;
  steps: string[];
}

export interface ProjectStatItem extends DashboardItem {
  type: 'project-stat';
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
  detailLabel?: string;
}

export interface RecentConversionItem extends DashboardItem {
  type: 'recent-conversion';
  timestamp: Date;
  success: boolean;
  componentName: string;
  componentType: ComponentType;
  grade?: GradeLevel;
  score?: number;
}

export interface DashboardState {
  selectedIndex: number;
  selectedCategory: string;
  isRefreshing: boolean;
  lastRefresh: Date | null;
  showFirstTime: boolean;
}
