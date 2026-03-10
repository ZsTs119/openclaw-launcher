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
- [x] API Key 首次引导页面 (SetupPage) ✅
- [x] 主流提供商列表 (Nvidia/OpenRouter/Groq/智谱GLM/阿里百炼/字节方舟/DeepSeek/OpenAI/Kimi) ✅
- [x] API Key 输入框 + 保存 ✅
- [x] 自定义中转站支持 (Base URL + API Key) ✅
- [x] 配置写入 OpenClaw 配置系统 ✅

#### 模型选择与切换
- [x] 模型选择页面 (ModelPage) ✅
- [x] 根据已配置 Key 显示可用模型列表 ✅
- [x] 一键切换默认模型 ✅

#### UI 大重构
- [x] Tab 导航布局 (仪表盘 / 模型 / 设置 / 日志) ✅
- [x] 仪表盘: 服务状态 + 启停 + 打开网页端 ✅
- [x] 设置页: 端口、版本、工作区 ✅
- [x] 日志页: 单独页面，给开发者用 ✅
- [x] 精致深色主题 (渐变/半透明/微动画) ✅

#### 后端 Tauri 命令
- [x] `save_api_config(provider, api_key, base_url)` 保存配置 ✅
- [x] `get_current_config()` 读取当前状态 ✅
- [x] `set_default_model(model_id)` 切换模型 ✅
- [x] `get_providers()` 获取提供商列表 ✅
- [x] `open_provider_register()` 打开注册页 ✅

### 🟡 高级功能 (v1.1+ Later)
- [ ] Google Gemini OAuth 一键登录
- [ ] ChatGPT OAuth 登录
- [ ] Ollama 本地模型集成
- [ ] System Tray 后台守护
- [ ] 代理/网络自动检测修复
- [ ] 日志导出一键打包
- [ ] i18n 国际化

## 🎨 Phase 3.5: Premium UI 重构与体验打磨 (Next)
- [x] **视觉重构**: 引入极简深色高级皮肤 (毛玻璃、纯黑底色、微妙渐变)
- [x] **导航精简**: 移除主级「日志」Tab，将其并入「设置」作为二级栏目
- [x] **设置重构 (子路由)**:
  - [x] `通用`: 主题切换 (明/暗)、开机自启开关
  - [x] `日志`: 简化展示层，增加 [一键导出日志] ZIP 功能
  - [x] `关于`: 版本信息、检查更新机制
  - [x] `开源社区`: 排版推荐开源项目及链接
- [x] **仪表盘美化**: 去线框化，状态灯与模型展示极简处理
- [x] **模型页重构**: 网格布局 + 弹窗 (Modal) 配置交互

## 🏗️ Phase 4: 架构重构
- [x] Stage 1: 基础设施（types/utils 提取）✅ `v2-stage1-complete`
- [x] Stage 2: 通用 UI 组件（Modal）✅ `v2-stage2-complete`
- [x] Stage 3: 页面组件拆分（Header/ApiKeyModal/SetupWizard）✅ `v2-stage3-complete`
- [x] Stage 4: Custom Hooks（useLogs/useConfig/useService）✅ `v2-stage4-complete`
- [x] Stage 5: 后端 Rust 模块拆分 ✅ `v2-stage5-complete`
- [x] Stage 6: Provider 数据外置 ✅ `v2-stage6-complete`

## 🔧 Phase 4.5: 架构打磨（消除协作瓶颈）✅
- [x] Stage 7: CSS 模块化拆分 ✅ `v2-stage7-complete`
- [x] Stage 8: Tab 页面组件拆分 ✅ `v2-stage8-complete`
- [x] Stage 9: config.rs 职责拆分 ✅ `v2-stage9-complete`

## 🔧 Phase 4.6: 最终打磨（App.tsx → ~150 行）✅
- [x] Stage 10: 弹窗组件提取 ✅ `v2-stage10-complete`
- [x] Stage 11: useService Hook 拆分 ✅ `v2-stage11-complete`

