/**
 * Check for package updates on npm
 * Shows a non-intrusive notification when a new version is available
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { CLI_VERSION, CLI_NAME } from '../cli/options';

const CACHE_FILE = path.join(os.tmpdir(), 'lwc-convert-update-check.json');
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 3000; // 3 second timeout

interface UpdateCache {
    lastCheck: number;
    latestVersion: string | null;
}

async function fetchLatestVersion(): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        const response = await fetch(`https://registry.npmjs.org/${CLI_NAME}/latest`, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        });

        clearTimeout(timeout);

        if (!response.ok) return null;

        const data = await response.json() as { version?: string };
        return data.version || null;
    } catch {
        // Network error, timeout, or offline - fail silently
        return null;
    }
}

function parseVersion(version: string): number[] {
    return version.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
}

function isNewerVersion(latest: string, current: string): boolean {
    const latestParts = parseVersion(latest);
    const currentParts = parseVersion(current);

    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
        const l = latestParts[i] || 0;
        const c = currentParts[i] || 0;
        if (l > c) return true;
        if (l < c) return false;
    }
    return false;
}

async function readCache(): Promise<UpdateCache | null> {
    try {
        if (await fs.pathExists(CACHE_FILE)) {
            return await fs.readJson(CACHE_FILE);
        }
    } catch {
        // Ignore cache read errors
    }
    return null;
}

async function writeCache(cache: UpdateCache): Promise<void> {
    try {
        await fs.writeJson(CACHE_FILE, cache);
    } catch {
        // Ignore cache write errors
    }
}

/**
 * Check for updates and return update info if available
 * This is non-blocking and will not throw errors
 */
export async function checkForUpdates(): Promise<{ hasUpdate: boolean; latestVersion?: string; currentVersion: string }> {
    const currentVersion = CLI_VERSION;
    const result = { hasUpdate: false, currentVersion, latestVersion: undefined as string | undefined };

    try {
        // Check cache first
        const cache = await readCache();
        const now = Date.now();

        if (cache && (now - cache.lastCheck) < CHECK_INTERVAL_MS) {
            // Use cached result
            if (cache.latestVersion && isNewerVersion(cache.latestVersion, currentVersion)) {
                result.hasUpdate = true;
                result.latestVersion = cache.latestVersion;
            }
            return result;
        }

        // Fetch latest version (don't await in main flow if possible)
        const latestVersion = await fetchLatestVersion();

        // Update cache
        await writeCache({ lastCheck: now, latestVersion });

        if (latestVersion && isNewerVersion(latestVersion, currentVersion)) {
            result.hasUpdate = true;
            result.latestVersion = latestVersion;
        }
    } catch {
        // Fail silently - update check should never break the tool
    }

    return result;
}

/**
 * Format update notification message
 */
export function formatUpdateMessage(latestVersion: string, currentVersion: string): string {
    const versionText = `${currentVersion} → ${latestVersion}`;
    return `\x1b[33m  ╭───────────────────────────────────────────────╮
  │  Update available: ${versionText.padEnd(25)} │
  │  Run \x1b[36mnpm i -g ${CLI_NAME}\x1b[33m to update       │
  ╰───────────────────────────────────────────────╯\x1b[0m`;
}
