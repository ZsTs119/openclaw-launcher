# Phase 4.6: 最终打磨 — App.tsx 降至 ~150 行 🔧

> 📋 待开始 — 目标：App.tsx 成为纯路由层，所有 UI 组件独立可编辑

## 背景

Phase 4.5 后架构评分 8.4/10。App.tsx 仍有 328 行，其中 5 个内联弹窗占 ~120 行。
useService.ts 253 行承担了 setup 流程 + service 生命周期两大职责。

---

## Stage 10: 弹窗组件提取 ⏱️ ~1.5h

**目标**：App.tsx 中的 5 个内联弹窗提取为独立组件，App.tsx 仅保留组件调用

**提取映射**：

| 内联弹窗 | App.tsx 行范围 | 目标组件文件 | Props |
|---|---|---|---|
| Info / QR Code Modal | 177-184 (8行) | `InfoModal.tsx` | infoModalTitle, setInfoModalTitle |
| Model Switch Modal | 186-214 (29行) | `ModelSwitchModal.tsx` | show, providers, currentConfig, handleSetModel, onClose |
| Reset Confirm Modal | 216-236 (21行) | `ConfirmModal.tsx`（复用） | show, title, children, onCancel, onConfirm |
| Reinstall Confirm Modal | 238-254 (17行) | 同上复用 `ConfirmModal` | 同上 |
| Repair Toast | 256-297 (42行) | `RepairToast.tsx` | show, repairing, onRepair, onDismiss |

> 💡 Reset 和 Reinstall 都是「确认/取消」模式，可抽象为通用 `ConfirmModal` 复用

**变更范围**：
- [NEW] `src/components/ModelSwitchModal.tsx` — 模型切换弹窗
- [NEW] `src/components/ConfirmModal.tsx` — 通用确认对话框
- [NEW] `src/components/RepairToast.tsx` — 修复提示条
- [MODIFY] `App.tsx` — 替换内联弹窗为组件调用

> InfoModal 内容极少（8 行），直接保留在 App.tsx 中更合理，不值得单独拆文件。

**验收标准**：
```
✅ npm run tauri dev → 所有弹窗功能正常（模型切换、重置确认、重装确认、修复提示）
✅ App.tsx < 200 行
✅ 新组件文件各自独立，只通过 props 通信
```

---

## Stage 11: useService Hook 拆分 ⏱️ ~1h

**目标**：拆为 `useSetup`（初始化/安装流程）+ `useService`（运行时生命周期），各 ~130 行

**当前 useService.ts 函数分布**：

| 函数/状态 | 行范围 | 目标 Hook |
|---|---|---|
| phase, progress, progressMsg 状态 | 25-28 | `useSetup` |
| workspacePath 状态 | 31 | `useSetup` |
| checkEnvironment() | 63-92 | `useSetup` |
| runSetup() | 48-61 | `useSetup` |
| handleSelectFolder / handleConfirmWorkspace | 135-153 | `useSetup` |
| handleSwitchWorkspace | 155-174 | `useSetup` |
| setup-progress / setup-log 事件监听 | 97-109 | `useSetup` |
| running, loading, uptime, servicePort 状态 | 26, 29, 30 | `useService` |
| handleStart / handleStop | 176-219 | `useService` |
| reinstalling, repairing 状态 | 32-33 | `useService` |
| confirmReinstall / handleRepairConnection | 220-253 | `useService` |
| heartbeat / port 事件监听 | 111-133 | `useService` |

**变更范围**：
- [NEW] `src/hooks/useSetup.ts` — 初始化、环境检查、安装流程
- [MODIFY] `src/hooks/useService.ts` — 仅保留运行时逻辑
- [MODIFY] `src/App.tsx` — 同时调用 useSetup + useService

**验收标准**：
```
✅ npm run tauri dev → 首次安装流程正常
✅ 启动/停止服务正常
✅ 重装/修复功能正常
✅ useSetup.ts < 140 行, useService.ts < 140 行
```

---

## 协作约定

每个 Stage 完成后：
1. 运行完整验证测试
2. 暂停等待用户验收
3. 验收通过后 `git commit` + `git tag v2-stage{N}-complete`
4. 再开始下一个 Stage
