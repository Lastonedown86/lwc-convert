/**
 * Update Checker Tests
 * Tests for npm version check and update notification formatting
 */

import { checkForUpdates, formatUpdateMessage } from '../../../src/utils/update-checker';

jest.mock('fs-extra', () => ({
  pathExists: jest.fn().mockResolvedValue(false),
  readJson: jest.fn(),
  writeJson: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/cli/options', () => ({
  CLI_VERSION: '1.0.0',
  CLI_NAME: 'lwc-convert',
}));

const fsExtra = require('fs-extra');

describe('formatUpdateMessage', () => {
  it('includes current and latest version', () => {
    const msg = formatUpdateMessage('2.0.0', '1.0.0');
    expect(msg).toContain('1.0.0');
    expect(msg).toContain('2.0.0');
  });

  it('includes install command', () => {
    const msg = formatUpdateMessage('2.0.0', '1.0.0');
    expect(msg).toContain('npm i -g lwc-convert');
  });

  it('renders box drawing characters', () => {
    const msg = formatUpdateMessage('2.0.0', '1.0.0');
    expect(msg).toContain('╭');
    expect(msg).toContain('╰');
    expect(msg).toContain('│');
  });

  it('handles long version strings', () => {
    const msg = formatUpdateMessage('10.20.300', '9.18.200');
    expect(msg).toContain('9.18.200');
    expect(msg).toContain('10.20.300');
  });
});

describe('checkForUpdates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fsExtra.pathExists.mockResolvedValue(false);
    fsExtra.writeJson.mockResolvedValue(undefined);
  });

  it('returns hasUpdate: false and currentVersion when fetch fails', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const result = await checkForUpdates();
    expect(result.hasUpdate).toBe(false);
    expect(result.currentVersion).toBe('1.0.0');
  });

  it('returns hasUpdate: false when already on latest version', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '1.0.0' }),
    } as Response);

    const result = await checkForUpdates();
    expect(result.hasUpdate).toBe(false);
  });

  it('returns hasUpdate: true when a newer version is available', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '2.0.0' }),
    } as Response);

    const result = await checkForUpdates();
    expect(result.hasUpdate).toBe(true);
    expect(result.latestVersion).toBe('2.0.0');
  });

  it('returns hasUpdate: false when current version is ahead of registry', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '0.9.0' }),
    } as Response);

    const result = await checkForUpdates();
    expect(result.hasUpdate).toBe(false);
  });

  it('uses cached result when cache is fresh (under 24h)', async () => {
    fsExtra.pathExists.mockResolvedValue(true);
    fsExtra.readJson.mockResolvedValue({
      lastCheck: Date.now() - 1000, // 1 second ago
      latestVersion: '2.0.0',
    });

    const fetchSpy = jest.spyOn(global, 'fetch');

    const result = await checkForUpdates();
    expect(result.hasUpdate).toBe(true);
    expect(result.latestVersion).toBe('2.0.0');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('re-fetches when cache is stale (older than 24h)', async () => {
    fsExtra.pathExists.mockResolvedValue(true);
    fsExtra.readJson.mockResolvedValue({
      lastCheck: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      latestVersion: '1.5.0',
    });

    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '2.0.0' }),
    } as Response);

    const result = await checkForUpdates();
    expect(result.hasUpdate).toBe(true);
    expect(result.latestVersion).toBe('2.0.0');
    expect(global.fetch).toHaveBeenCalled();
  });

  it('returns hasUpdate: false on non-ok HTTP response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    const result = await checkForUpdates();
    expect(result.hasUpdate).toBe(false);
  });
});
