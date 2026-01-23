#!/bin/bash

# Release script for lwc-convert
# Usage: ./scripts/release.sh [patch|minor|major]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if version type is provided
if [ -z "$1" ]; then
  echo -e "${RED}Error: Version type required${NC}"
  echo "Usage: ./scripts/release.sh [patch|minor|major]"
  echo ""
  echo "Examples:"
  echo "  ./scripts/release.sh patch  # 1.0.0 -> 1.0.1"
  echo "  ./scripts/release.sh minor  # 1.0.0 -> 1.1.0"
  echo "  ./scripts/release.sh major  # 1.0.0 -> 2.0.0"
  exit 1
fi

VERSION_TYPE=$1

# Validate version type
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo -e "${RED}Error: Invalid version type '$VERSION_TYPE'${NC}"
  echo "Must be one of: patch, minor, major"
  exit 1
fi

echo -e "${GREEN}Starting release process...${NC}"

# Check if working directory is clean
if [[ -n $(git status -s) ]]; then
  echo -e "${RED}Error: Working directory is not clean${NC}"
  echo "Please commit or stash your changes before releasing"
  git status -s
  exit 1
fi

# Check if on main branch (or master)
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]] && [[ "$CURRENT_BRANCH" != "master" ]]; then
  echo -e "${YELLOW}Warning: Not on main/master branch (current: $CURRENT_BRANCH)${NC}"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Pull latest changes
echo -e "${GREEN}Pulling latest changes...${NC}"
git pull origin $CURRENT_BRANCH

# Run tests
echo -e "${GREEN}Running tests...${NC}"
npm test

# Run build
echo -e "${GREEN}Building project...${NC}"
npm run build

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}Current version: $CURRENT_VERSION${NC}"

# Bump version (this updates package.json and creates a git commit and tag)
echo -e "${GREEN}Bumping $VERSION_TYPE version...${NC}"
npm version $VERSION_TYPE -m "chore: release v%s"

# Get new version
NEW_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}New version: $NEW_VERSION${NC}"

# Push changes and tags
echo -e "${GREEN}Pushing changes and tags...${NC}"
git push origin $CURRENT_BRANCH
git push origin "v$NEW_VERSION"

echo -e "${GREEN}✓ Release process complete!${NC}"
echo ""
echo "Next steps:"
echo "1. GitHub Actions will automatically publish to npm"
echo "2. Monitor the workflow at: https://github.com/Lastonedown86/lwc-convert/actions"
echo "3. Update CHANGELOG.md with release notes if needed"
echo "4. The package will be available at: https://www.npmjs.com/package/lwc-convert/v/$NEW_VERSION"
