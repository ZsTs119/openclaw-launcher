---
name: docs-versioning
description: >
  Manage documentation lifecycle for AI-driven iterative development.
  Use when creating, updating, or archiving PRD, TODO, phase docs, or any project documentation.
  Enforces versioning conventions, directory structure, and changelog tracking
  to maintain clarity across multiple development phases and releases.
---

# Documentation Versioning & Iteration

## Directory Structure

```
docs/
├── PRD.md                  # ← 永远是最新版 (Single Source of Truth)
├── TODO.md                 # ← 永远是最新版，持续更新
├── CHANGELOG.md            # ← 记录每个版本的变更摘要
├── phases/
│   ├── phase1_mvp.md       # 各阶段技术规格（完成后标 ✅）
│   ├── phase2_experience.md
│   └── phase3_ecosystem.md
├── archive/                # 历史版本归档
│   ├── PRD_v0.1.0.md
│   ├── PRD_v0.2.0.md
│   └── TODO_v0.1.0.md
└── skills/                 # 项目 Skills
```

## 核心原则

### 1. 根目录文件 = 最新版

`docs/PRD.md` 和 `docs/TODO.md` **永远代表当前最新状态**。不在文件名中加版本号。
任何 AI 或开发者打开 `docs/PRD.md`，看到的就是最新的需求。

### 2. 改版前先归档

**每次对 PRD 或 TODO 进行重大修订前**，必须先执行归档：

```bash
# 归档当前版本
cp docs/PRD.md docs/archive/PRD_v0.1.0.md
# 然后再修改 docs/PRD.md
```

### 3. CHANGELOG 记录变更

每次版本发布或文档重大变更时，在 `CHANGELOG.md` 顶部追加记录：

```markdown
## [v0.2.0] - 2025-03-15

### PRD 变更
- 新增 System Tray 功能规格
- 调整端口冲突处理方案

### TODO 变更
- Phase 2 任务细化完成
- Phase 1 所有任务标记 ✅

### 代码变更
- 新增 service.rs 进程管理模块
- 前端 UI 从模板升级为暗色控制台
```

## AI 操作规范

### 修改 PRD 时

1. 读取当前 `docs/PRD.md` 了解现有内容
2. 判断修改幅度：
   - **小修**（措辞调整、补充细节）→ 直接编辑，commit message 用 `docs(prd): ...`
   - **大改**（新增模块、删除功能、改变架构）→ 先归档再编辑
3. 归档命令：`cp docs/PRD.md docs/archive/PRD_v{当前版本}.md`
4. 编辑 `docs/PRD.md`
5. 更新 `docs/CHANGELOG.md`
6. Commit: `docs(prd): v0.2.0 - add system tray spec`

### 修改 TODO 时

1. **打勾/更新进度** → 直接编辑
   - Commit: `docs(todo): mark Phase 1 tasks complete`
2. **新增阶段任务/重组结构** → 先归档
   - 归档：`cp docs/TODO.md docs/archive/TODO_v{当前版本}.md`
   - Commit: `docs(todo): v0.2.0 - add Phase 2 detailed tasks`

### 新增阶段文档时

在 `docs/phases/` 下创建，命名格式：`phase{N}_{短描述}.md`

```
phase1_mvp.md           ✅ (完成后在文件顶部标注)
phase2_experience.md    🚧 (开发中)
phase3_ecosystem.md     📋 (待开始)
```

## 版本号规则

版本号跟随 Git Tag 和 `tauri.conf.json` 中的版本：

| 版本 | 含义 | 触发条件 |
|---|---|---|
| `v0.1.x` | Phase 1 MVP | 核心安装器可用 |
| `v0.2.x` | Phase 2 | "Aha Moment" 体验 |
| `v0.3.x` | Phase 3 | 管家与生态 |
| `v1.0.0` | 正式发布 | 全部 Phase 完成，通过测试 |

**同步更新清单**：发版本时需要同步更新以下位置的版本号：
1. `git tag vX.Y.Z`
2. `src-tauri/tauri.conf.json` → `version`
3. `src-tauri/Cargo.toml` → `version`
4. `package.json` → `version`
5. `docs/CHANGELOG.md` → 追加新版本记录

## 快速参考

```
# 小修文档（无需归档）
git commit -m "docs(prd): clarify workspace setup flow"

# 大改文档（需要归档）
cp docs/PRD.md docs/archive/PRD_v0.1.0.md
# ... edit docs/PRD.md ...
git commit -m "docs(prd): v0.2.0 - redesign configuration injection"

# 打勾 TODO
git commit -m "docs(todo): mark source download task complete"

# 发版本
git commit -m "chore: bump version to 0.2.0"
git tag v0.2.0
git push origin main --tags
```
