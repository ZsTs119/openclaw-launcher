# Phase 5.1: UX 细节打磨 — Tab 切换抖动 + 表单布局 + 弹窗跳动 🔧

> 📋 待开始 — 目标：消除所有 font-weight 切换导致的布局抖动，优化表单宽度比例

## 铁律

> [!CAUTION]
> **仅改 CSS 样式和 JSX 布局属性，绝不动任何功能逻辑代码。**

## 背景

Phase 5 完成配色 + 图标统一后，用户验收发现 3 类体验问题：

---

## 问题 A：Bold 切换导致宽度撑开（4 处）

**根因**：`.active` 状态加了 `font-weight: 600`，文字变粗后宽度增大，相邻元素被挤。

**影响位置**：
1. AI引擎页 → `.category-btn.active`（免费注册 / Coding Plan / 自定义中转站）
2. ApiKeyModal 弹窗 → `.category-btn.active`（同一组件复用）
3. ApiKeyModal 弹窗 → `.model-select-btn.active`（模型选择按钮）

**修复方案**：用 `::after` 伪元素预占 bold 宽度，防止切换抖动：

```css
.category-btn {
  /* ... existing styles ... */
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.category-btn::after {
  content: attr(data-text);
  font-weight: 600;
  visibility: hidden;
  height: 0;
  overflow: hidden;
  display: block;
  pointer-events: none;
}
```
同理应用于 `.model-select-btn`。

需要在 JSX 中给每个按钮加 `data-text` 属性（等于按钮文字内容）。

### 变更文件

| 文件 | 改动 |
|---|---|
| `models.css` | `.category-btn` 和 `.model-select-btn` 加 `::after` 伪元素 |
| `ModelsTab.tsx` | `.category-btn` 加 `data-text` 属性 |
| `ApiKeyModal.tsx` | `.category-btn` 和 `.model-select-btn` 加 `data-text` 属性 |

---

## 问题 B：自定义中转站表单太窄

**根因**：JSX 中 `max-width: 500px` + `margin: '0 auto'` 居中，页面宽时左右空白过大。

**修复方案**：改为 `max-width: 640px`，让表单在页面宽度范围内占更合理的比例（约 80% 内容区宽度），既不会太窄也不会撑满。

### 变更文件

| 文件 | 改动 |
|---|---|
| `ModelsTab.tsx` | `max-width: 500px` → `max-width: 640px` |

---

## 问题 C：ApiKeyModal 切 Tab 时标题/图标上下跳动

**根因**：弹窗内容区高度随 tab 切换变化（provider 列表 vs 表单高度不同），弹窗整体高度改变导致标题位置抖动。

**修复方案**：给弹窗内容区设 `min-height`，确保切换 tab 时弹窗最小高度一致，不会上下跳。

### 变更文件

| 文件 | 改动 |
|---|---|
| `ApiKeyModal.tsx` 或 `modal.css` | 弹窗内容区加 `min-height: 360px`（或适当值） |

---

## 附：发现的残余配色问题

审查 CSS 时发现 `models.css` 中仍有 4 处硬编码绿色 `rgba(34, 197, 94, ...)` 未在 Stage 12 中替换（因为不是通过 CSS 变量引用）：

| 行 | 类名 | 值 |
|---|---|---|
| 79-80 | `.active-provider` | `rgba(34, 197, 94, 0.05)` / `rgba(34, 197, 94, 0.3)` |
| 119, 128 | `.badge-free`, `.badge-free-sm` | `rgba(34, 197, 94, 0.15)` |
| 210 | `.model-select-btn.active` | `rgba(34, 197, 94, 0.12)` |
| 219-220 | `.config-status` | `rgba(34, 197, 94, 0.08)` / `rgba(34, 197, 94, 0.2)` |

也一并清理为白灰系配色。

---

## 验收标准

```
✅ npx vite build 通过
✅ AI引擎页 — 切换 免费注册/Coding Plan/自定义中转站 无宽度抖动
✅ ApiKeyModal 弹窗 — 切换 tab 无宽度抖动，标题不上下跳
✅ 模型选择按钮切换无抖动
✅ 自定义中转站表单宽度舒适
✅ 零功能代码修改
```

## 协作约定

完成后暂停等用户 `npm run tauri dev` 验收，通过后 commit + tag `v2-stage15-complete`。
