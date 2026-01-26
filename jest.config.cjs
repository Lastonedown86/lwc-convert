module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: ['src/**/*.ts', 'src/**/*.tsx', '!src/index.ts'],
  coverageDirectory: 'coverage',
  verbose: true,
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        jsxImportSource: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      }
    }]
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^ink$': '<rootDir>/tests/__mocks__/ink.ts',
    '^ink-testing-library$': '<rootDir>/tests/__mocks__/ink-testing-library.ts',
    '^ink-spinner$': '<rootDir>/tests/__mocks__/ink-spinner.ts',
    '^ink-text-input$': '<rootDir>/tests/__mocks__/ink-text-input.ts',
    '^ink-select-input$': '<rootDir>/tests/__mocks__/ink-select-input.ts',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup-tui.ts']
};
