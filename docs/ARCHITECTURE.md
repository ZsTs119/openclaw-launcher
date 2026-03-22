# OpenClaw Launcher 架构文档

> 📋 最后更新：2026-03-22 | 版本：v0.5.1

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 框架 | **Tauri 2** | Rust 后端 + 前端 Webview |
| 前端 | **React 18** + TypeScript | Vite 构建 |
| 后端 | **Rust** | Tauri commands，文件系统操作 |
| UI | CSS Variables + framer-motion | 深色主题，Lucide 图标 |
| 目标 | Windows / Linux / macOS | 三端分发 |

---

## 目录结构

```
openclaw-launcher/
├── src/                          # 前端源码
│   ├── App.tsx                   # 主入口，5-Tab 布局
│   ├── components/
│   │   ├── DashboardTab.tsx      # 仪表盘：服务状态 + 启停
│   │   ├── ModelsTab.tsx         # AI 引擎：Provider 管理
│   │   ├── AgentsTab.tsx         # 智能体：Agent CRUD + 会话
│   │   ├── AnalyticsTab.tsx      # 数据统计（占位）
│   │   ├── SettingsTab.tsx       # 设置中心
│   │   ├── SetupWizard.tsx       # 首次安装引导
│   │   ├── StartupOverlay.tsx    # 冷启动弹窗
│   │   └── ui/                   # 通用组件
│   │       ├── Modal.tsx
│   │       └── CustomDropdown.tsx
│   ├── hooks/
│   │   ├── useService.ts         # 服务生命周期 + openInBrowser
│   │   └── useConfig.ts          # 配置读写
│   ├── styles/                   # CSS 文件（CSS Variables）
│   ├── types/index.ts            # Rust ↔ 前端类型契约
│   └── utils/                    # 工具函数
├── src-tauri/src/                # Rust 后端
│   ├── lib.rs                    # Tauri 命令注册
│   ├── service.rs                # OpenClaw 服务启停
│   ├── agents.rs                 # Agent CRUD + Session 管理
│   ├── provider_mgr.rs           # Provider 管理
│   ├── paths.rs                  # 路径管理
│   ├── environment.rs            # 沙盒环境（Node.js）
│   ├── download.rs               # OpenClaw 下载
│   └── installer.rs              # 安装流程
└── docs/                         # 项目文档
    ├── TODO.md                   # 全局任务总表
    ├── PRD.md                    # 产品需求文档
    └── phases/                   # 阶段文档
```

---

## 核心架构

### Tauri 通信模型

```
┌───────────────────────────────┐
│  Frontend (React)             │
│  ┌─────────┐ ┌──────────────┐ │
│  │ useState │ │ invoke()     │─┼──── Tauri IPC ────┐
│  └─────────┘ └──────────────┘ │                    │
│  ┌─────────────────────────┐  │                    ▼
│  │ listen("service-log")   │←─┼─── emit() ────┐  ┌──────────────┐
│  │ listen("service-port")  │  │               │  │  Rust Backend │
│  │ listen("service-ready") │  │               │  │  (commands)   │
│  └─────────────────────────┘  │               │  └──────────────┘
└───────────────────────────────┘               │
                                                │
                         ┌──────────────────────┘
                         │
              ┌──────────▼──────────┐
              │  OpenClaw Gateway   │
              │  (Node.js 子进程)    │
              │  端口: 18789-18899  │
              └─────────────────────┘
```

### 服务生命周期

1. **冷启动**：用户点按钮 → `openInBrowser()` → `handleStart()` → `invoke("start_service")` → 显示 StartupOverlay
2. **就绪检测**：Rust 线程读 stdout → emit `service-log` → 前端匹配 "listening" 关键词 → 关闭 Overlay → 打开浏览器
3. **热启动**：服务已运行 → `openInBrowser()` 直接 `openUrl()`
4. **停止**：`invoke("stop_service")` → `child.kill()` → 清理

---

## Agent 状态模型

### 类型定义 (`types/index.ts` ↔ `agents.rs`)

```typescript
interface AgentInfo {
    name: string;
    model: string | null;
    has_sessions: boolean;
    is_default: boolean;
    model_valid: boolean;
    last_chat_session_key: string | null;  // 最新聊天 session key
}
```

### 数据流

```
Rust list_agents()
  ├── 读 ~/.openclaw/agents/ 目录
  ├── 读 openclaw.json agents.list[]（model, provider）
  ├── 读 sessions/ 检查 has_sessions
  └── find_last_chat_session_key()
        ├── 读 sessions.json（key→sessionId 映射）
        ├── 过滤 :cron:, :telegram:, agent:{name}:main
        ├── 检查 JSONL 存在 + 有用户消息
        └── 按 timestamp 排序，返回最新
```

### Session 路由规则

| 场景 | session key | 生成方式 |
|---|---|---|
| 新建会话 | `agent:{name}:chat-{timestamp}` | 前端 `Date.now()` |
| 打开对话 | `last_chat_session_key` 或 `launcher` | Rust 查询 sessions.json |
| 历史打开 | sessions.json 真实 key | Rust `list_sessions` |
| Cron/心跳 | `agent:{name}:main` 或 `:cron:*` | Gateway 自动 |

---

## 权限模型 (`openclaw.json`)

```json
{
  "agents": {
    "list": [
      {"id": "main", "subagents": {"allowAgents": ["*"]}},
      {"id": "coder", "subagents": {"allowAgents": ["main"]}}
    ]
  }
}
```

- `["*"]` = 可指挥所有 agent（主管）
- `["main"]` = 只能回调 main（下属）
- `["main", "coder"]` = 可指挥指定 agents（未来支持）

### 未来扩展路径

| Phase | 内容 |
|---|---|
| Phase 1 ✅ | `last_chat_session_key` 状态追踪 |
| Phase 2 | `allow_agents: string[]` + `allowed_by: string[]` 权限图 |
| Phase 2 | `installed_skills: string[]` per-agent 技能管理 |
| Phase 3 | `AgentState extends AgentInfo` 完整状态管理 |

---

## 文件路径约定

| 路径 | 说明 |
|---|---|
| `~/.openclaw/` | OpenClaw 数据目录（agents, config, sessions） |
| `~/.openclaw/openclaw.json` | 全局配置（agents, models, defaults） |
| `~/.openclaw/agents/{name}/sessions/` | Agent 会话数据 |
| `~/.openclaw/agents/{name}/sessions/sessions.json` | Session key→id 映射 |
| `~/.openclaw/workspace/` | main agent workspace |
| `~/.openclaw/workspaces/{name}/` | 其他 agent workspace |
| 沙盒目录 | Launcher 自带的 OpenClaw 引擎（Node.js + 源码） |

---

## CSS 设计系统

- **配色**：CSS Variables (`--bg-*`, `--accent-*`, `--text-*`)
- **图标**：Lucide React（统一 size, strokeWidth）
- **动画**：framer-motion（页面切换、弹窗、卡片）
- **主题**：深色模式唯一
