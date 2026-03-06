# Phase 1: MVP (核心安装器与引擎挂载)

> [!NOTE]
> 本阶段目标是验证底层的环境隔离、源码拉取以及依赖安装流程。不追求界面美观，只追求核心业务的“强健性”与“免提权执行”。

## 1. 系统基建 (Rust/Tauri 底层)
- [ ] 探针模块: 检测 `AppData/Local/OpenClawLauncher` 目录下是否存在有效的 `node.exe` (v18+)。
- [ ] 下载模块: 如果没有 Node，调用 Tauri Rust 原生网络接口（避免 PS 脚本被杀），流式下载对应系统架构的 Node.js Portable 压缩包。
- [ ] 解压模块: 使用 Rust 解压缩 ZIP 文件至沙盒目录。

## 2. 源码获取与初始化 (Node.js 侧)
- [ ] 网络探测: 编写 Node.js 脚本 (使用自带环境执行)，发包测试 `github.com` 的响应延迟。
- [ ] 下载源码: 若 GitHub 通畅拉取官方 Release ZIP；若超时则切换 OSS/Gitee 镜像下载 OpenClaw 源码 ZIP。
- [ ] 安装依赖: 在源码目录下执行 `npm install --omit=dev`。设置 NPM 源为 Taobao Mirror 以应对网络波动。

## 3. 基础启停与 UI 骨架 (React/Vue)
- [ ] 路由配置: 单页面，包含初始化进度页和启停主页。
- [ ] 进程唤醒: 点击 Start，通过 Tauri 唤醒 `npm start` 子进程，并拦截控制台输出流 (stdout/stderr)。
- [ ] UI 展示: 解析并在界面极简展示：“启动加载中...” -> “运行成功，端口 3000”。
