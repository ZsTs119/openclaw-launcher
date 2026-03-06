# OpenClaw Launcher - 开发任务总表 (AI 开发规范版)

> 本文件用于追踪项目的整体进度，由 AI 或开发者在完成特定功能后打勾更新。它作为跨越多个 Context 的长期记忆与进度锚点。

## 📂 项目结构与文档规范 (当前)
- [x] 输出完整商业 PRD (`/docs/PRD.md`)
- [x] 建立阶段性开发文档 (`/docs/phases/*.md`)
- [x] 建立并维护此全局任务表 (`/docs/TODO.md`)

## 🛠️ Phase 1: MVP 核心安装器 (参考 /docs/phases/phase1_mvp.md)
- [x] 搭建 Tauri + React/Vue 基础项目脚手架 ✅ (570 crates compiled, 0 errors, .deb/.rpm OK)
- [x] 实现 Rust 侧 Node.js 下载与本地释放 (AppData 沙盒机制) ✅ (667 crates, 0 errors)
- [x] 实现源码 ZIP 网络拉取与解压 (智能切换镜像源) ✅ (GitHub + 2 mirrors fallback)
- [x] 实现局部环境变量下的 `npm install` ✅ (Taobao mirror autoswitch + retry)
- [x] 实现基础控制台 UI (启停服务、读取基础日志) ✅ (React + Rust full-stack, 0 errors)
- [ ] [Phase 1 测试]: 在纯净版 Windows/Mac 虚拟机无报错启动 OpenClaw。

## 🎨 Phase 2: "Aha Moment" 体验改造 (参考 /docs/phases/phase2_experience.md)
- [x] [P0] 配置注入: 自动生成 `openclaw.json` (非破坏性) ✅
- [x] [P0] 配置注入: 自动生成 `models.json` (预置免费 API Key) ✅
- [ ] [P1] 工作区向导: 首次启动弹出文件夹选择对话框
- [x] [P1] 启动后自动打开浏览器 (`localhost:3000`) ✅
- [ ] [P2] UI 升级: 状态大卡片 (运行时长、模型、工作区路径)
- [ ] [P2] 人话日志: 日志翻译层 + 原始/人话切换
- [ ] [P3] 预置技能包: 内置 `skill-creator` 和 `skill-lookup`
- [ ] [Phase 2 测试]: 小白用户双击安装 → 浏览器弹出 → 直接对话

## ⚙️ Phase 3: 管家与生态补全
- [ ] [暂未开工] 开发 3000 端口占用探针与“一键修复网络”逻辑
- [ ] [暂未开工] 实现退出隐藏 (System Tray) 与后台守护模式
- [ ] [暂未开工] 实现客户端级的 UI 换模型和换秘钥功能
- [ ] [暂未开工] 打包编译设定: Inno Setup 防火墙白名单注入 & 数字签名申请准备
