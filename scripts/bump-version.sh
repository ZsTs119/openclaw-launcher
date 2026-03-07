#!/bin/bash
# bump-version.sh — Sync version across all project files
# Usage: ./scripts/bump-version.sh 0.2.6

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 0.2.6"
    echo ""
    echo "Current versions:"
    echo "  package.json:      $(grep '"version"' package.json | head -1 | sed 's/.*: "//;s/".*//')"
    echo "  Cargo.toml:        $(grep '^version' src-tauri/Cargo.toml | sed 's/.*= "//;s/".*//')"
    echo "  tauri.conf.json:   $(grep '"version"' src-tauri/tauri.conf.json | sed 's/.*: "//;s/".*//')"
    echo "  App.tsx:           $(grep 'header-version' src/App.tsx | sed 's/.*>v//;s/<.*//')"
    exit 1
fi

VERSION="$1"

# Validate semver format
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "❌ Invalid version format: $VERSION"
    echo "   Expected: X.Y.Z (e.g., 0.2.6)"
    exit 1
fi

echo "📦 Bumping version to $VERSION..."

# 1. package.json
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" package.json
echo "  ✅ package.json"

# 2. Cargo.toml (only the first version = line, not dependency versions)
sed -i "0,/^version = \"[^\"]*\"/s//version = \"$VERSION\"/" src-tauri/Cargo.toml
echo "  ✅ src-tauri/Cargo.toml"

# 3. tauri.conf.json
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json
echo "  ✅ src-tauri/tauri.conf.json"

# 4. App.tsx header version display
sed -i "s/header-version\">v[^<]*/header-version\">v$VERSION/" src/App.tsx
echo "  ✅ src/App.tsx"

echo ""
echo "🎉 All files updated to v$VERSION"
echo "   Next: git add . && git commit -m 'chore: bump version to $VERSION'"
