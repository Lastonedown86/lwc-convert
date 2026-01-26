# Release & Deployment Guide

You are helping with releases and deployments for lwc-convert. This repo uses **release-please** for automated releases.

## Release Workflow Overview

```
Developer: Push commits to main with conventional commit prefixes
    ↓
release-please: Detects releasable commits → Creates Release PR
    ↓
Auto-merge: Release PR merges automatically
    ↓
GitHub Actions: Tests → Build → npm publish → GitHub Release
```

## Conventional Commits (CRITICAL)

**Only these prefixes trigger a release:**
- `fix:` → Patch version bump (1.0.0 → 1.0.1)
- `feat:` → Minor version bump (1.0.0 → 1.1.0)
- `feat!:` or `fix!:` or `BREAKING CHANGE:` → Major version bump (1.0.0 → 2.0.0)

**These prefixes do NOT trigger releases:**
- `chore:` - Maintenance tasks
- `docs:` - Documentation only
- `style:` - Code style changes
- `refactor:` - Code refactoring (no functional change)
- `test:` - Adding/updating tests
- `ci:` - CI configuration changes

## Creating a Release Branch

```bash
# 1. Create branch from main
git checkout main
git pull origin main
git checkout -b fix/description-of-fix

# 2. Make changes and commit with proper prefix
git add .
git commit -m "fix: description of the fix"

# 3. Push and create PR
git push -u origin fix/description-of-fix
gh pr create --title "fix: description of the fix" --base main
```

## Common Gotchas

### 1. Squash Merge Uses PR Title
When a PR is squash-merged, the **PR title becomes the commit message**. If your PR title starts with `chore:`, no release will be created!

**Wrong:**
```
PR Title: "chore: update dependencies"  ❌ Won't trigger release
```

**Right:**
```
PR Title: "fix: update dependencies for compatibility"  ✅ Will trigger release
```

### 2. Release-Please Creates Its Own PR
After your PR merges, release-please creates a separate PR titled:
```
chore(main): release X.X.X
```
This PR updates CHANGELOG.md and package.json version. When IT merges, npm publish happens.

### 3. If Release Didn't Happen
If you merged a PR but no release was created:

```bash
# Check if release-please PR exists
gh pr list --state open

# If no PR, your commits weren't "releasable"
# Add a fix commit to trigger release-please:
git checkout main
git pull origin main
echo "" >> README.md  # Or make a real fix
git add .
git commit -m "fix: trigger release for previous changes"
git push origin main
```

## Checking Release Status

```bash
# View recent workflow runs
gh run list --limit 5

# Check specific run
gh run view <run-id>

# View release-please job logs
gh run view --log --job=<job-id> | grep -E "(release|PR|skip|version)"

# Check if release PR exists
gh pr list --state open --search "release"

# Verify npm version after release
npm view lwc-convert version
```

## Manual Release (Emergency Only)

If automated release fails:

```bash
# 1. Ensure on main with clean state
git checkout main
git pull origin main
git status  # Should be clean

# 2. Bump version manually
npm version patch  # or minor/major

# 3. Push with tags
git push origin main --tags

# This will trigger the publish workflow
```

## GitHub Actions Workflows

### `.github/workflows/release.yml`
- Runs on push to main
- `release-please` job: Creates/updates release PR
- `publish` job: Only runs when release-please creates a GitHub release

### `.github/workflows/ci.yml`
- Runs on all pushes and PRs
- Runs tests and build verification

## Branch Naming Conventions

```
fix/short-description     # Bug fixes
feat/short-description    # New features
docs/short-description    # Documentation
refactor/short-description # Code refactoring
test/short-description    # Test additions
```

## Quick Reference

| Action | Command |
|--------|---------|
| Create fix branch | `git checkout -b fix/description` |
| Create feature branch | `git checkout -b feat/description` |
| Check open PRs | `gh pr list` |
| Check workflow runs | `gh run list --limit 5` |
| View npm version | `npm view lwc-convert version` |
| Check release PR | `gh pr list --search "chore(main): release"` |

## Troubleshooting

**"No user facing commits found"** in release-please logs:
- Your commits used non-releasable prefixes (chore:, docs:, etc.)
- Solution: Add a `fix:` or `feat:` commit

**Publish job was skipped:**
- `release_created` output was false
- This means release-please didn't create a release yet
- Wait for the release PR to be created and merged

**Release PR not auto-merging:**
- Check if CI passed on the release PR
- Manually merge with: `gh pr merge <pr-number> --squash`
