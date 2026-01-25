module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature (minor bump)
        'fix',      // Bug fix (patch bump)
        'docs',     // Documentation only
        'style',    // Code style (formatting, etc)
        'refactor', // Code change that neither fixes a bug nor adds a feature
        'perf',     // Performance improvement
        'test',     // Adding or updating tests
        'build',    // Build system or dependencies
        'ci',       // CI/CD changes
        'chore',    // Other changes (no release)
        'revert',   // Revert a commit
      ],
    ],
  },
};
