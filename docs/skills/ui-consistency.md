---
name: ui-consistency
description: >
  UI consistency standards for OpenClaw Launcher. Use when creating new UI
  components, modifying existing styles, adding buttons or icons, choosing colors,
  or reviewing UI changes. Enforces Lucide icons, CSS variables, Modal component,
  framer-motion animations, and dark theme conventions.
---

# UI 一致性规范

## 图标系统

**只使用 Lucide React 图标**，不使用 emoji 或其他图标库。

```tsx
import { Bot, Plus, Pencil, Trash2 } from "lucide-react";

// 标准参数
<Bot size={14} strokeWidth={1.5} />     // 卡片内小图标
<Bot size={16} strokeWidth={1.5} />     // 标题图标
<Bot size={20} strokeWidth={1.5} />     // 大图标
```

| 场景 | size | strokeWidth |
|---|---|---|
| 按钮内图标 | 14 | 1.5 |
| 标题图标 | 16 | 1.5 |
| 卡片主图标 | 20 | 1.5 |
| 启动弹窗 | 28 | 1.5 |

**禁止**：❌ ✅ ⚠️ 🎉 🔄 ⚙️ 等 emoji。日志消息用 `[OK]` `[!]` `[WARN]` 文本前缀。

## 配色系统

**只使用 CSS Variables**，不使用硬编码颜色值。

```css
/* 背景层级 */
--bg-primary     /* 页面背景 */
--bg-secondary   /* 卡片背景 */
--bg-tertiary    /* 输入框、下拉背景 */

/* 文字 */
--text-primary   /* 正文 */
--text-secondary /* 次要文字 */
--text-muted     /* 弱化文字 */

/* 强调色 */
--accent-primary /* 主要按钮、链接 */
--accent-green   /* 成功状态 */
--accent-red     /* 危险操作 */
--accent-yellow  /* 警告 */
```

**禁止**：`color: #4ade80`、`background: rgba(74, 222, 128, 0.08)` 等硬编码值。

## 按钮规范

```tsx
// 幽灵按钮（卡片操作）
<button className="btn-ghost btn-chat">
    <MessageCircle size={14} strokeWidth={1.5} /> 打开对话
</button>

// 主要按钮
<button className="btn btn-primary">保存</button>

// 危险按钮（删除等）
<button className="btn-delete">删除</button>
```

| class | 用途 |
|---|---|
| `btn-ghost` | 无背景的操作按钮 |
| `btn-ghost btn-chat` | 聊天相关操作 |
| `btn-ghost btn-history` | 历史操作 |
| `btn-delete` | 红色删除按钮 |
| `btn btn-primary` | 主要提交按钮 |

## 弹窗规范

**统一使用 `<Modal>` 组件**：

```tsx
import { Modal } from "./ui/Modal";

<Modal
    isOpen={showModal}
    onClose={() => setShowModal(false)}
    title="弹窗标题"
    subtitle="可选副标题"
>
    {/* 内容 */}
</Modal>
```

**禁止**：自定义 div 弹窗、window.confirm、window.alert。

## 动画规范

**使用 framer-motion**：

```tsx
import { motion, AnimatePresence } from "framer-motion";

// 页面/组件进入动画
<motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
>

// 列表项动画
<motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: index * 0.05 }}
>

// 条件渲染动画
<AnimatePresence>
    {show && <motion.div exit={{ opacity: 0 }}>...</motion.div>}
</AnimatePresence>
```

## 删除操作规范

**所有删除操作必须有倒计时确认**：

```tsx
// 3 秒倒计时
const [deleteCountdown, setDeleteCountdown] = useState(0);

useEffect(() => {
    if (deleteCountdown > 0) {
        const timer = setTimeout(() => setDeleteCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }
}, [deleteCountdown]);

// 按钮禁用状态
<button
    disabled={deleteCountdown > 0}
    onClick={handleDelete}
>
    {deleteCountdown > 0 ? `确认删除 (${deleteCountdown}s)` : "确认删除"}
</button>
```

## 表单规范

```tsx
<label className="form-label">
    标签文字
    <input className="form-input" />
</label>

<label className="form-label">
    多行输入
    <textarea className="form-textarea" rows={6} />
</label>
```

## 下拉选择

使用 `<CustomDropdown>` 组件代替原生 `<select>`。

## 快速检查清单

新增 UI 时自查：
- [ ] 图标用的 Lucide？size 和 strokeWidth 对吗？
- [ ] 颜色用的 CSS Variable？
- [ ] 弹窗用的 `<Modal>` 组件？
- [ ] 动画用的 framer-motion？
- [ ] 删除操作有倒计时？
- [ ] 没有 emoji？
