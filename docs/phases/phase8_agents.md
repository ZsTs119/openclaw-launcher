# Phase 8: 智能体配置界面 + AI 引擎增强

> 📋 开发中 | 目标版本：`v0.6.0`

## 铁律

> [!CAUTION]
> **三端验收**：所有改动必须在 Windows / Linux / macOS 三端验证通过。
> **UI 一致**：深色主题配色 (`--bg-*`, `--accent-*`)、Lucide 图标、`framer-motion` 动画。
> **不破坏现有功能**：新增/改版页面不影响仪表盘和设置的交互逻辑。

---

## 8.1 AI 引擎改版：多 Provider 管理

### 现状
AI 引擎页当前只支持"一次配置一个 Provider"。但 `openclaw.json` 的 `models.providers` 已支持多 Provider 共存。

### 方案
- **进入 AI 引擎页** → 显示已保存的 Provider 卡片列表（名称 / Base URL / 模型数量）
- **右上角 `[+ 添加模型商]`** → 弹出 ApiKeyModal
- **卡片操作** → 编辑 API Key / 查看模型 / 删除
- **ApiKeyModal 高度优化** → 默认展示 3 个选项无需滚动

### 新增后端命令
| 命令 | 说明 |
|---|---|
| `list_providers()` | 从 `openclaw.json` 读取已保存的 providers |
| `delete_provider(name)` | 删除指定 provider |

### 边界
- 默认 Provider（仪表盘首次配置的）标记为「默认」
- 删除 Provider 时检查是否有 Agent 在使用

---

## 8.2 Tab 基础设施 ✅

- `TabId` 新增 `"agents"` | `"analytics"`
- 5-Tab 导航：仪表盘 / AI 引擎 / 智能体 / 数据统计 / 设置中心
- Lucide 图标：Bot + BarChart3

---

## 8.3 Agent 管理增强

### 存储结构（官方规范）
```
~/.openclaw/
├── openclaw.json                    ← agents.list[] 注册表
├── agents/
│   ├── main/
│   │   ├── agent/                   ← models.json, agent.json
│   │   └── sessions/                ← 会话记录
│   └── coder/
│       ├── agent/
│       └── sessions/
├── workspace/                       ← main 的 workspace
│   ├── AGENTS.md, SOUL.md, USER.md  ← bootstrap 文件
│   └── skills/
├── workspace-coder/                 ← coder 的 workspace
│   ├── AGENTS.md, SOUL.md, USER.md
│   └── skills/
└── skills/                          ← 全局技能
```

### 创建 Agent 增强
- 名称 + **模型下拉**（从已保存 providers 的模型列表选择，不允许手动输入）+ 系统提示词
- 自动创建 `workspace-<name>/` + bootstrap 文件（AGENTS.md, SOUL.md, USER.md）
- **同步写入 `openclaw.json` 的 `agents.list[]`**

### 权限控制
- `subagents.allowAgents` 配置
- `["*"]` = 全权限（主管）— main 默认
- `["main"]` = 只能回调主管（下属）— 其他 Agent 默认
- UI：创建/编辑弹窗中的「主管/下属」开关

### 编辑弹窗
- 修改系统提示词
- 切换模型（下拉已保存 providers 的模型）
- 修改权限
- main 可编辑（模型+提示词），不可删除

### 模型失效处理
- 如果 Agent 引用的 provider 已被删除，卡片上显示黄色「模型已失效」标记
- 编辑时下拉不包含失效模型，用户需重新选择
- 不阻塞运行（gateway 自动 fallback 到默认模型）

### 删除
- `main` 不可删除
- 删除时同步清理 `agents.list[]` + `workspace-<name>/` + `agents/<name>/`

### 暂不实现
- `identity.emoji` — 后续版本加
- 通道路由（WhatsApp/Telegram 绑定）— 后续版本

---

## 8.4 Agent 对话入口（与 8.3 一起实现）

- 每张 Agent 卡片加 **「💬 对话」按钮**
- 点击 → 打开浏览器 `http://localhost:PORT/chat?session=agent:AGENT_NAME:main`
- 使用实际运行端口（从 ServiceState.port 读取）

---

## 8.5 会话历史（后续版本）

- 在 Agent 卡片展开或编辑弹窗内展示**会话历史列表**
- 数据源：`~/.openclaw/agents/<name>/sessions/`
- 点击会话 → 打开浏览器对应会话 URL

---

## 8.6 数据统计占位 ✅ + 滚动条修复

- 占位页面已完成
- 修复：去掉 min-height 导致的滚动条

---

## 变更文件

| 文件 | 操作 | 说明 |
|---|---|---|
| ✅ `src-tauri/src/agents.rs` | 已有 + 增强 | Agent CRUD → 增加 openclaw.json 同步 |
| [NEW] `src-tauri/src/provider_mgr.rs` | 新增 | Provider 列表 / 删除 |
| ✅ `src/components/AgentsTab.tsx` | 已有 + 增强 | 模型选择 / 权限 / 对话按钮 / 会话历史 |
| ✅ `src/components/AnalyticsTab.tsx` | 已有 | 修复滚动条 |
| [MODIFY] `src/components/ModelsTab.tsx` | 修改 | 改版为 Provider 卡片管理 |
| [MODIFY] `src/components/ApiKeyModal.tsx` | 修改 | 高度优化 |
| ✅ `src/types/index.ts` | 已有 + 增强 | 新增 ProviderSaved 等类型 |
| ✅ `src/App.tsx` | 已有 | 5-Tab 导航已完成 |
| `src-tauri/src/lib.rs` | 修改 | 注册新命令 |

---

## 验收标准

```
✅ AI 引擎页展示已保存 Provider 卡片
✅ 添加/编辑/删除 Provider 功能正常
✅ ApiKeyModal 高度合理，3 选项无滚动
✅ Agent 创建时可选择模型
✅ Agent 编辑可切换模型 + 修改提示词 + 设置权限
✅ 创建/删除 Agent → openclaw.json agents.list 同步
✅ Agent 卡片「对话」按钮 → 浏览器打开正确 URL
✅ 会话历史展示 + 点击恢复
✅ main Agent 不可删除，权限 ["*"]
✅ 数据统计页无滚动条
✅ cargo test 通过
✅ [Windows / Linux / macOS] 三端验证
```
