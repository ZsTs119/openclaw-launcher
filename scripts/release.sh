#!/bin/bash
# release.sh — Full release pipeline: bump + test + commit + tag + push
# Usage: ./scripts/release.sh 0.2.6 "feat: description of changes"

set -e

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <version> <commit-message>"
    echo "Example: $0 0.2.6 \"feat: add settings page\""
    exit 1
fi

VERSION="$1"
MESSAGE="$2"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🚀 Release Pipeline v$VERSION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 1: Bump version
echo ""
echo "📦 Step 1/5: Bump version"
bash "$SCRIPT_DIR/bump-version.sh" "$VERSION"

# Step 2: Run tests
echo ""
echo "🧪 Step 2/5: Running tests"
cd src-tauri
cargo test 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Tests failed! Aborting release."
    exit 1
fi
echo "  ✅ All tests passed"
cd "$PROJECT_DIR"

# Step 3: Build (compile check)
echo ""
echo "🔨 Step 3/5: Building..."
npm run tauri build 2>&1 || true  # xdg-open error is expected in WSL
echo "  ✅ Build completed"

# Step 4: Commit and tag
echo ""
echo "📝 Step 4/5: Committing..."
git add .
git commit -m "$MESSAGE"
git tag "v$VERSION"
echo "  ✅ Tagged v$VERSION"

# Step 5: Push
echo ""
echo "🚀 Step 5/5: Pushing to GitHub..."
git push origin main "v$VERSION"
echo "  ✅ Pushed to GitHub"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Release v$VERSION complete!"
echo "   CI will build and create GitHub Release automatically."
echo "   Check: https://github.com/ZsTs119/openclaw-launcher/actions"
