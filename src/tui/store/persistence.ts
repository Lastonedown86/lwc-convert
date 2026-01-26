import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import type { UserPreferences } from '../types.js';
import { DEFAULT_PREFERENCES } from '../types.js';

const CONFIG_DIR = path.join(os.homedir(), '.lwc-convert');
const PREFS_PATH = path.join(CONFIG_DIR, 'preferences.json');

export async function loadPreferences(): Promise<UserPreferences> {
  try {
    await fs.ensureDir(CONFIG_DIR);

    if (await fs.pathExists(PREFS_PATH)) {
      const data = await fs.readJson(PREFS_PATH);
      // Merge with defaults to handle any new preference fields
      return { ...DEFAULT_PREFERENCES, ...data };
    }
  } catch (error) {
    // If there's an error reading preferences, use defaults
    console.error('Error loading preferences:', error);
  }

  return { ...DEFAULT_PREFERENCES };
}

export async function savePreferences(prefs: UserPreferences): Promise<void> {
  try {
    await fs.ensureDir(CONFIG_DIR);
    await fs.writeJson(PREFS_PATH, prefs, { spaces: 2 });
  } catch (error) {
    console.error('Error saving preferences:', error);
    throw error;
  }
}

export function loadPreferencesSync(): UserPreferences {
  try {
    fs.ensureDirSync(CONFIG_DIR);

    if (fs.pathExistsSync(PREFS_PATH)) {
      const data = fs.readJsonSync(PREFS_PATH);
      return { ...DEFAULT_PREFERENCES, ...data };
    }
  } catch (error) {
    // If there's an error reading preferences, use defaults
  }

  return { ...DEFAULT_PREFERENCES };
}

export async function clearPreferences(): Promise<void> {
  try {
    if (await fs.pathExists(PREFS_PATH)) {
      await fs.remove(PREFS_PATH);
    }
  } catch (error) {
    console.error('Error clearing preferences:', error);
    throw error;
  }
}

export async function exportPreferences(outputPath: string): Promise<void> {
  const prefs = await loadPreferences();
  await fs.writeJson(outputPath, prefs, { spaces: 2 });
}

export async function importPreferences(inputPath: string): Promise<void> {
  const data = await fs.readJson(inputPath);
  const prefs = { ...DEFAULT_PREFERENCES, ...data };
  await savePreferences(prefs);
}
