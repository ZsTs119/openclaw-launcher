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

## 验收标准

```
[ ] Tab 切换正常，不影响其他模块
[ ] 微信：绑定弹窗 → QR → 等待/过期/成功
[ ] 飞书：同上
[ ] 解绑：3s 确认 → config 清除 → UI 回到未绑定
[ ] 边界：网关提示 / Node 提示 / 降级提示
[ ] 敬请期待卡片正确
[ ] cargo check + tsc
```
