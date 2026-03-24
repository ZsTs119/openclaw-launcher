# Phase 8.5: 权限图 + 内置技能 + ClawHub 技能浏览

> 📋 已完成 | 目标版本：`v0.6.0`
> Module B ✅ | Module A ✅ | Module C ✅

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
| `read_skill_file` 安全读取（限 skills + marketplace-skills 目录 + 100KB）| ✅ |

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
- 目标：多选 checkbox → 动态读取 agent 列表 → `["main", "coder"]`

### 规则
- `["*"]` = 全部权限（包含未来新建的 agent）
- `[]` = 无权限，agent 独立工作
- `main` **始终 `["*"]`**，UI 不可修改
- Agent 的 `allowAgents` 不可包含自己（UI 排除 + 后端过滤）

### Rust 后端改动

| 函数 | 改动 |
|---|---|
| `AgentInfo` | 新增 `allow_agents: Vec<String>`，保留 `is_supervisor` 为计算字段 |
| `update_agent_permission` | `(id, bool)` → `(id, Vec<String>)`，main 保护 |
| `add_to_agents_list` | `bool` → `Vec<String>` |
| `create_agent` | `is_supervisor: Option<bool>` → `allow_agents: Option<Vec<String>>` |
| `update_agent` | 同上 |
| `remove_from_agents_list` | **新增级联清理**：删 B → 遍历其他 agent 的 allowAgents 移除 "B" |

### 前端改动

| 组件 | 改动 |
|---|---|
| `types/index.ts` | `AgentInfo` + `allow_agents: string[]` |
| `AgentsTab.tsx` 编辑弹窗 | toggle → 「全部权限」checkbox + agent 列表 checkbox |
| `AgentsTab.tsx` 创建弹窗 | 同上（默认 `["main"]`） |

### 边界处理
- 删 Agent B → A 的 `allowAgents` 含 B → 自动移除 B（若变 `[]` → 合理）
- 老版 config 无 `allowAgents` → 已有默认值处理（main→`["*"]`，其他→`["main"]`）
- 不影响：Dashboard、AI引擎、数据统计、设置中心、会话路由、服务启停

---

## 8.5.3 技能市场 (Module C)

### 方案
自建 JSON 注册表（`docs/skills-registry.json`）+ GitHub raw API 下载。
107 个精选技能（Anthropic 官方 + obra/superpowers + BehiSecc + ComposioHQ + 社区），10 个分类。

### 数据存储

| 目录 | 内容 |
|---|---|
| `.agents/skills/` | 内置技能（始终可见） |
| `~/.openclaw/marketplace-skills/{slug}/` | 市场下载的技能（中央存储） |

### Rust 新增命令

| 命令 | 说明 |
|---|---|
| `fetch_skill_registry` | 从 GitHub 拉取 `skills-registry.json` |
| `download_marketplace_skill(slug, repo, path)` | 从 GitHub raw API 下载到 `marketplace-skills/` |
| `uninstall_marketplace_skill(slug)` | 删除中央目录 |
| `list_marketplace_skills` | 列出已下载的市场技能 |

### 前端新增

| 组件 | 说明 |
|---|---|
| `SkillBrowser.tsx` | 弹窗：搜索 + 分类筛选 + 下载/已下载状态 |
| `skill-browser.css` | 弹窗样式 |

### UI 入口
「已安装技能」标题栏右侧 → 「技能市场」按钮 → 打开 SkillBrowser

### 边界处理
- 无网络 → 错误提示
- 已下载 → 按钮变「已下载」灰色
- 下载失败 → console.error + 清理半成品目录
- Windows 兼容 → 目录复制（非 symlink）
- `list_skills` 同时扫描 skills/ 和 marketplace-skills/ 目录
- `read_skill_file` 允许 marketplace-skills/ 路径
- 关闭弹窗 → onRefresh 回调刷新已安装列表
- 分类筛选使用 CustomDropdown（WebView 下 select 无法暗色）

---

## 验收标准

```
[x] 新用户安装后自动有 OPENCLAW.md + 4 个内置技能
[x] 老用户升级后启动自动补装（静默）
[x] 新建 agent → workspace 有 OPENCLAW.md
[x] 技能卡片显示描述 + hover 效果 + 详情弹窗
[x] 详情弹窗：分屏目录树 + 文件预览
[x] 编辑 agent → 可多选"可指挥的 agent"（main 默认可回调）
[x] 删除 agent → 权限列表自动刷新
[x] 技能市场 → 搜索 + 分类 → 下载 → 显示在已安装列表
[x] cargo check + tsc 通过
```
