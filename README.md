<div align="center">

# 🚀 OpenClaw Launcher

**一键安装，零配置，即刻体验 AI 编程的力量。**

[![GitHub Release](https://img.shields.io/github/v/release/ZsTs119/openclaw-launcher?style=flat-square&color=blue)](https://github.com/ZsTs119/openclaw-launcher/releases)
[![Build Status](https://img.shields.io/github/actions/workflow/status/ZsTs119/openclaw-launcher/build.yml?style=flat-square)](https://github.com/ZsTs119/openclaw-launcher/actions)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)]()

[下载安装包](https://github.com/ZsTs119/openclaw-launcher/releases) · [功能特性](#-功能特性) · [快速开始](#-快速开始) · [开发指南](#-开发指南) · [贡献代码](#-参与贡献)

---

*OpenClaw Launcher 让你无需任何编程经验，也能在自己的电脑上运行 [OpenClaw](https://github.com/openclaw/openclaw) AI 编程助手。*

</div>

## ❓ 为什么需要 Launcher？

OpenClaw 本身是一个强大的 AI 编程框架，但对非技术用户来说，安装 Node.js、配置环境变量、执行命令行操作是巨大的门槛。

**OpenClaw Launcher 解决了这一切：**

| 原来 | 现在 |
|---|---|
| 安装 Node.js → 配置 PATH → 下载源码 → npm install → 修改配置 → 启动服务 | **双击 Launcher → 点击启动 → 开始对话** |

## ✨ 功能特性

### 🎯 核心能力

- **🔧 零环境配置** — 自动下载便携版 Node.js，隔离在 AppData 沙盒中，不污染系统环境
- **📦 一键获取源码** — 自动从 GitHub 拉取 OpenClaw 最新版，网络不好自动切国内镜像
- **📥 智能依赖安装** — 使用沙盒内 Node.js 执行 `npm install`，NPM 源自动切淘宝镜像加速
- **▶️ 一键启停** — 桌面级的启动/停止按钮，告别命令行
- **📋 实时日志** — 彩色分级日志面板，运行状态一目了然

### 🌐 网络容灾（为中国用户优化）

| 资源 | 主线路 | 备用线路 |
|---|---|---|
| Node.js | `nodejs.org` | `npmmirror.com` |
| OpenClaw 源码 | `github.com` | `ghfast.top` / `ghproxy.com` |
| NPM 依赖 | `registry.npmjs.org` | `registry.npmmirror.com` |

所有切换**全自动**，3 秒超时即降级，用户无感知。

### 🛡️ 安全设计

- **无 UAC 弹窗** — 所有文件操作限定在用户 AppData 目录
- **无杀软报警** — 核心操作使用 Rust 原生 API，不调用任何 `.bat` / `.ps1` 脚本
- **沙盒隔离** — 便携 Node.js 完全独立，不影响系统已有的开发环境

## 🖥️ 支持平台

| 平台 | 架构 | 安装包格式 |
|---|---|---|
| **Windows** | x64 | `.exe` / `.msi` |
| **macOS** | Apple Silicon (M1/M2/M3/M4) | `.dmg` |
| **macOS** | Intel | `.dmg` |
| **Linux** | x64 | `.deb` / `.AppImage` |

## 🚀 快速开始

### 普通用户

1. 前往 [Releases 页面](https://github.com/ZsTs119/openclaw-launcher/releases) 下载对应系统的安装包
2. 安装并启动 OpenClaw Launcher
3. 首次启动会自动初始化环境（约 2-5 分钟）
4. 点击「▶ 启动 OpenClaw」
5. 点击「🌐 打开网页端」开始与 AI 对话

### 开发者

```bash
# 克隆仓库
git clone https://github.com/ZsTs119/openclaw-launcher.git
cd openclaw-launcher

# 安装依赖
npm install

# 开发模式（热重载）
npm run tauri dev

# 生产构建
npm run tauri build
```

#### 前置依赖

- [Node.js](https://nodejs.org/) ≥ 22
- [Rust](https://www.rust-lang.org/tools/install) ≥ 1.70
- **Linux 额外依赖：** `libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev`

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────┐
│           OpenClaw Launcher (Tauri v2)       │
├─────────────────┬───────────────────────────┤
│  React Frontend │     Rust Backend          │
│                 │                           │
│  ┌───────────┐  │  ┌─────────────────────┐  │
│  │ Init View │  │  │  environment.rs      │  │
│  │ Dashboard │  │  │  ├ Node.js download  │  │
│  │ Log Panel │  │  │  ├ Sandbox mgmt     │  │
│  └───────────┘  │  │  └ Mirror fallback  │  │
│                 │  ├─────────────────────┤  │
│  App.tsx        │  │  openclaw.rs         │  │
│  App.css        │  │  ├ Source download   │  │
│                 │  │  ├ ZIP extraction    │  │
│                 │  │  └ npm install       │  │
│                 │  ├─────────────────────┤  │
│                 │  │  service.rs          │  │
│                 │  │  ├ Process start/    │  │
│                 │  │  │   stop            │  │
│                 │  │  └ Log streaming     │  │
│                 │  └─────────────────────┘  │
├─────────────────┴───────────────────────────┤
│  AppData Sandbox (User-level, no admin)     │
│  ├── node/          (Portable Node.js)      │
│  └── openclaw-engine/ (Source + modules)    │
└─────────────────────────────────────────────┘
```

## 📂 项目结构

```
openclaw-launcher/
├── src/                    # React 前端
│   ├── App.tsx             # 主界面（初始化 + 控制台）
│   └── App.css             # 暗色主题样式
├── src-tauri/
│   ├── src/
│   │   ├── main.rs         # 入口
│   │   ├── lib.rs          # Tauri 配置 & 命令注册
│   │   ├── environment.rs  # Node.js 沙盒管理
│   │   ├── openclaw.rs     # 源码下载 & npm install
│   │   └── service.rs      # 进程生命周期 & 日志
│   ├── Cargo.toml          # Rust 依赖
│   └── tauri.conf.json     # Tauri 配置
├── docs/
│   ├── PRD.md              # 产品需求文档
│   ├── TODO.md             # 开发进度追踪
│   └── phases/             # 分阶段技术规格
└── .github/
    └── workflows/
        └── build.yml       # CI/CD 三平台自动构建
```

## 🗺️ 开发路线图

- [x] **Phase 1: MVP 核心安装器** ✅
  - 便携 Node.js 下载与沙盒释放
  - 源码 ZIP 拉取（智能镜像切换）
  - 局部环境 npm install
  - 基础控制台 UI（启停 + 日志）
- [ ] **Phase 2: "Aha Moment" 体验改造**
  - 配置注入（免费 API Key + 预置 Skills）
  - 开机工作区向导
  - UI 全面翻新（状态大屏 + 人话日志）
- [ ] **Phase 3: 管家与生态补全**
  - 端口冲突探针与一键修复
  - System Tray 后台模式
  - OTA 更新 & 安装包签名

## 🤝 参与贡献

欢迎贡献代码！请遵循以下规范：

1. **Fork** 本仓库
2. 创建特性分支：`git checkout -b feat/amazing-feature`
3. 提交代码（请使用 [Conventional Commits](https://www.conventionalcommits.org/)）：
   ```
   feat(scope): add amazing feature
   ```
4. 推送分支：`git push origin feat/amazing-feature`
5. 提交 **Pull Request**

详细的 Git 工作流规范请参考项目内的 Skills 文档。

## 📄 License

[MIT License](LICENSE) — 自由使用、修改和分发。

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐ Star！**

Made with ❤️ by [ZsTs119](https://github.com/ZsTs119)

</div>