## 🎨 Phase 5: UI 风格统一（配色 + 图标一致性）✅
- [x] Stage 12: 色彩体系重置 ✅ `v2-stage12-complete`
- [x] Stage 13: Emoji → Lucide 图标统一 ✅ `v2-stage13-complete`
- [x] Stage 14: 内联色值清理 ✅ `v2-stage14-complete`

## 🔧 Phase 5.1: UX 细节打磨 ✅
- [x] Stage 15: Tab 切换抖动修复 + 表单宽度优化 + 弹窗跳动修复 + 残余绿色清理 ✅ `v2-stage15-complete`

## 📋 Phase 5.2: 日志诊断面板优化 ✅
- [x] Stage 16: 日志面板简化 + 导出诊断 ZIP ✅ `v2-stage16-complete`

## 🔍 Phase 5.3: 关于页面优化 ✅
- [x] Stage 17: 版本检查（GitHub API + 旋转动画）+ 二维码替换 ✅ `v2-stage17-complete`

## 🎨 Phase 5.4: 安装界面 Premium 优化 ✅
- [x] Stage 18: 启动界面极光浮动重构 ✅ `v2-stage18-complete`

## 🚀 Phase 5.5: 仪表盘体验优化 + 端口扩展 ✅
- [x] Stage 19: 全局启动加载框 + Logo 替换 + 脉冲光效 + 端口范围扩展 ✅ `v2-stage19-complete`

## ⚙️ Phase 5.6: 自定义模型 ID 输入 ✅
- [x] Stage 20: ApiKeyModal + ModelSwitchModal 支持手动输入模型 ID ✅ `v2-stage20-complete`

## 🛡️ Phase 5.7: 多平台稳定性修复 ✅
- [x] OpenClaw 版本锁定 (`download.rs` pin `v2026.2.6-1` + `.openclaw_version` 标记 + 自动版本检测) ✅ `v0.4.1`
- [x] node-llama-cpp 智能重试 (`installer.rs` 检测 postinstall 崩溃 → `NODE_LLAMA_CPP_SKIP_DOWNLOAD=true` 重试) ✅ `v0.4.2`
- [x] Ubuntu 闪退修复 (`environment.rs` 替换 unsafe `Statvfs` FFI 为 `df` 命令) ✅ `v0.4.3`
- [x] 发版流程规范化 (`AGENTS.md` 新增版本同步清单 + Release Notes 模板) ✅ `v0.4.1`
- [x] GPL-3.0 许可证切换 + 43 文件版权头 + README_EN 同步 ✅ `v0.4.1`

---

## ⚠️ 发版规范 Checklist（正式发布前必读）

> **版本号规范**：Semantic Versioning (`MAJOR.MINOR.PATCH`)
> - 当前：`0.4.3` → 下个功能版本 `0.5.0`，修 bug `0.4.4`，正式版 `1.0.0`

| 步骤 | 说明 |
|---|---|
| 1. 更新 `package.json` version | 唯一真相源，代码和检查更新都从这里读 |
| 2. 更新 `Cargo.toml` version | Tauri 也需要同步 |
| 3. 更新 SettingsTab 显示版本 | `当前版本 vX.X.X` 硬编码处 |
| 4. Git tag 用 semver | `git tag v0.4.0`（非 `v2-stageXX-complete`） |
| 5. 在 GitHub 创建 Release | 不只是 tag！Release 才会被 `/releases/latest` API 识别 |
| 6. Release 附带安装包 | `.msi` / `.dmg` / `.AppImage` 等 |

> **注意**：开发阶段的 `v2-stageXX-complete` tag 仅供内部追踪，不影响版本检查。
> 客户端检查更新时只认 semver 格式的 `tag_name`（`/^v?\d+\.\d+\.\d+$/`）。

---

## 🏢 Phase 6: 企业级分发
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
