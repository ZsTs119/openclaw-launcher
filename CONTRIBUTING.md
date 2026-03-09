# 贡献指南 | Contributing Guide

感谢你对 OpenClaw Launcher 的关注！欢迎任何形式的贡献 🎉

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 22
- **Rust** ≥ 1.70 (via `rustup`)
- **Tauri CLI** (`cargo install tauri-cli`)
- **Linux 额外依赖:** `libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev`

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/ZsTs119/openclaw-launcher.git
cd openclaw-launcher

# 安装前端依赖
npm install

# 启动开发模式 (前端 + Rust 热重载)
npm run tauri dev
```

### 构建生产版本

```bash
npm run tauri build
```

## 📝 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/)：

| 前缀 | 用途 | 示例 |
|---|---|---|
| `feat:` | 新功能 | `feat: add workspace wizard` |
| `fix:` | Bug 修复 | `fix: port 3000 detection` |
| `docs:` | 文档更新 | `docs: update README` |
| `style:` | 样式/格式 | `style: fix CSS alignment` |
| `refactor:` | 重构 | `refactor: extract LogViewer` |
| `perf:` | 性能优化 | `perf: lazy load modules` |
| `test:` | 测试 | `test: add service tests` |
| `chore:` | 构建/工具 | `chore: update dependencies` |

## 🔀 Pull Request 流程

1. **Fork** 本仓库
2. 创建特性分支: `git checkout -b feat/your-feature`
3. 提交你的改动 (遵循提交规范)
4. 推送到你的 Fork: `git push origin feat/your-feature`
5. 创建 **Pull Request**，使用 PR 模板描述你的改动

## 🐛 报告 Bug

请使用 [Bug Report 模板](https://github.com/ZsTs119/openclaw-launcher/issues/new?template=bug_report.yml) 提交 bug。

请附上以下信息：
- 操作系统和版本
- Launcher 版本号
- 运行日志 (设置中心 → 日志诊断 → 导出诊断包)
- 重现步骤

## 💡 功能建议

请使用 [Feature Request 模板](https://github.com/ZsTs119/openclaw-launcher/issues/new?template=feature_request.yml) 提交建议。

## 🏗️ 项目结构

```
openclaw-launcher/
├── src/                        # React 前端
│   ├── App.tsx                 # 主应用 (~180 行，纯编排)
│   ├── components/             # UI 组件
│   │   ├── Header.tsx          # 顶栏
│   │   ├── DashboardTab.tsx    # 仪表盘
│   │   ├── ModelsTab.tsx       # 模型配置
│   │   ├── SettingsTab.tsx     # 设置中心
│   │   ├── SetupWizard.tsx     # 首次安装向导
│   │   ├── ApiKeyModal.tsx     # API Key 配置弹窗
│   │   └── StartupOverlay.tsx  # 启动加载覆盖层
│   ├── hooks/                  # 自定义 Hooks
│   │   ├── useSetup.ts         # 安装流程状态管理
│   │   ├── useService.ts       # 服务启停 + 心跳
│   │   ├── useConfig.ts        # API Key/模型配置
│   │   └── useLogs.ts          # 日志管理
│   ├── styles/                 # CSS 模块化样式
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
│   └── tauri.conf.json         # Tauri 配置
├── docs/
│   ├── PRD.md                  # 产品需求文档
│   ├── TODO.md                 # 任务追踪
│   └── phases/                 # 分阶段技术规格
└── .github/workflows/
    └── build.yml               # CI/CD 三平台自动构建
```

## 📜 代码风格

- **Rust**: 使用 `cargo fmt` 格式化，缩进 4 空格
- **TypeScript/React**: 缩进 2 空格
- **CSS**: 使用 CSS Variables (`global.css` 中定义)，避免硬编码颜色
- **统一配置**: 项目根目录 `.editorconfig` 定义了所有格式规则

## 🤖 AI 辅助开发

本项目使用 AI 辅助开发。如果你也使用 AI 编码助手（Copilot/Cursor/Claude 等），请参考 [AGENTS.md](AGENTS.md) 中的开发规范，确保你的 AI 助手遵循项目约定。

## 🤝 行为准则

参与此项目意味着你同意遵守我们的 [行为准则](CODE_OF_CONDUCT.md)。
