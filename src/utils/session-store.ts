/**
 * Session Store - Stores conversion data in a temp folder during user's session
 * 
 * This allows the tool to:
 * 1. Learn from past conversions in the session
 * 2. Provide suggestions based on similar patterns
 * 3. Track conversion success/failure rates
 * 4. Reuse behavior mappings for similar components
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BehaviorTest, TestComparisonResult } from '../generators/test-comparison';
import { logger } from './logger';

// Session file location - persistent across invocations
const SESSIONS_BASE_DIR = path.join(os.tmpdir(), 'lwc-convert-sessions');
const ACTIVE_SESSION_FILE = path.join(SESSIONS_BASE_DIR, 'active-session.json');
// Sessions expire after 4 hours of inactivity
const SESSION_EXPIRY_MS = 4 * 60 * 60 * 1000;

export interface ConversionRecord {
  id: string;
  timestamp: Date;
  sourceType: 'aura' | 'vf';
  sourceName: string;
  targetName: string;
  sourcePath: string;
  outputPath: string;
  behaviorCount: number;
  behaviors: BehaviorSummary[];
  patterns: PatternRecord[];
  warnings: string[];
  success: boolean;
  testResults?: TestResultSummary;
}

export interface BehaviorSummary {
  id: string;
  category: string;
  name: string;
  auraPattern: string;
  lwcPattern: string;
  verified?: boolean;
}

export interface PatternRecord {
  type: 'component' | 'expression' | 'event' | 'apex' | 'lms' | 'lifecycle';
  auraPattern: string;
  lwcPattern: string;
  frequency: number;
  successRate: number;
}

export interface TestResultSummary {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  runAt?: Date;
}

export interface SessionSummary {
  sessionId: string;
  startedAt: Date;
  conversions: number;
  totalBehaviors: number;
  patternLibrary: PatternRecord[];
  commonWarnings: Array<{ warning: string; count: number }>;
}

interface ActiveSessionInfo {
  sessionId: string;
  sessionDir: string;
  startedAt: string;
  lastActivityAt: string;
}

class SessionStore {
  private sessionId: string = '';
  private sessionDir: string = '';
  private conversions: ConversionRecord[] = [];
  private patternLibrary: Map<string, PatternRecord> = new Map();
  private initialized: boolean = false;
  private startedAt: Date = new Date();

  constructor() {
    // Will be initialized lazily
  }

  /**
   * Try to load an existing active session
   */
  private async tryLoadExistingSession(): Promise<boolean> {
    try {
      if (!fs.existsSync(ACTIVE_SESSION_FILE)) {
        return false;
      }

      const activeInfo: ActiveSessionInfo = JSON.parse(
        await fs.promises.readFile(ACTIVE_SESSION_FILE, 'utf-8')
      );

      // Check if session has expired
      const lastActivity = new Date(activeInfo.lastActivityAt).getTime();
      if (Date.now() - lastActivity > SESSION_EXPIRY_MS) {
        logger.debug('Previous session expired, starting new session');
        // Clean up expired session
        try {
          await fs.promises.rm(activeInfo.sessionDir, { recursive: true, force: true });
        } catch { /* ignore */ }
        return false;
      }

      // Check if session directory still exists
      if (!fs.existsSync(activeInfo.sessionDir)) {
        return false;
      }

      // Load the session
      this.sessionId = activeInfo.sessionId;
      this.sessionDir = activeInfo.sessionDir;
      this.startedAt = new Date(activeInfo.startedAt);

      // Load existing conversions
      await this.loadConversions();

      logger.debug(`Resumed session: ${this.sessionId}`);
      return true;
    } catch (error: any) {
      logger.debug(`Failed to load existing session: ${error.message}`);
      return false;
    }
  }

  /**
   * Load conversions from session directory
   */
  private async loadConversions(): Promise<void> {
    try {
      const conversionsDir = path.join(this.sessionDir, 'conversions');
      if (!fs.existsSync(conversionsDir)) return;

      const files = await fs.promises.readdir(conversionsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.promises.readFile(
            path.join(conversionsDir, file),
            'utf-8'
          );
          const record = JSON.parse(content);
          record.timestamp = new Date(record.timestamp);
          this.conversions.push(record);
          
          // Rebuild pattern library
          for (const pattern of record.patterns) {
            this.updatePatternLibrary([pattern]);
          }
        }
      }
    } catch (error: any) {
      logger.debug(`Failed to load conversions: ${error.message}`);
    }
  }

  /**
   * Create a new session
   */
  private async createNewSession(): Promise<void> {
    this.sessionId = `lwc-convert-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    this.sessionDir = path.join(SESSIONS_BASE_DIR, this.sessionId);
    this.startedAt = new Date();

    // Create session directory
    await fs.promises.mkdir(this.sessionDir, { recursive: true });
    await fs.promises.mkdir(path.join(this.sessionDir, 'conversions'), { recursive: true });
    await fs.promises.mkdir(path.join(this.sessionDir, 'patterns'), { recursive: true });
    await fs.promises.mkdir(path.join(this.sessionDir, 'tests'), { recursive: true });

    // Write session info
    const sessionInfo = {
      sessionId: this.sessionId,
      startedAt: this.startedAt.toISOString(),
      platform: os.platform(),
      nodeVersion: process.version,
    };
    await fs.promises.writeFile(
      path.join(this.sessionDir, 'session.json'),
      JSON.stringify(sessionInfo, null, 2)
    );

    logger.debug(`Created new session: ${this.sessionId}`);
  }

  /**
   * Update the active session file
   */
  private async updateActiveSessionFile(): Promise<void> {
    const activeInfo: ActiveSessionInfo = {
      sessionId: this.sessionId,
      sessionDir: this.sessionDir,
      startedAt: this.startedAt.toISOString(),
      lastActivityAt: new Date().toISOString(),
    };

    await fs.promises.mkdir(SESSIONS_BASE_DIR, { recursive: true });
    await fs.promises.writeFile(
      ACTIVE_SESSION_FILE,
      JSON.stringify(activeInfo, null, 2)
    );
  }

  /**
   * Initialize the session store (creates temp directory or loads existing session)
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Try to load an existing session first
      const loaded = await this.tryLoadExistingSession();
      
      if (!loaded) {
        // Create a new session
        await this.createNewSession();
      }
      
      // Update activity timestamp
      await this.updateActiveSessionFile();

      this.initialized = true;
      logger.debug(`Session store initialized: ${this.sessionDir}`);
    } catch (error: any) {
      logger.debug(`Failed to initialize session store: ${error.message}`);
      // Continue without session store - it's not critical
    }
  }

  /**
   * Get the session directory path
   */
  getSessionDir(): string {
    return this.sessionDir;
  }

  /**
   * Get the session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Store a conversion record
   */
  async storeConversion(
    sourceType: 'aura' | 'vf',
    sourceName: string,
    targetName: string,
    sourcePath: string,
    outputPath: string,
    testComparison: TestComparisonResult,
    warnings: string[]
  ): Promise<ConversionRecord> {
    await this.init();

    const record: ConversionRecord = {
      id: `conv-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
      sourceType,
      sourceName,
      targetName,
      sourcePath,
      outputPath,
      behaviorCount: testComparison.behaviorTests.length,
      behaviors: testComparison.behaviorTests.map(b => ({
        id: b.id,
        category: b.category,
        name: b.name,
        auraPattern: b.auraBehavior.pattern,
        lwcPattern: b.lwcBehavior.pattern,
      })),
      patterns: this.extractPatterns(testComparison.behaviorTests),
      warnings,
      success: true,
    };

    this.conversions.push(record);

    // Update pattern library
    this.updatePatternLibrary(record.patterns);

    // Save to file
    try {
      const conversionFile = path.join(this.sessionDir, 'conversions', `${record.id}.json`);
      await fs.promises.writeFile(conversionFile, JSON.stringify(record, null, 2));

      // Also save the full test comparison data
      const testFile = path.join(this.sessionDir, 'tests', `${targetName}-comparison.json`);
      await fs.promises.writeFile(testFile, JSON.stringify({
        ...testComparison,
        conversionId: record.id,
        timestamp: record.timestamp,
      }, null, 2));

      // Update session summary
      await this.saveSessionSummary();

      logger.debug(`Stored conversion record: ${record.id}`);
    } catch (error: any) {
      logger.debug(`Failed to store conversion: ${error.message}`);
    }

    return record;
  }

  /**
   * Extract patterns from behavior tests
   */
  private extractPatterns(behaviors: BehaviorTest[]): PatternRecord[] {
    const patterns: PatternRecord[] = [];

    for (const behavior of behaviors) {
      const pattern: PatternRecord = {
        type: this.categorizePattern(behavior.category),
        auraPattern: behavior.auraBehavior.pattern,
        lwcPattern: behavior.lwcBehavior.pattern,
        frequency: 1,
        successRate: 1.0,
      };
      patterns.push(pattern);
    }

    return patterns;
  }

  /**
   * Categorize pattern type
   */
  private categorizePattern(category: string): PatternRecord['type'] {
    switch (category) {
      case 'lifecycle': return 'lifecycle';
      case 'event': return 'event';
      case 'apex': return 'apex';
      case 'lms': return 'lms';
      case 'data':
      case 'ui':
      default:
        return 'component';
    }
  }

  /**
   * Update pattern library with new patterns
   */
  private updatePatternLibrary(patterns: PatternRecord[]): void {
    for (const pattern of patterns) {
      const key = `${pattern.type}:${pattern.auraPattern}`;
      const existing = this.patternLibrary.get(key);

      if (existing) {
        existing.frequency++;
        // Keep running average of success rate
        existing.successRate = (existing.successRate * (existing.frequency - 1) + pattern.successRate) / existing.frequency;
      } else {
        this.patternLibrary.set(key, { ...pattern });
      }
    }
  }

  /**
   * Get suggestions based on past conversions
   */
  getSuggestions(auraPattern: string): PatternRecord[] {
    const suggestions: PatternRecord[] = [];

    for (const [key, pattern] of this.patternLibrary) {
      // Simple similarity check - could be enhanced with fuzzy matching
      if (key.includes(auraPattern) || pattern.auraPattern.includes(auraPattern)) {
        suggestions.push(pattern);
      }
    }

    // Sort by frequency and success rate
    return suggestions.sort((a, b) => {
      const scoreA = a.frequency * a.successRate;
      const scoreB = b.frequency * b.successRate;
      return scoreB - scoreA;
    });
  }

  /**
   * Get common patterns for a specific type
   */
  getCommonPatterns(type: PatternRecord['type']): PatternRecord[] {
    return Array.from(this.patternLibrary.values())
      .filter(p => p.type === type)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }

  /**
   * Get all conversions in this session
   */
  getConversions(): ConversionRecord[] {
    return [...this.conversions];
  }

  /**
   * Get conversion by ID
   */
  getConversion(id: string): ConversionRecord | undefined {
    return this.conversions.find(c => c.id === id);
  }

  /**
   * Update test results for a conversion
   */
  async updateTestResults(conversionId: string, results: TestResultSummary): Promise<void> {
    const conversion = this.conversions.find(c => c.id === conversionId);
    if (!conversion) return;

    conversion.testResults = results;
    conversion.success = results.failed === 0;

    // Update pattern success rates based on test results
    const successRate = results.totalTests > 0 ? results.passed / results.totalTests : 0;
    for (const pattern of conversion.patterns) {
      const key = `${pattern.type}:${pattern.auraPattern}`;
      const existing = this.patternLibrary.get(key);
      if (existing) {
        existing.successRate = (existing.successRate + successRate) / 2;
      }
    }

    // Save updated record
    try {
      const conversionFile = path.join(this.sessionDir, 'conversions', `${conversionId}.json`);
      await fs.promises.writeFile(conversionFile, JSON.stringify(conversion, null, 2));
      await this.saveSessionSummary();
    } catch (error: any) {
      logger.debug(`Failed to update conversion: ${error.message}`);
    }
  }

  /**
   * Get session summary
   */
  getSessionSummary(): SessionSummary {
    const warningCounts = new Map<string, number>();
    for (const conv of this.conversions) {
      for (const warning of conv.warnings) {
        warningCounts.set(warning, (warningCounts.get(warning) || 0) + 1);
      }
    }

    return {
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      conversions: this.conversions.length,
      totalBehaviors: this.conversions.reduce((sum, c) => sum + c.behaviorCount, 0),
      patternLibrary: Array.from(this.patternLibrary.values()),
      commonWarnings: Array.from(warningCounts.entries())
        .map(([warning, count]) => ({ warning, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };
  }

  /**
   * Save session summary to file
   */
  private async saveSessionSummary(): Promise<void> {
    const summary = this.getSessionSummary();
    try {
      await fs.promises.writeFile(
        path.join(this.sessionDir, 'summary.json'),
        JSON.stringify(summary, null, 2)
      );

      // Also save pattern library separately
      await fs.promises.writeFile(
        path.join(this.sessionDir, 'patterns', 'library.json'),
        JSON.stringify(Array.from(this.patternLibrary.values()), null, 2)
      );
    } catch (error: any) {
      logger.debug(`Failed to save session summary: ${error.message}`);
    }
  }

  /**
   * Generate a report of all conversions in the session
   */
  generateSessionReport(): string {
    const summary = this.getSessionSummary();
    
    let report = `# LWC Convert Session Report

## Session Info
- **Session ID**: ${summary.sessionId}
- **Started**: ${summary.startedAt.toISOString()}
- **Total Conversions**: ${summary.conversions}
- **Total Behaviors Mapped**: ${summary.totalBehaviors}

## Conversion Summary

| # | Component | Type | Behaviors | Warnings | Tests |
|---|-----------|------|-----------|----------|-------|
`;

    this.conversions.forEach((conv, index) => {
      const testStatus = conv.testResults 
        ? `${conv.testResults.passed}/${conv.testResults.totalTests} passed`
        : 'Not run';
      report += `| ${index + 1} | ${conv.sourceName} → ${conv.targetName} | ${conv.sourceType} | ${conv.behaviorCount} | ${conv.warnings.length} | ${testStatus} |\n`;
    });

    if (summary.commonWarnings.length > 0) {
      report += `
## Common Warnings

| Warning | Occurrences |
|---------|-------------|
`;
      for (const { warning, count } of summary.commonWarnings) {
        report += `| ${warning.substring(0, 60)}... | ${count} |\n`;
      }
    }

    if (summary.patternLibrary.length > 0) {
      report += `
## Pattern Library (Top 10 Most Used)

| Type | Aura Pattern | LWC Pattern | Uses | Success |
|------|--------------|-------------|------|---------|
`;
      const topPatterns = summary.patternLibrary
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10);
      
      for (const pattern of topPatterns) {
        const auraShort = pattern.auraPattern.substring(0, 30) + (pattern.auraPattern.length > 30 ? '...' : '');
        const lwcShort = pattern.lwcPattern.substring(0, 30) + (pattern.lwcPattern.length > 30 ? '...' : '');
        report += `| ${pattern.type} | \`${auraShort}\` | \`${lwcShort}\` | ${pattern.frequency} | ${(pattern.successRate * 100).toFixed(0)}% |\n`;
      }
    }

    report += `
## Session Files

All session data is stored in:
\`${this.sessionDir}\`

- \`conversions/\` - Individual conversion records
- \`tests/\` - Test comparison data
- \`patterns/library.json\` - Learned patterns
- \`summary.json\` - Session summary
`;

    return report;
  }

  /**
   * Clean up session data (call on exit if desired)
   */
  async cleanup(): Promise<void> {
    try {
      // Remove session directory
      if (this.sessionDir) {
        await fs.promises.rm(this.sessionDir, { recursive: true, force: true });
      }
      // Remove active session file
      if (fs.existsSync(ACTIVE_SESSION_FILE)) {
        await fs.promises.unlink(ACTIVE_SESSION_FILE);
      }
      // Reset state
      this.conversions = [];
      this.patternLibrary.clear();
      this.initialized = false;
      logger.debug(`Cleaned up session: ${this.sessionId}`);
    } catch (error: any) {
      logger.debug(`Failed to cleanup session: ${error.message}`);
    }
  }

  /**
   * Check if a similar component has been converted before
   */
  findSimilarConversion(componentName: string): ConversionRecord | undefined {
    // Simple name similarity - could be enhanced
    return this.conversions.find(c => 
      c.sourceName.toLowerCase().includes(componentName.toLowerCase()) ||
      componentName.toLowerCase().includes(c.sourceName.toLowerCase())
    );
  }

  /**
   * Get behavior suggestions based on component type and past conversions
   */
  getBehaviorSuggestions(componentType: 'aura' | 'vf', behaviors: string[]): string[] {
    const suggestions: string[] = [];
    const pastConversions = this.conversions.filter(c => c.sourceType === componentType);
    
    // Look for behaviors that commonly appear together
    for (const conv of pastConversions) {
      const convBehaviors = conv.behaviors.map(b => b.name);
      const matchCount = behaviors.filter(b => convBehaviors.includes(b)).length;
      
      if (matchCount > 0) {
        // Suggest behaviors from this conversion that aren't in current
        for (const behavior of conv.behaviors) {
          if (!behaviors.includes(behavior.name) && !suggestions.includes(behavior.name)) {
            suggestions.push(behavior.name);
          }
        }
      }
    }

    return suggestions.slice(0, 5);
  }
}

// Singleton instance
export const sessionStore = new SessionStore();
