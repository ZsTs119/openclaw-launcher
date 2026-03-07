# 贡献指南 | Contributing Guide

感谢你对 OpenClaw Launcher 的关注！欢迎任何形式的贡献 🎉

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 18
- **Rust** ≥ 1.70 (via `rustup`)
- **pnpm** ≥ 8 (`npm install -g pnpm`)
- **Tauri CLI** (`cargo install tauri-cli`)

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
| `refactor:` | 重构 | `refactor: extract port check` |
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
- 运行日志 (点击"原始日志"复制)
- 重现步骤

## 💡 功能建议

请使用 [Feature Request 模板](https://github.com/ZsTs119/openclaw-launcher/issues/new?template=feature_request.yml) 提交建议。

## 🏗️ 项目结构

```
openclaw-launcher/
├── src/              # React 前端
│   ├── App.tsx       # 主应用组件
│   └── App.css       # 样式
├── src-tauri/        # Rust 后端
│   └── src/
│       ├── lib.rs          # Tauri 入口
│       ├── environment.rs  # Node.js 沙盒管理
│       ├── openclaw.rs     # OpenClaw 源码/依赖管理
│       └── service.rs      # 服务生命周期
├── docs/             # 项目文档
│   ├── PRD.md        # 产品需求文档
│   ├── TODO.md       # 任务追踪
│   └── phases/       # 阶段性开发计划
└── .github/          # CI/CD 配置
```

## 📜 代码风格

- **Rust**: 使用 `cargo fmt` 格式化
- **TypeScript/React**: 使用 Prettier (默认配置)
- **CSS**: 使用 CSS Variables，避免硬编码颜色

## 🤝 行为准则

参与此项目意味着你同意遵守我们的 [行为准则](CODE_OF_CONDUCT.md)。
