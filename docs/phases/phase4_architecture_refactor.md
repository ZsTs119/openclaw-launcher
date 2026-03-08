# Phase 4: 架构重构 🏗️

> Stage 1-4 ✅ | Stage 5 🚧 开发中 | Stage 6 ⭕ 待开始

## 目标

| 维度 | 目标 |
|---|---|
| **协作性** | 多人同时开发不同模块互不影响 |
| **可维护性** | 新人看代码 30 分钟就能上手一个模块 |
| **稳定性** | 每个阶段验证通过才进下一步，功能零回归 |
| **复用性** | 通用组件（Modal/Toast/Button）可跨页面复用 |

---

## 阶段计划

### Stage 1: 基础设施 & 开发规范 ✅

- [x] 创建 `src/types/index.ts`（从 App.tsx 抽取所有 TypeScript 类型）
- [x] 创建 `src/utils/log-humanizer.ts`（从 App.tsx 抽取日志翻译）
- [x] 创建 `src/utils/ansi-strip.ts`（从 App.tsx 抽取 ANSI 清理）
- [x] App.tsx 改为 import 这些模块
- **Tag**: `v2-stage1-complete`

---

### Stage 2: 通用 UI 组件库 ✅

- [x] `src/components/ui/Modal.tsx` + `ModalFooter.tsx` — 通用弹窗
- [x] 重构 5 个内联弹窗为共享组件
- **Tag**: `v2-stage2-complete`

---

### Stage 3: 页面级组件拆分 ✅

- [x] `src/components/Header.tsx` (31行, 3 props)
- [x] `src/components/ApiKeyModal.tsx` (197行, 18 props)
- [x] `src/components/SetupWizard.tsx` (83行, 7 props)
- [x] App.tsx: 1170 → 894 行 (-24%)
- **Tag**: `v2-stage3-complete`

---

### Stage 4: 逻辑层抽取（Custom Hooks）✅

- [x] `src/hooks/useService.ts` (255行) — 服务启停、状态监控、端口管理
- [x] `src/hooks/useConfig.ts` (159行) — 配置读写、Provider 查询、模型切换
- [x] `src/hooks/useLogs.ts` (46行) — 日志采集、格式化、自动滚动
- [x] `running` 状态提升到 App 层解决 hooks 循环依赖
- [x] App.tsx: 894 → 568 行 (总计 -51%)
- **Tag**: `v2-stage4-complete`

---

### Stage 5: 后端模块拆分 ⏱️ ~2h

**目标**：消灭 God module，统一路径管理

- [ ] `src-tauri/src/paths.rs` — 统一路径管理
  - `sandbox_dir()` / `user_config_dir()` / `node_dir()` / `openclaw_engine_dir()`
  - 所有其他模块通过 `paths::xxx()` 获取路径
- [ ] `src-tauri/src/download.rs` — 从 openclaw.rs 拆出下载 + 解压逻辑
- [ ] `src-tauri/src/installer.rs` — 从 openclaw.rs 拆出 pnpm/npm 安装
- [ ] `src-tauri/src/setup.rs` — 编排层（调用 download + installer + config）
- [ ] `openclaw.rs` 只保留 check_xxx 函数和常量

**验证**：
```bash
cargo test                    # Rust 单元测试
npm run tauri dev             # 完整流程测试
# + 全新安装测试（删除 AppData）
```

---

### Stage 6: Provider 数据外置 ⏱️ ~1h

**目标**：加新 Provider 不需要改 Rust、不需要重新编译

- [ ] `src-tauri/resources/providers.json` — Provider 数据文件
- [ ] `config.rs` 的 `get_providers()` 改为从 JSON 文件加载
- [ ] 前端通过 Tauri invoke 获取（接口不变）

**验证**：
```bash
# 在 providers.json 里加一个测试 Provider
# 重启 → 前端 AI 引擎列表能看到新 Provider
# 不需要重新编译 Rust
```

---

## 文件结构目标

### 前端（Stage 1-4 完成后）
```
src/
├── App.tsx                    ← ~150行，纯路由
├── App.css                    ← 全局样式变量
├── main.tsx
├── types/
│   └── index.ts               ← 所有共享类型
├── utils/
│   ├── log-humanizer.ts
│   └── ansi-strip.ts
├── hooks/
│   ├── useService.ts
│   ├── useConfig.ts
│   ├── useLogs.ts
│   ├── useSetup.ts
│   └── useToast.ts
├── components/
│   ├── Header.tsx
│   ├── SetupWizard.tsx
│   ├── Dashboard.tsx
│   ├── LogViewer.tsx
│   ├── SettingsPanel.tsx
│   ├── ApiKeyModal.tsx
│   └── ui/                    ← 可复用基础组件
│       ├── Modal.tsx
│       ├── Toast.tsx
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── StatusBadge.tsx
│       └── styles/
│           ├── modal.css
│           ├── toast.css
│           └── ...
└── assets/
```

### 后端（Stage 5-6 完成后）
```
src-tauri/src/
├── main.rs
├── lib.rs                     ← 命令注册
├── paths.rs                   ← 🆕 统一路径管理
├── environment.rs             ← Node 沙箱（不变）
├── service.rs                 ← 服务启停（不变）
├── download.rs                ← 🆕 下载 + 解压
├── installer.rs               ← 🆕 pnpm/npm 安装
├── setup.rs                   ← 🆕 编排层
├── config.rs                  ← 配置读写（精简）
└── openclaw.rs                ← 只保留 check 函数
```

---

## 协作约定

每个 Stage 完成后：
1. 运行完整验证测试
2. `git commit` 并标注 Stage 号
3. 推到 `v2-dev` 分支
4. 确认无误后再开始下一个 Stage

**任何 Stage 出问题**：直接 `git revert` 回到上一个通过的 Stage，不做修修补补。
