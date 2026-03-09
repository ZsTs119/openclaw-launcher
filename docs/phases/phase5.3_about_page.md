# Phase 5.3: 关于页面优化 — 版本检查 + 二维码替换

> 📋 待开始

## 铁律

> [!CAUTION]
> **版本检查仅做前端 fetch GitHub API，不涉及后端改动。二维码替换仅换图片资源。**

---

## Stage 17: 版本检查 + 二维码替换

### A. 版本检查按钮

**当前状态**：`RefreshCw` 按钮无 onClick，纯展示。

**实现方案**：
1. 点击按钮 → RefreshCw 图标加 CSS `spin` 动画（旋转）
2. `fetch('https://api.github.com/repos/ZsTs119/openclaw-launcher/releases/latest')`
3. 解析 `response.tag_name`（如 `v0.4.0`），与本地 `v0.3.1` 比较
4. 结果弹窗（使用 `message()` 原生对话框）：
   - 已是最新：`当前版本 v0.3.1 已是最新`
   - 有更新：`发现新版本 vX.X.X → 点击前往下载` → 打开 GitHub Releases 页

**状态管理**：新增 `checkingUpdate` state 控制旋转动画。

#### 变更文件

| 文件 | 改动 |
|---|---|
| `SettingsTab.tsx` | 新增 `onCheckUpdate` prop，按钮 onClick 绑定，RefreshCw 加 spin class |
| `App.tsx` | 新增 `handleCheckUpdate` handler（fetch + 比较 + message 弹窗） |
| `settings.css` | 新增 `.spin` 旋转动画 keyframes |

---

### B. 二维码图片替换

**当前状态**：通用 info 弹窗显示占位符文字「二维码图片占位符」，微信和赞赏共用同一个模板。

**修改方案**：
1. 用户提供 2 张图片：微信公众号 QR、支付宝收钱码
2. 存放 `src/assets/qr-wechat.png`、`src/assets/qr-alipay.png`
3. 拆分 info 弹窗：根据 `infoModalTitle` 内容显示对应图片
   - 标题含「微信」→ 显示 `qr-wechat.png`
   - 标题含「赞赏」→ 显示 `qr-alipay.png` + 文案「如果 OpenClaw 对你有帮助，可以请作者喝杯咖啡 ☕」

#### 变更文件

| 文件 | 改动 |
|---|---|
| [NEW] `src/assets/qr-wechat.png` | 用户提供 |
| [NEW] `src/assets/qr-alipay.png` | 用户提供 |
| `App.tsx` | info 弹窗根据标题条件渲染不同图片和文案 |

---

## 验收标准

```
✅ npx vite build 通过
✅ 点击更新按钮 → 图标旋转 → 弹出系统原生对话框告知结果
✅ 有新版时提供下载链接
✅ 微信弹窗显示公众号二维码
✅ 赞赏弹窗显示支付宝收钱码 + 咖啡文案
```
