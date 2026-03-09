<div align="center">

# 🚀 OpenClaw Launcher

**一键安装，零配置，即刻体验 AI 编程的力量。**

[![GitHub Release](https://img.shields.io/github/v/release/ZsTs119/openclaw-launcher?style=flat-square&color=blue)](https://github.com/ZsTs119/openclaw-launcher/releases)
[![Build Status](https://img.shields.io/github/actions/workflow/status/ZsTs119/openclaw-launcher/build.yml?style=flat-square)](https://github.com/ZsTs119/openclaw-launcher/actions)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)]()

[下载安装包](https://github.com/ZsTs119/openclaw-launcher/releases) · [功能特性](#-功能特性) · [快速开始](#-快速开始) · [开发指南](#-开发指南) · [参与贡献](#-参与贡献)

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
- **🌐 自动打开浏览器** — 服务启动后自动打开网页端，即刻开始对话

### 🤖 AI 模型管理

- **多提供商支持** — 内置 Groq、SiliconFlow、OpenRouter、DeepSeek、OpenAI 等主流提供商
- **免费模型直接用** — 推荐免费注册提供商，零成本体验
- **自定义中转站** — 支持任意 OpenAI 兼容 API（Base URL + Key）
- **手动输入模型 ID** — 提供商上线新模型？直接输入 ID 即可使用
- **一键切换模型** — 无需重新配置，实时切换默认模型

### 🎨 Premium 界面

- **极简深色主题** — 纯黑底色 + 毛玻璃质感 + 微妙渐变动效
- **仪表盘** — 品牌 Logo 脉冲光效 + 服务状态 + 运行时长
- **极光启动屏** — 紫/青极光飘动 + 白色光晕进度条
- **全局启动覆盖层** — 服务启动时毛玻璃遮罩，就绪自动消失

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
4. 选择 AI 模型提供商，配置 API Key
5. 点击「初始化并启动」→ 浏览器自动打开，开始与 AI 对话

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
┌──────────────────────────────────────────────────┐
│           OpenClaw Launcher (Tauri v2)            │
├───────────────────┬──────────────────────────────┤
│  React Frontend   │     Rust Backend              │
│                   │                               │
│  ┌─────────────┐  │  ┌──────────────────────┐     │
│  │ SetupWizard │  │  │  environment.rs       │     │
│  │ Dashboard   │  │  │  ├ Node.js download   │     │
│  │ ModelsTab   │  │  │  ├ Sandbox mgmt      │     │
│  │ SettingsTab │  │  │  └ Mirror fallback   │     │
│  └─────────────┘  │  ├──────────────────────┤     │
│                   │  │  setup.rs             │     │
│  Hooks:           │  │  ├ Source download    │     │
│  ├ useSetup      │  │  ├ ZIP extraction     │     │
│  ├ useService    │  │  └ npm install        │     │
│  ├ useConfig     │  │  ├──────────────────────┤     │
│  └ useLogs       │  │  service.rs            │     │
│                   │  │  ├ Process lifecycle  │     │
│  Components:      │  │  ├ Port auto-scan     │     │
│  ├ Header        │  │  └ Log streaming      │     │
│  ├ ApiKeyModal   │  │  ├──────────────────────┤     │
│  ├ ModelSwitch   │  │  config.rs             │     │
│  └ StartupOverlay│  │  ├ API Key mgmt       │     │
│                   │  │  └ Model switching    │     │
│                   │  └──────────────────────┘     │
├───────────────────┴──────────────────────────────┤
│  AppData Sandbox (User-level, no admin)           │
│  ├── node/          (Portable Node.js)            │
│  └── openclaw-engine/ (Source + modules)          │
└──────────────────────────────────────────────────┘
```

## 📂 项目结构

```
openclaw-launcher/
├── src/                        # React 前端
│   ├── App.tsx                 # 主应用 (~180 行，纯编排)
│   ├── components/             # UI 组件
│   │   ├── Header.tsx          # 顶栏 (Logo + 版本 + 状态)
│   │   ├── DashboardTab.tsx    # 仪表盘 (启停 + 状态环)
│   │   ├── ModelsTab.tsx       # 模型配置页
│   │   ├── SettingsTab.tsx     # 设置中心 (通用/日志/关于)
│   │   ├── SetupWizard.tsx     # 首次安装向导
│   │   ├── ApiKeyModal.tsx     # API Key 配置弹窗
│   │   ├── ModelSwitchModal.tsx # 模型切换弹窗
│   │   ├── ModelSelectWithCustom.tsx # 模型选择 (预设+手动输入)
│   │   └── StartupOverlay.tsx  # 启动加载覆盖层
│   ├── hooks/                  # 自定义 Hooks
│   │   ├── useSetup.ts         # 安装流程状态管理
│   │   ├── useService.ts       # 服务启停 + 心跳
│   │   ├── useConfig.ts        # API Key/模型配置
│   │   └── useLogs.ts          # 日志管理
│   ├── styles/                 # CSS 模块
│   │   ├── global.css          # 设计令牌 + 全局变量
│   │   ├── dashboard.css       # 仪表盘样式
│   │   ├── models.css          # 模型页样式
│   │   └── ...                 # 其他模块化样式
│   └── types/index.ts          # TypeScript 类型定义
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs              # Tauri 命令注册
│   │   ├── environment.rs      # Node.js 沙盒管理
│   │   ├── setup.rs            # 源码下载 & npm install
│   │   ├── service.rs          # 进程生命周期 & 日志
│   │   ├── config.rs           # API Key & 模型配置
│   │   ├── providers.rs        # 提供商数据加载
│   │   └── diagnostics.rs      # 诊断日志导出
│   ├── resources/providers.json # 提供商/模型定义
│   ├── Cargo.toml              # Rust 依赖
│   └── tauri.conf.json         # Tauri 配置
├── docs/
│   ├── PRD.md                  # 产品需求文档
│   ├── TODO.md                 # 开发进度追踪
│   └── phases/                 # 分阶段技术规格 (20 个 Stage)
└── .github/workflows/
    └── build.yml               # CI/CD 三平台自动构建 + Release
```

## 🗺️ 开发路线图

- [x] **Phase 1: MVP 核心安装器** ✅
  - 便携 Node.js 下载与沙盒释放
  - 源码 ZIP 拉取（智能镜像切换）
  - 局部环境 npm install
- [x] **Phase 2: 体验改造** ✅
  - 配置注入 + 工作区向导
  - 自动打开浏览器 + 人话日志
- [x] **Phase 3: API Key 配置 + UI 重构** ✅
  - 多提供商 API Key 配置
  - Tab 导航 + 深色 Premium 主题
- [x] **Phase 4: 架构重构** ✅
  - 组件拆分 (11 个 Stage)
  - Custom Hooks + CSS 模块化
- [x] **Phase 5: UI 打磨 + 功能完善** ✅
  - 色彩统一 + 图标一致性
  - 启动极光屏 + 仪表盘光效
  - 自定义模型 ID 输入
- [ ] **Phase 6: 企业级分发** (规划中)
  - Windows 代码签名
  - macOS 公证
  - 应用内自动更新

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

详细规范请参考 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 📄 License

[MIT License](LICENSE) — 自由使用、修改和分发。

---

## ☕ 支持与联系

如果 OpenClaw Launcher 帮到了你，欢迎请作者喝杯咖啡 ☕ 或关注公众号获取最新动态 📱

<div align="center">
<table>
<tr>
<td align="center"><strong>☕ 赞赏支持</strong></td>
<td align="center"><strong>📱 关注公众号</strong></td>
</tr>
<tr>
<td align="center"><img src="docs/donate.jpg" alt="赞赏码" width="250" /></td>
<td align="center"><img src="docs/wechat-official.jpg" alt="公众号" width="250" /></td>
</tr>
</table>
</div>

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐ Star！**

Made with ❤️ by [ZsTs119](https://github.com/ZsTs119)

</div>
