---
name: git-workflow
description: >
  Enforce standardized Git conventions for the OpenClaw Launcher project.
  Use when committing code, creating branches, writing PR descriptions,
  or any Git operation. Ensures Conventional Commits, branch naming,
  and clean history for team collaboration.
---

# Git Workflow Standards

## Commit Message Format (Conventional Commits)

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | When to Use |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no logic change |
| `refactor` | Code restructuring, no behavior change |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `build` | Build system or dependencies |
| `ci` | CI/CD configuration |
| `chore` | Maintenance tasks |

### Scopes (project-specific)

| Scope | Area |
|---|---|
| `env` | `environment.rs` — Node.js sandbox |
| `source` | `openclaw.rs` — source download & npm |
| `service` | `service.rs` — process lifecycle |
| `ui` | React frontend (App.tsx, CSS) |
| `tauri` | Tauri config, lib.rs, Cargo.toml |
| `ci` | GitHub Actions workflows |
| `docs` | PRD, TODO, phase docs |

### Examples

```
feat(env): add ARM64 Node.js download support
fix(service): handle zombie process on ungraceful shutdown
docs(docs): update Phase 2 task list
ci(ci): add macOS Intel build target
refactor(tauri): extract shared download logic to utils module
```

### Rules

- Subject line ≤ 72 characters, imperative mood, no period
- Body wraps at 80 characters, explains **why** not **what**
- Breaking changes: add `BREAKING CHANGE:` footer or `!` after type
- Reference issues: `Closes #123` or `Fixes #45`

## Branch Strategy (GitHub Flow)

```
main (protected, always deployable)
 ├── feat/portable-node-arm64
 ├── fix/npm-install-timeout
 ├── docs/update-prd-phase2
 └── release/v0.2.0
```

### Branch Naming

```
<type>/<short-description>
```

- Use lowercase, hyphens only
- Types: `feat/`, `fix/`, `docs/`, `refactor/`, `ci/`, `release/`
- Examples: `feat/system-tray`, `fix/mirror-fallback`, `release/v0.2.0`

### Rules

- Never commit directly to `main` — always use branches + PR
- Keep branches short-lived (< 1 week)
- Rebase onto `main` before merging to keep linear history
- Delete branch after merge

## Pull Request Template

```markdown
## What

Brief description of change.

## Why

Motivation and context.

## How

Key implementation details.

## Test

- [ ] `npm run tauri build` passes with 0 errors
- [ ] Tested on: [Linux / Windows / macOS]
- [ ] New Tauri commands verified via frontend

## Screenshots (if UI change)
```

## Git Commands Cheat Sheet

```bash
# Start new feature
git checkout main && git pull
git checkout -b feat/my-feature

# Commit with convention
git add .
git commit -m "feat(scope): description"

# Push and create PR
git push -u origin feat/my-feature

# Release tag (triggers CI build)
git tag v0.x.0
git push origin v0.x.0
```

## Tagging & Releases

- Use semantic versioning: `vMAJOR.MINOR.PATCH`
- Tags trigger GitHub Actions cross-platform builds
- `v0.x.0` = Phase development, `v1.0.0` = production ready
- Every tag automatically creates a GitHub Release with downloadable installers
