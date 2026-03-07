# OpenClaw Launcher - 开发任务总表 (AI 开发规范版)

> 本文件用于追踪项目的整体进度，由 AI 或开发者在完成特定功能后打勾更新。它作为跨越多个 Context 的长期记忆与进度锚点。

## 📂 项目结构与文档规范 (当前)
- [x] 输出完整商业 PRD (`/docs/PRD.md`)
- [x] 建立阶段性开发文档 (`/docs/phases/*.md`)
- [x] 建立并维护此全局任务表 (`/docs/TODO.md`)

## 🛠️ Phase 1: MVP 核心安装器
- [x] 搭建 Tauri + React 基础项目脚手架 ✅
- [x] 实现 Rust 侧 Node.js 下载与本地释放 ✅
- [x] 实现源码 ZIP 网络拉取与解压 ✅
- [x] 实现 `npm install` + 镜像自动切换 ✅
- [x] 实现基础控制台 UI ✅
- [ ] [Phase 1 测试]: 纯净版 Windows/Mac 虚拟机无报错启动

## 🎨 Phase 2: "Aha Moment" 体验改造
- [x] 配置注入: 自动生成 `openclaw.json` ✅
- [x] 配置注入: 自动生成 `models.json` ✅
- [x] 工作区向导: 首次启动弹出文件夹选择 ✅
- [x] 启动后自动打开浏览器 ✅
- [x] UI 升级: 状态大卡片 ✅
- [x] 人话日志: 日志翻译层 + 原始/人话切换 ✅
- [x] 预置技能包 ✅

## 🛡️ Phase 2.5: 稳定性兜底
- [x] pnpm.cjs 路径动态探测 ✅
- [x] 端口占用检测 + 自动换端口 ✅
- [x] 服务进程崩溃检测 ✅
- [x] CMD 弹窗隐藏 (CREATE_NO_WINDOW) ✅
- [x] Gateway 正确启动 (gateway + --allow-unconfigured + --port) ✅
- [x] Gateway Auth Token 自动配置 ✅
- [x] 自动端口选择 (18789-18799 扫描) ✅
- [x] Windows 中文用户名路径编码兼容 ✅
- [x] Windows 260 字符长路径限制处理 ✅
- [x] 完全断网友好提示 ✅
- [x] 磁盘空间预检查 ✅

## ⚙️ Phase 3: v1.0 上线版本 — UI 重构 + API Key 配置

### 🔴 必要功能 (Must-Have)

#### API Key 配置引导
- [ ] API Key 首次引导页面 (SetupPage)
- [ ] 主流提供商列表 (Nvidia/OpenRouter/智谱GLM/阿里百炼/字节方舟/DeepSeek/OpenAI)
- [ ] API Key 输入框 + 密钥验证
- [ ] 自定义中转站支持 (Base URL + API Key)
- [ ] 配置写入 OpenClaw auth 系统 (auth-profiles.json)

#### 模型选择与切换
- [ ] 模型选择页面 (ModelPage)
- [ ] 根据已配置 Key 显示可用模型列表
- [ ] 一键切换默认模型
- [ ] 切换后重启服务生效

#### UI 大重构
- [ ] Tab 导航布局 (仪表盘 / 模型 / 设置 / 日志)
- [ ] 仪表盘: 服务状态 + 启停 + 打开网页端
- [ ] 设置页: API Key 管理、端口、工作区
- [ ] 日志页: 单独页面，给开发者用
- [ ] 精致深色主题 (渐变/玻璃态/微动画)

#### 后端 Tauri 命令
- [ ] `save_api_config(provider, api_key, base_url)` 保存配置
- [ ] `get_current_config()` 读取当前状态
- [ ] `set_default_model(model_id)` 切换模型
- [ ] `validate_api_key(provider, api_key)` 验证 Key 有效性

### 🟡 高级功能 (v1.1+ Later)
- [ ] Google Gemini OAuth 一键登录
- [ ] ChatGPT OAuth 登录
- [ ] Ollama 本地模型集成
- [ ] System Tray 后台守护
- [ ] 代理/网络自动检测修复
- [ ] 日志导出一键打包
- [ ] i18n 国际化

## 🏢 Phase 4: 企业级分发
- [ ] Sentry 错误上报 (opt-in)
- [ ] Windows 代码签名 (EV 证书)
- [ ] macOS 公证 (notarization)
- [ ] 应用内自动更新
- [ ] 企业代理服务器支持

## 🧪 自动化测试
- [x] Rust 单元测试 ✅
- [x] CI 集成 ✅
- [ ] 前端组件测试 (Vitest)
- [ ] E2E 测试: 安装→配置→启动→对话

## 📋 开源项目规范
- [x] LICENSE / CONTRIBUTING / CHANGELOG / SECURITY / CODE_OF_CONDUCT ✅
- [x] GitHub Issue + PR 模板 ✅
- [ ] GitHub Discussions
- [ ] CI 自动生成 Release Notes
