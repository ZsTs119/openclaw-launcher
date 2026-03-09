# Phase 5.4: 安装界面 Premium 优化 — 极光浮动风格

> 📋 待开始

## 铁律

> [!CAUTION]
> **纯 UI/CSS 改动，不修改任何功能逻辑。** 不动 `invoke()` 调用、后端 Rust 代码。
> 唯一的 Hook 改动：错误展示通道从内联文本改为弹窗 state。

---

## Stage 18: 启动界面极光浮动重构

### 设计定稿

参考效果：极光浮动风格，项目主配色 `#8b5cf6` 紫 + `#06b6d4` 青。

**核心要素：**
1. **去除卡片容器** — 移除 `.startup-box` 的背景/边框/阴影，改为无边框浮动布局
2. **极光背景** — 顶部 15% 区域用 2~3 层 `radial-gradient` + `filter: blur()` + CSS `@keyframes` 做缓慢飘动的紫(`#8b5cf6`)/青(`#06b6d4`)薄雾，极淡
3. **标题渐变** — "OpenClaw Launcher" 36~40px 加粗，**白→灰渐变** `linear-gradient(135deg, #ffffff, #6b7280)`，与关于页 `.about-logo` 配色一致
4. **版本号** — 标题下方 `v0.3.1` 小字灰色 `rgba(255,255,255,0.4)`
5. **进度条** — **白/浅灰渐变**填充 + 柔和白色 `box-shadow` 光晕，低调克制
6. **百分比数字** — 进度条下方显示 `45%` monospace
7. **错误弹窗** — 错误时弹出 Modal 而非内联显示

### 变更文件

| 文件 | 改动 |
|---|---|
| `src/styles/setup.css` | 重写 `.startup-container` 背景（极光层）、`.startup-box` 去卡片化、`.startup-logo` 放大+渐变、新增极光 `@keyframes`、进度条发光样式 |
| `src/components/SetupWizard.tsx` | 接收 `appVersion` / `setupError` / `onDismissError` / `onRetry` props，渲染版本号、百分比、错误 Modal |
| `src/hooks/useSetup.ts` | 新增 `setupError` state + `clearSetupError` / `retrySetup` 回调（错误展示通道变更，不改功能） |
| `src/App.tsx` | 解构并传递新 props 给 SetupWizard |

---

## 验收标准

```
✅ npm run tauri dev 无 TS/CSS 编译错误
✅ 启动界面内容垂直居中，无卡片边框
✅ 顶部有紫/青极光缓慢飘动动画
✅ 标题 "OpenClaw Launcher" 紫→青渐变大字
✅ 进度条紫→青渐变 + 底部发光
✅ 错误时弹出 Modal 弹窗而非内联文字
✅ 工作区选择页面风格与新样式一致
```
