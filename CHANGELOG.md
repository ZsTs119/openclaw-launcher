# Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.2.5] - 2026-03-07

### 🛡️ 稳定性修复 (Phase 2.5)

- **pnpm 路径探测**: 动态搜索 6 个候选路径，兼容不同 npm 版本
- **端口 3000 检测**: 启动前检查端口占用，友好提示冲突
- **崩溃检测**: 后台心跳监控 + 前端自动恢复 UI 状态
- **npm → pnpm**: 依赖安装改用 pnpm，解决 OpenClaw workspace 兼容问题
- **自动清理**: 检测到旧版 npm 安装的 node_modules 自动重建

### 🐛 Bug 修复

- 修复 Windows `npm.cmd` SyntaxError (改用 `npm-cli.js`)
- 修复 `tsdown not found` (移除 `--omit=dev`, 改用 `run-node.mjs` 启动)
- 修复配置文件格式 (使用 OpenClaw 原生 JSON5 格式)

## [0.2.0] - 2026-03-07

### ✨ 新功能 (Phase 2: "Aha Moment")

- **免费模型预置**: OpenRouter 免费模型 (Gemini Flash, Llama 4, Phi-4, Qwen3)，开箱即聊
- **工作区向导**: 首次启动弹出文件夹选择对话框
- **自动打开浏览器**: 服务就绪后自动打开 `localhost:3000`
- **配置自动注入**: 自动生成 `openclaw.json` (非破坏性)
- **UI 升级**: 状态大卡片 (服务状态、运行时长、访问地址)
- **人话日志**: npm/Node 技术日志翻译为人话 + 原始/人话切换
- **预置技能包**: 内置 `skill-creator` 和 `skill-finder`
- **免费模型提示**: 金色提示条，引导用户配置 API Key

## [0.1.0] - 2026-03-06

### 🎉 首次发布 (Phase 1: MVP)

- 搭建 Tauri + React 基础项目
- 便携式 Node.js 下载与沙盒释放 (AppData 隔离)
- OpenClaw 源码 ZIP 下载 + 智能镜像切换 (GitHub + 2 mirrors)
- `npm install` 自动执行 + 淘宝镜像回退
- 基础控制台 UI (启停服务、日志查看)
- GitHub Actions CI/CD (自动构建 Windows .msi/.nsis, Linux .deb/.rpm)
