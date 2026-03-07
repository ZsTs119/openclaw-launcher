---
description: Build, test, bump version, commit, and push the project to GitHub
---

# Build and Push Workflow

## Prerequisites
- Ensure you are in the project root: `/home/zsts/openclaw-switch/openclaw-launcher`
- All changes should be committed or staged before running

## Steps

### 1. Determine the new version
Ask the user what version to release, or auto-increment the patch version.

### 2. Bump version across all files
// turbo
```bash
cd /home/zsts/openclaw-switch/openclaw-launcher && bash scripts/bump-version.sh <VERSION>
```

### 3. Run Rust unit tests
// turbo
```bash
cd /home/zsts/openclaw-switch/openclaw-launcher/src-tauri && source "$HOME/.cargo/env" && cargo test
```

### 4. Build Tauri application
// turbo
```bash
cd /home/zsts/openclaw-switch/openclaw-launcher && source "$HOME/.cargo/env" && npm run tauri build 2>&1
```
Note: `xdg-open not found` error on WSL is expected and can be ignored.

### 5. Commit, tag, and push
```bash
cd /home/zsts/openclaw-switch/openclaw-launcher && git add . && git commit -m "<COMMIT_MESSAGE>" && git tag v<VERSION> && git push origin main v<VERSION>
```

Replace `<COMMIT_MESSAGE>` with a conventional commit message (e.g., `feat: add settings page`).
Replace `<VERSION>` with the version from Step 2.
