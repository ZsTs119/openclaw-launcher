# Phase 8.5: 权限图 + 内置技能 + ClawHub 技能浏览

> 📋 开发中 | 目标版本：`v0.6.0`
> Module B ✅ 已完成 | Module A 待开发 | Module C 待开发

## 铁律

> [!CAUTION]
> **三端验收**：所有改动必须在 Windows / Linux / macOS 三端验证通过。
> **不破坏现有功能**：三个模块独立实现，不影响已有工作流。
> **静默迁移**：老用户升级后自动补装内置资源，不弹窗不阻塞。

---

## 8.5.1 自动迁移 + 内置技能 (Module B) ✅

### `ensure_builtin_resources()` 核心函数

调用入口（已实现）：

| 入口 | 场景 | 状态 |
|---|---|---|
| `setup_openclaw()` Step 6 | 新用户首次安装 | ✅ |
| `start_service()` 启动成功后 | 老用户升级安装包 | ✅ |
| `create_agent()` → `create_bootstrap_files()` | 新 agent workspace | ✅ |
| `list_skills()` 首次调用 | 即时生效，不需启动服务 | ✅ |

### 内置技能（4个，通过 include_str! 嵌入二进制）

| 名称 | 说明 |
|---|---|
| bomb-dog-sniff | 恶意代码检测 |
| agent-reach | 联网搜索 |
| awesome-openclaw-skills | 技能合集索引 |
| awesome-openclaw-usecases | 用例合集索引 |

### 技能卡片 + 详情弹窗

| 功能 | 状态 |
|---|---|
| YAML `>` 折叠描述解析 | ✅ |
| 卡片：图标 + 描述 + 路径 + hover 放大 | ✅ |
| `SkillDetailModal.tsx` 分屏布局 | ✅ |
| `FileTree.tsx` 通用可收缩目录树 | ✅ |
| `read_skill_file` 安全读取（限 skills 目录 + 100KB）| ✅ |

### 改动文件

| 文件 | 操作 |
|---|---|
| `agents.rs` | `ensure_builtin_resources()` + `get_skill_detail` + `read_skill_file` |
| `setup.rs` | Step 6 调用 |
| `service.rs` | 启动后调用 |
| `lib.rs` | 注册 3 个新命令 |
| `types/index.ts` | `SkillFile` 类型 |
| `SkillDetailModal.tsx` | [NEW] 分屏弹窗 |
| `ui/FileTree.tsx` | [NEW] 通用文件树组件 |
| `skill-detail.css` | [NEW] 弹窗样式 |
| `agents.css` | 卡片 hover 放大 |

---

## 8.5.2 Agent 权限图 (Module A)

### 现状 → 目标
- 现状：`is_supervisor` toggle → `["*"]` 或 `["main"]`
- 目标：多选 checkbox → 动态读取 agent 列表

### UI
编辑弹窗中：
- 勾选「全部权限 (*)」→ `["*"]`
- 取消全选 → 显示所有 agent checkbox（排除自己）
- 勾选具体 agent → `["main", "coder"]`

### 改动文件
| 文件 | 操作 |
|---|---|
| `agents.rs` | `AgentInfo` +`allow_agents`，`update_agent_permission` 改签名 |
| `types/index.ts` | `AgentInfo` +`allow_agents` |
| `AgentsTab.tsx` | 编辑弹窗改 toggle → checkbox 列表 |

### 边界
- 删除 agent → 其他 agent `allowAgents` 自动清除该 id
- `main` 默认 `["*"]`，新 agent 默认 `["main"]`

---

## 8.5.3 ClawHub 技能浏览器 (Module C)

### 方案
调用 OpenClaw CLI `skill search`/`skill install`，不做网页抓取。

### Rust 新增
| 命令 | 说明 |
|---|---|
| `search_clawhub_skills(query)` | 执行 CLI search 解析输出 |
| `install_clawhub_skill(slug)` | 执行 CLI install |

### 前端新增
| 组件 | 说明 |
|---|---|
| `SkillBrowser.tsx` | 弹窗：搜索 + 结果列表 + 安装按钮 |
| `skill-browser.css` | 弹窗样式 |

---

## 验收标准

```
[x] 新用户安装后自动有 OPENCLAW.md + 4 个内置技能
[x] 老用户升级后启动自动补装（静默）
[x] 新建 agent → workspace 有 OPENCLAW.md
[x] 技能卡片显示描述 + hover 放大 + 详情弹窗
[x] 详情弹窗：分屏目录树 + 文件预览
[x] cargo check + tsc 通过
[ ] 编辑 agent → 可多选"可指挥的 agent"
[ ] 删除 agent → 权限列表自动刷新
[ ] 探索技能 → 搜索结果 → 一键安装
```
