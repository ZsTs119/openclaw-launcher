# Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/).

---

## [Unreleased] — Phase 9.7: 引擎升级 + 插件修复

### 变更
- **引擎升级**: `PINNED_VERSION` 从 `v2026.2.6-1` → `v2026.3.2`，修复 plugin-sdk `channel-config-schema` 模块解析错误
- **plugins.allow 注入**: 启动时自动注入 `["openclaw-weixin", "openclaw-lark"]`，新版引擎可正确加载
- **浏览器自动打开**: gateway ready 信号后自动打开 Control UI
- **WSL 端口安全**: 默认端口 18800，避免 WSL2 端口转发冲突

---

## [v0.1.0] - 2026-03-07

### 🚀 首次发布 — Phase 1 MVP

#### 新增功能
- **便携 Node.js 沙盒** — 自动下载 Node.js 到 AppData，零环境污染
- **OpenClaw 源码拉取** — GitHub ZIP 下载，自动切换国内镜像 (ghfast.top / ghproxy.com)
- **智能 npm install** — 使用沙盒 Node.js 执行，NPM 源自动切淘宝镜像
- **服务启停控制** — 桌面级 Start/Stop 按钮，进程生命周期管理
- **实时日志面板** — stdout/stderr 流式推送，按等级着色 (info/warn/error/success)
- **暗色控制台 UI** — 初始化进度视图 + 主控看板

#### 基础设施
- Tauri v2 + React + TypeScript 技术栈
- GitHub Actions CI/CD 跨平台自动构建 (Windows/macOS/Linux)
- 完整的 PRD、TODO、Phase 文档体系

#### 文档
- `docs/PRD.md` — 完整产品需求文档
- `docs/TODO.md` — 开发进度追踪（Phase 1 核心任务 ✅）
- `docs/phases/phase1_mvp.md` — Phase 1 技术规格
- `docs/skills/` — git-workflow、docs-versioning 规范
