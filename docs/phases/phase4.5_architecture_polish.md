# Phase 4.5: 架构打磨 — 消除协作瓶颈 ✅

> ✅ 完成 — `v2-phase4.5-complete`

## 背景

Phase 4 将 App.tsx 从 1170 行降到 568 行，后端 openclaw.rs 拆为 4 模块。
但架构审计（6.2/10 分）发现 3 个协作瓶颈仍需解决：

| 瓶颈 | 严重性 | 说明 |
|---|---|---|
| `App.css` 1,403 行单文件 | 🔴 高 | 多人改 UI 必冲突 |
| `App.tsx` Dashboard/Models/Settings 仍内联 | 🟡 中 | 3 个 Tab 约 300 行 JSX 未拆 |
| `config.rs` 426 行多职责 | 🟡 中 | Provider 查询 + API Key 管理 + 重置混在一起 |

---

## Stage 7: CSS 模块化拆分 ⏱️ ~1h

**目标**：每个组件只引用自己的样式文件，多人改不同组件的 CSS 互不冲突

**拆分映射**（按 App.css 中已有的 `===== 节名 =====` 注释切割）：

| App.css 区段 | 行范围 | 目标文件 |
|---|---|---|
| Custom Scrollbar + CSS Variables (reset/root) | 1-76 | `src/styles/global.css` |
| Header (Glassmorphism) | 77-147 | `src/styles/header.css` |
| Tab Navigation | 148-222 | `src/styles/tabs.css` |
| Dashboard (Hero Layout) + Stats + Info Cards | 223-424, 1190-1232 | `src/styles/dashboard.css` |
| Models Page | 425-646 | `src/styles/models.css` |
| Settings Page + About + Settings 补充 | 647-864, 1233-1300 | `src/styles/settings.css` |
| Button Utility | 865-956 | `src/styles/buttons.css` |
| Logs Panel | 957-1049 | `src/styles/logs.css` |
| Init Screen | 1050-1189 | `src/styles/setup.css` |
| Model Switch Modal + Modal | 1301-1403 | `src/styles/modal.css` |
| Animations (keyframes) | 848-864 | `src/styles/animations.css` |

**变更范围**：
- [NEW] `src/styles/` 下 11 个 CSS 文件
- [MODIFY] `App.css` → 删除内容，改为统一 import 入口
- [MODIFY] 各组件文件 → 添加对应 `import "../styles/xxx.css"`

**验证标准**：
```
✅ npm run tauri dev → UI 视觉完全不变
✅ 每个 CSS 文件独立可读、无交叉依赖
✅ App.css 仅保留 imports，< 30 行
```

---

## Stage 8: Tab 页面组件拆分 ⏱️ ~2h

**目标**：App.tsx 从 568 行降到 ~150 行，只做 Tab 路由 + 全局状态桥接

**提取计划**：

| 组件 | 来源行范围 | 预估行数 | Props |
|---|---|---|---|
| `DashboardTab.tsx` | 109-176 | ~80 | running, servicePort, uptime, currentConfig, providerDisplayName, modelDisplayName, handleStartService, handleStopService, loading, setShowKeyModal |
| `ModelsTab.tsx` | 179-250 | ~90 | providers, currentConfig, selectedModel, pendingModel, showModelConfirm, setSelectedModel, setPendingModel, setShowModelConfirm, handleSetModel |
| `SettingsTab.tsx` | 253-416 | ~200 | settingsTab, setSettingsTab, workspacePath, servicePort, running, reinstalling, repairing, handleFolderSelect, handleResetConfig, handleReinstall, handleRepairConnection, logs, showRawLogs, toggleRawLogs, logsEndRef, repairToast, setRepairToast |

**变更范围**：
- [NEW] `src/components/DashboardTab.tsx`
- [NEW] `src/components/ModelsTab.tsx`
- [NEW] `src/components/SettingsTab.tsx`
- [MODIFY] `App.tsx` → 替换内联 JSX 为组件调用

**验证标准**：
```
✅ npm run tauri dev → 三个 Tab 功能完全正常
✅ App.tsx < 180 行
✅ 各组件文件独立，只通过 props 通信
```

---

## Stage 9: config.rs 职责拆分 ⏱️ ~1h

**目标**：config.rs 按职责拆为两个模块，各文件 < 250 行

**当前 config.rs 函数清单**：

| 函数 | 行范围 | 目标模块 |
|---|---|---|
| `get_user_openclaw_dir` | 5-12 | `config.rs`（保留） |
| `ProviderInfo` / `ModelInfo` / `CurrentConfig` 类型 | 17-44 | `config.rs`（保留） |
| `get_providers` | 46-54 | `providers.rs`（新） |
| `migrate_gateway_config` | 56-103 | `config.rs` |
| `get_current_config` | 106-134 | `config.rs` |
| `save_api_config` | 136-283 | `config.rs` |
| `set_default_model` | 285-319 | `config.rs` |
| `open_provider_register` | 321-331 | `providers.rs`（新） |
| `open_url` | 333-338 | `providers.rs`（新） |
| `reset_config` | 340-364 | `config.rs` |
| Helper functions | 368-423 | `config.rs` |

**变更范围**：
- [NEW] `src-tauri/src/providers.rs` — `get_providers`, `open_provider_register`, `open_url`
- [MODIFY] `config.rs` — 移除迁出的函数
- [MODIFY] `lib.rs` — 注册新模块

**验证标准**：
```
✅ cargo check 编译通过
✅ cargo test 8/8 通过
✅ config.rs < 300 行
✅ 前端 AI 引擎列表正常 + 注册链接正常
```

---

## 协作约定

每个 Stage 完成后：
1. 运行完整验证测试
2. `git commit` 并推到 `v2-dev`
3. 打 `v2-stage{N}-complete` tag
4. 确认无误后再开始下一个 Stage

**任何 Stage 出问题**：`git revert` 回到上一个通过的 Stage。
