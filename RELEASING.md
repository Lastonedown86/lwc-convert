# Release Process

This document describes how releases work for lwc-convert. We use **release-please** for fully automated releases.

## How It Works

```
1. Push commits to main with conventional commit prefixes (fix:, feat:)
                              ↓
2. release-please automatically creates a Release PR
                              ↓
3. Release PR auto-merges (or merge manually)
                              ↓
4. GitHub Actions: Tests → Build → npm publish → GitHub Release
```

## Conventional Commits (Important!)

**Only these commit prefixes trigger a release:**

| Prefix | Version Bump | Example |
|--------|-------------|---------|
| `fix:` | Patch (1.0.0 → 1.0.1) | `fix: resolve parsing error` |
| `feat:` | Minor (1.0.0 → 1.1.0) | `feat: add new command` |
| `feat!:` | Major (1.0.0 → 2.0.0) | `feat!: breaking API change` |
| `BREAKING CHANGE:` | Major | In commit body |

**These prefixes do NOT trigger releases:**
- `chore:` - Maintenance tasks
- `docs:` - Documentation only
- `refactor:` - Code refactoring
- `test:` - Test changes
- `ci:` - CI changes

## Making a Release

### Standard Flow

1. **Create a branch and make changes:**
   ```bash
   git checkout -b fix/my-fix
   # Make changes
   git add .
   git commit -m "fix: description of the fix"
   git push -u origin fix/my-fix
   ```

2. **Create a PR with a releasable title:**
   ```bash
   gh pr create --title "fix: description of the fix" --base main
   ```

   > ⚠️ **Important:** When squash-merging, the PR title becomes the commit message. Use `fix:` or `feat:` prefix!

3. **Merge the PR** - release-please will automatically:
   - Create a Release PR (e.g., "chore(main): release 1.2.3")
   - Update CHANGELOG.md
   - Bump version in package.json

4. **Release PR merges** (auto or manual) → npm publish happens automatically

### Checking Status

```bash
# Check for release PR
gh pr list --state open

# Check recent workflow runs
gh run list --limit 5

# Verify published version
npm view lwc-convert version
```

## Common Issues

### Release didn't happen after merging PR

**Cause:** PR title or commits used non-releasable prefix (e.g., `chore:`)

**Solution:** Add a fix commit:
```bash
git checkout main
git pull
git commit --allow-empty -m "fix: trigger release for previous changes"
git push
```

### release-please PR not auto-merging

**Solution:** Merge manually:
```bash
gh pr merge <pr-number> --squash
```

### Need to check why release was skipped

```bash
gh run list --limit 5
gh run view <run-id>
gh run view --log --job=<job-id> | grep -i "skip\|release\|user facing"
```

## Prerequisites

- **npm Token:** Set as `NPM_TOKEN` secret in GitHub repository settings
- **GitHub Token:** Automatic via `GITHUB_TOKEN`

## Manual Release (Emergency Only)

If automated release completely fails:

```bash
git checkout main
git pull
npm version patch  # or minor/major
git push origin main --tags
```

## Semantic Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features, backwards compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, backwards compatible

## Files Updated by release-please

- `package.json` - Version number
- `CHANGELOG.md` - Release notes from conventional commits
