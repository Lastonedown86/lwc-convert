/**
 * TUI Test Setup
 * Sets up the testing environment for Ink components
 */

// Mock process.stdout for terminal size
Object.defineProperty(process.stdout, 'columns', {
  value: 80,
  writable: true,
});

Object.defineProperty(process.stdout, 'rows', {
  value: 24,
  writable: true,
});

// Mock fs-extra for persistence tests
jest.mock('fs-extra', () => ({
  ensureDir: jest.fn().mockResolvedValue(undefined),
  pathExists: jest.fn().mockResolvedValue(false),
  readJson: jest.fn().mockResolvedValue({}),
  writeJson: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

// Silence console during tests unless needed
const originalConsole = { ...console };
beforeAll(() => {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
});
