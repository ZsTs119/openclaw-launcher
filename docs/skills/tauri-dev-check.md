---
name: tauri-dev-check
description: >
  Standard verification pipeline for Tauri (Rust + React) development.
  Use BEFORE every git commit, after making code changes to .rs or .tsx/.ts files,
  or when the user asks to verify/check/build the project.
  Ensures cargo check + tsc pass before committing.
---

# Tauri Dev Check Pipeline

## 验证流程（每次提交前必须执行）

### Step 1: Rust 编译检查
```bash
source "$HOME/.cargo/env" && cd src-tauri && cargo check 2>&1 | tail -5
```
- 如果失败 → 修复 Rust 编译错误后重试
- 常见问题：未使用变量（warning 可忽略）、类型不匹配、缺少 import

### Step 2: TypeScript 类型检查
```bash
npx tsc --noEmit 2>&1 | tail -5
```
- 如果失败 → 修复 TypeScript 类型错误后重试
- 常见问题：类型契约不同步（`types/index.ts` 与 `agents.rs` 不匹配）

### Step 3: Rust 单元测试（如果改了 Rust 逻辑）
```bash
source "$HOME/.cargo/env" && cd src-tauri && cargo test 2>&1 | tail -10
```
- 仅在修改了 `.rs` 文件中的业务逻辑时执行
- 纯 struct 字段新增不需要跑测试

## 类型契约同步

**Rust struct 和 TypeScript interface 必须保持一致**：

| Rust 文件 | TypeScript 文件 |
|---|---|
| `agents.rs` → `AgentInfo` | `types/index.ts` → `AgentInfo` |
| `agents.rs` → `AgentDetail` | `types/index.ts` → `AgentDetail` |
| `agents.rs` → `SessionInfo` | `types/index.ts` → `SessionInfo` |
| `provider_mgr.rs` → `SavedProvider` | `types/index.ts` → `SavedProvider` |

新增字段时：Rust 用 `Option<T>`，TypeScript 用 `T | null`。

## 提交规范

通过所有检查后，使用 git-workflow skill 的 Conventional Commits 格式提交：

```bash
git add -A && git commit --no-gpg-sign -m "<type>: <description>"
```

## 常用命令速查

```bash
# 完整检查（复制即用）
source "$HOME/.cargo/env" && cd src-tauri && cargo check 2>&1 | tail -5 && cd .. && npx tsc --noEmit 2>&1 | tail -5

# 带测试的完整检查
source "$HOME/.cargo/env" && cd src-tauri && cargo check && cargo test 2>&1 | tail -10 && cd .. && npx tsc --noEmit 2>&1 | tail -5
```
