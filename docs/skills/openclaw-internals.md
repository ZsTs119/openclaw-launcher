---
name: openclaw-internals
description: >
  OpenClaw gateway internal knowledge base. Use when debugging session issues,
  investigating NO_REPLY or [[reply_to_current]] errors, understanding session key
  formats, dealing with gateway lock conflicts, reading openclaw.json config,
  or any OpenClaw-specific troubleshooting. Contains session routing rules,
  config structure, lock mechanisms, and agent workspace conventions.
---

# OpenClaw Internals 知识库

## Session Key 格式

| 格式 | 用途 | 示例 |
|---|---|---|
| `agent:{name}:main` | 心跳/默认会话（被 HEARTBEAT.md 注入） | `agent:main:main` |
| `agent:{name}:new` | Gateway `/new` 命令创建的会话 | `agent:test:new` |
| `agent:{name}:chat-{timestamp}` | Launcher 新建会话 | `agent:test:chat-1711234567` |
| `agent:{name}:launcher` | Launcher 打开对话 fallback | `agent:main:launcher` |
| `agent:{name}:cron:{job}` | Cron 定时任务会话 | `agent:main:cron:daily-report` |
| `agent:{name}:telegram:{id}` | Telegram 通道会话 | `agent:main:telegram:123` |

### 过滤规则（`find_last_chat_session_key`）

排除以下 key，只保留交互式聊天会话：
- 包含 `:cron:` → cron 任务
- 包含 `:telegram:` → 通道消息
- 等于 `agent:{name}:main` → 心跳会话
- JSONL 无用户消息 → 空会话

## sessions.json 结构

路径：`~/.openclaw/agents/{name}/sessions/sessions.json`

```json
{
  "agent:test:chat-1711234567": {
    "sessionId": "29fb64b7-aad5-4281-89f4-d61151c24cc8",
    "lastActiveSessionKey": "agent:test:chat-1711234567"
  },
  "agent:test:main": {
    "sessionId": "a1b2c3d4-...",
    "lastActiveSessionKey": "agent:test:main"
  }
}
```

- **key** = session key（URL 参数中使用）
- **sessionId** = JSONL 文件名（`{sessionId}.jsonl`）

## JSONL 会话文件

路径：`~/.openclaw/agents/{name}/sessions/{sessionId}.jsonl`

```jsonl
{"id":"29fb64b7-...","timestamp":"2026-03-22T12:00:00Z","type":"session"}
{"role":"user","content":"你好"}
{"role":"assistant","content":"你好！有什么可以帮你的？"}
```

- 第一行是 header（id, timestamp）
- 后续行是消息（role: user/assistant/system）

## openclaw.json 关键结构

路径：`~/.openclaw/openclaw.json`

```json
{
  "agents": {
    "defaults": {
      "model": {"primary": "bailian/glm-5"},
      "workspace": "/home/user/.openclaw/workspace"
    },
    "list": [
      {
        "id": "main",
        "model": "bailian/glm-5",
        "subagents": {"allowAgents": ["*"]}
      },
      {
        "id": "coder",
        "workspace": "/home/user/.openclaw/workspaces/coder",
        "agentDir": "/home/user/.openclaw/agents/coder/agent",
        "model": "bailian/qwen3-coder-plus",
        "subagents": {"allowAgents": ["main"]}
      }
    ]
  }
}
```

### 权限字段 `subagents.allowAgents`
- `["*"]` = 可指挥所有 agent（主管）
- `["main"]` = 只能回调 main（下属）
- `["main", "coder"]` = 可指挥指定 agents

## Agent Workspace 文件

| 文件 | 作用 | 注入范围 |
|---|---|---|
| `SOUL.md` | 系统人格/指令 | 所有 session |
| `IDENTITY.md` | Agent 身份描述 | 所有 session |
| `HEARTBEAT.md` | 心跳协议指令 | 所有 session（⚠️ 会导致 NO_REPLY） |
| `USER.md` | 用户偏好 | 所有 session |
| `AGENTS.md` | 可用 agent 列表 | 所有 session |

> ⚠️ **HEARTBEAT.md 陷阱**：如果 agent workspace 有 HEARTBEAT.md，gateway 会在**所有** session 中注入它。这会导致交互式聊天也返回 `NO_REPLY`（心跳协议响应）。

## Gateway 锁机制

- Gateway 使用**进程级锁**防止多实例操作同一 `~/.openclaw` 数据目录
- 错误信息：`gateway already running (pid XXXX); lock timeout after 5000ms`
- 解决方法：`npx openclaw gateway stop` 或 `taskkill /F /PID XXXX`
- **重要**：Launcher 的沙盒 gateway 和用户本地 gateway 共享同一数据目录 → 不能同时运行

## Gateway `/new` 命令

- 用户在 gateway 聊天框输入 `/new` → 创建新会话
- 等效于 `sessions.patch` RPC 调用重置上下文
- 新会话 key 由 gateway 自动生成

## 常见问题

| 症状 | 原因 | 解决 |
|---|---|---|
| `NO_REPLY` | HEARTBEAT.md 注入到聊天 session | 用 `find_last_chat_session_key` 找已有正常 session |
| `[[reply_to_current]]` | session key 未被 gateway 正确初始化 | 使用 `encodeURIComponent` 编码 URL |
| gateway 不启动 | 锁文件被旧进程持有 | 杀掉旧 gateway 进程 |
| 启动弹窗卡住 | service-log 没匹配到 ready 关键词 | 点击弹窗关闭或等 30s 超时 |
