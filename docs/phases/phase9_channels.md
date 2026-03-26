# Phase 9: 平台接入

> 📋 待开始 | 目标版本：`v0.7.0`

## 概述

新增「平台接入」Tab，支持微信和飞书的扫码绑定/解绑管理。
架构可扩展，后续支持 Telegram/Discord/QQ（Token 模式）。

## 铁律

- 不修改现有 Tab（仪表盘/AI引擎/智能体/设置）
- 新文件独立（`channels.rs` / `ChannelsTab.tsx`）
- 平台抽象可扩展（`ChannelConfig` + `BindMode`）

---

## 9.1 后端 — channels.rs

新增 `channels.rs` 模块，6 个 Tauri 命令：

| 命令 | 功能 |
|---|---|
| `check_node_version` | 检测 Node.js ≥ 22 |
| `get_channel_status` | 读 config 返回各平台绑定状态 |
| `start_channel_binding(platform)` | spawn npx，解析 stdout 返回 QR URL |
| `poll_binding_result(platform)` | 轮询进程状态 + config 变化 |
| `cancel_channel_binding(platform)` | kill 子进程 |
| `unbind_channel(platform)` | 清 config channels 字段 |

QR URL 提取：spawn → piped stdout → 正则匹配 `https://` URL → 返回前端渲染

## 9.2 前端 — Tab + 组件

| 组件 | 职责 |
|---|---|
| `ChannelsTab.tsx` | Tab 主体，平台卡片网格 |
| `ChannelCard.tsx` | 卡片：未绑定/已绑定两态 |
| `BindingModal.tsx` | 绑定弹窗：QR + 步骤 + 状态流转 |
| `channels.css` | 样式 |

### 绑定弹窗状态流

```
加载中 → QR展示 → 等待扫码 → 成功(自动关闭)
                        ↓
                     过期 → [重新生成]
                        ↓
                     错误 → [重试] / [终端打开]
```

### 平台卡片

| 平台 | 状态 | 模式 |
|---|---|---|
| 微信 | 可用 | QrCode |
| 飞书 | 可用 | QrCode |
| Telegram | 敬请期待 | Token (future) |
| Discord | 敬请期待 | Token (future) |
| QQ | 敬请期待 | Manual (future) |

## 9.3 边界处理

- Node.js 未安装/版本低 → 灰色按钮 + 提示
- 网关未运行 → 灰色按钮 + 提示
- stdout 无 URL → 5s 超时 → 降级终端打开
- QR 过期 → 进程退出 → [重新生成] 按钮
- 关闭弹窗 → kill 子进程
- 解绑 3s 确认 + 飞书跳转提示
- config 无 channels → 默认未绑定

## 9.4 Node.js 一键升级

- `check_node_version` 改用 sandbox node 路径（与主流程一致）
- 新增 `upgrade_node` 命令：删旧 sandbox → 重新下载 v22
- 警告条加 [一键升级] 按钮 + 进度态
- 升级后提醒重启 OpenClaw 服务

## 9.5 绑定流程重构（预下载 + 异步 + 引导式 UX）

### 问题
npx 首次同步阻塞下载 CLI 工具超时，QR 码无法生成。

### 方案
1. **预下载 CLI 到 sandbox**：进入平台接入 Tab 时后台 `npm install` CLI 包到 `channel-cli/`，已缓存时秒返回
2. **异步流式读取**：`start_channel_binding` 改为 async，stdout 通过 `app.emit("binding-progress")` 实时推送
3. **引导式 UX**：
   - 微信：3步引导（更新微信 → 设置→插件→ClawBot → 连接）→ QR 码
   - 飞书：引导（用飞书扫描下方二维码）→ QR 码
4. **降级兜底**：预下载失败时 fallback 到 npx 实时下载 + 进度提示

### 边界

| 场景 | 处理 |
|---|---|
| 预下载失败 | fallback npx，显示"正在下载..." |
| CLI 版本过旧 | ensure_channel_cli 检查并更新 |
| sandbox node 不存在 | 合并 Node 升级流程 |
| CLI 崩溃 | 90s 超时 + 进程退出检测 |
| stdout 无 URL | 降级显示终端命令 |
| 网关未运行 | 前端提示先启动 |
| npm 镜像加速 | --registry=npmmirror fallback |

### 涉及文件

| 文件 | 改动 |
|---|---|
| `environment.rs` | 新增 `ensure_channel_cli` + `get_channel_cli_dir` |
| `channels.rs` | 重写 `start_channel_binding` 为 async + 事件推送 |
| `lib.rs` | 注册 `ensure_channel_cli` |
| `BindingModal.tsx` | 引导式 + 实时阶段 + 事件监听 |
| `ChannelsTab.tsx` | 进入 Tab 时调用预下载 |
| `channels.css` | 引导步骤样式 |

## 9.6 插件预加载（plugins.allow 自动注入）

### 问题
OpenClaw 3.22+ 要求非 bundled 插件（`openclaw-lark`、`openclaw-weixin`）
在 `openclaw.json` 的 `plugins.allow` 中显式授权，否则 gateway 拒绝加载。

### 方案：三层预加载

| 层 | 时机 | 动作 |
|---|---|---|
| ① Config 注入 | `start_service` Stage③ | 写 `plugins.allow` 到 `openclaw.json`（gateway 启动前） |
| ② CLI 预下载 | 进入渠道 Tab | `ensure_channel_cli`（已有） |
| ③ 直接绑定 | 点击"开始绑定" | spawn CLI → QR 秒出 |

### 涉及文件

| 文件 | 改动 |
|---|---|
| `service.rs` | Stage③ 追加 `ensure_plugins_allowed()` 调用 |
| `channels.rs` | 新增 `ensure_plugins_allowed()` + fallback 检查 |
| `BindingModal.tsx` | plugins 相关错误友好提示 |

### 边界

| 场景 | 处理 |
|---|---|
| config 已有 plugins.allow | MERGE 追加，不覆盖 |
| 手动启动 gateway（未走 Launcher） | fallback 在绑定时也调用 + 提示重启 |
| config 不存在 | 创建并写入 |

## 验收标准

```
[x] Tab 切换正常，不影响其他模块
[x] 解绑：3s 确认 → config 清除 → UI 回到未绑定
[x] 敬请期待卡片正确
[x] Node.js 一键升级按钮
[ ] 插件预加载：gateway 启动时自动注入 plugins.allow
[ ] 微信：引导弹窗 → CLI预下载 → QR生成 → 扫码绑定
[ ] 飞书：引导弹窗 → CLI预下载 → QR生成 → 扫码绑定
[ ] 边界：网关提示 / Node 提示 / 降级提示 / QR 过期重新生成
[ ] cargo check + tsc
```

