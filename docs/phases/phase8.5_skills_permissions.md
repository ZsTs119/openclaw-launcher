# Phase 8.5: 权限图 + 内置技能 + ClawHub 技能浏览

> 📋 待开发 | 目标版本：`v0.6.0`

## 铁律

> [!CAUTION]
> **三端验收**：所有改动必须在 Windows / Linux / macOS 三端验证通过。
> **不破坏现有功能**：三个模块独立实现，不影响已有工作流。
> **静默迁移**：老用户升级后自动补装内置资源，不弹窗不阻塞。

---

## 8.5.1 自动迁移 + 内置技能 (Module B)

### `ensure_builtin_resources()` 核心函数

4 个调用入口：

| 入口 | 场景 |
|---|---|
| `setup_openclaw()` Step 5 后 | 新用户首次安装 |
| `start_service()` 启动成功后 | 老用户升级安装包 |
| `create_agent()` 创建 agent 后 | 新 agent workspace |
| 一键修复 | 手动触发 |

### 内置技能

| 名称 | 安装方式 | 说明 |
|---|---|---|
| bomb-dog-sniff | `skill install LvcidPsyche/skill-bomb-dog-sniff` | 恶意代码检测 |
| agent-reach | `skill install Panniantong/agent-reach` | 联网搜索 |
| awesome-skills | OPENCLAW.md 链接 | 技能合集索引 |
| awesome-usecases | OPENCLAW.md 链接 | 用例合集索引 |

### OPENCLAW.md

每个 agent workspace 根目录自动创建，gateway 每次请求读取。
- 不存在 → 写入
- 已存在 → **不覆盖**（尊重用户修改）
- 断网安装失败 → 静默跳过，下次启动重试

### 改动文件
| 文件 | 操作 |
|---|---|
| `agents.rs` | 新增 `ensure_builtin_resources()` |
| `setup.rs` | Step 5 后调用 |
| `service.rs` | 启动后调用 |

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

### UI
- AgentsTab 技能区 → 「探索技能」按钮 → 打开 SkillBrowser
- 搜索 → 调 Rust → 渲染结果
- 安装 → 调 Rust → 刷新本地列表

---

## 实施顺序

1. Module B（内置技能 + OPENCLAW.md + 迁移）
2. Module A（权限图）
3. Module C（ClawHub 浏览器）

## 验收标准

```
[ ] 新用户安装后自动有 OPENCLAW.md + 2 个内置技能
[ ] 老用户升级后启动自动补装（静默）
[ ] 新建 agent → workspace 有 OPENCLAW.md
[ ] 编辑 agent → 可多选"可指挥的 agent"
[ ] 删除 agent → 权限列表自动刷新
[ ] 探索技能 → 搜索结果 → 一键安装
[ ] cargo check + tsc 通过
```
