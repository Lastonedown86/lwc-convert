# Release Process

This document describes how to release a new version of lwc-convert to npm.

## Prerequisites

Before releasing, ensure you have:

1. **npm Account**: You need an npm account with publish rights to the `lwc-convert` package
2. **npm Token**: Set up as `NPM_TOKEN` secret in GitHub repository settings
3. **Clean Working Directory**: All changes committed and pushed
4. **Tests Passing**: All tests pass locally and in CI
5. **On Main Branch**: Usually you should be on the `main` branch

## Setting Up npm Token (First Time Only)

1. Generate an npm access token:
   ```bash
   npm login
   npm token create --read-only=false
   ```

2. Add the token as a GitHub secret:
   - Go to: https://github.com/Lastonedown86/lwc-convert/settings/secrets/actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Your npm token

## Release Workflow

### Overview

The release process is automated to ensure npm and GitHub stay in sync:

```
Local: Version Bump → Git Tag → Push
   ↓
GitHub Actions: Tests → Build → npm Publish → GitHub Release
```

### Step-by-Step Process

1. **Ensure working directory is clean**
   ```bash
   git status
   # Should show no uncommitted changes
   ```

2. **Pull latest changes**
   ```bash
   git pull origin main
   ```

3. **Run the release script**
   ```bash
   # For a patch release (1.0.0 -> 1.0.1)
   npm run release:patch

   # For a minor release (1.0.0 -> 1.1.0)
   npm run release:minor

   # For a major release (1.0.0 -> 2.0.0)
   npm run release:major
   ```

4. **What the script does**:
   - Verifies working directory is clean
   - Runs tests and build
   - Bumps version in package.json
   - Creates a git commit with the version
   - Creates a git tag (e.g., `v1.0.1`)
   - Pushes commit and tag to GitHub

5. **GitHub Actions automatically**:
   - Runs tests and build
   - Verifies package.json version matches the git tag
   - Publishes to npm with provenance
   - Creates a GitHub release

6. **Monitor the release**:
   - Watch GitHub Actions: https://github.com/Lastonedown86/lwc-convert/actions
   - Check npm: https://www.npmjs.com/package/lwc-convert

### Updating the Changelog

Before or after releasing, update `CHANGELOG.md`:

1. Move items from `[Unreleased]` to a new version section
2. Add the release date
3. Update the comparison links at the bottom
4. Commit the changes

Example:
```markdown
## [Unreleased]

## [1.0.1] - 2026-01-23

### Fixed
- Bug in conversion logic

[Unreleased]: https://github.com/Lastonedown86/lwc-convert/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/Lastonedown86/lwc-convert/releases/tag/v1.0.1
```

## Semantic Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0 -> 2.0.0): Breaking changes
- **MINOR** (1.0.0 -> 1.1.0): New features, backwards compatible
- **PATCH** (1.0.0 -> 1.0.1): Bug fixes, backwards compatible

## Manual Release (Not Recommended)

If you need to publish manually:

```bash
# Bump version
npm version patch  # or minor, or major

# Build
npm run build

# Publish
npm publish --access public

# Push tags
git push origin main --tags
```

## Troubleshooting

### Release script fails

- Ensure working directory is clean: `git status`
- Ensure you're on main branch: `git branch --show-current`
- Ensure tests pass: `npm test`

### GitHub Actions fails to publish

- Check npm token is set correctly in GitHub secrets
- Verify package.json version matches the tag
- Check build logs in GitHub Actions

### Version mismatch error

If package.json version doesn't match the tag, the publish will fail. This is intentional to prevent inconsistencies.

To fix:
```bash
# Delete the tag locally and remotely
git tag -d v1.0.1
git push origin :refs/tags/v1.0.1

# Fix package.json version
# Run release script again
```

## Best Practices

1. **Always use the release script** - Don't manually bump versions
2. **Update CHANGELOG.md** - Keep users informed of changes
3. **Test before releasing** - Run `npm test` and `npm run build`
4. **Release from main** - Avoid releasing from feature branches
5. **One release at a time** - Wait for CI to complete before next release
6. **Meaningful commits** - Ensure commits since last release are well-documented
7. **Review changes** - Use `git log` to review what's being released

## GitHub-npm Synchronization

This workflow ensures GitHub and npm stay in sync by:

1. **Git tags drive releases**: Publishing only happens when tags are pushed
2. **Version verification**: CI checks package.json matches the tag
3. **Single source of truth**: The git tag is the authoritative version
4. **Provenance**: npm publish includes provenance linking to the GitHub commit
5. **GitHub releases**: Automatically created with links to CHANGELOG

This means:
- Every npm version has a corresponding git tag
- Every npm version has a GitHub release
- The exact code on GitHub is what's on npm
- You can verify npm package provenance back to the source code
