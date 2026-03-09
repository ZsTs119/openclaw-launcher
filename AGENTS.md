# OpenClaw Launcher — AI 开发规范

> 所有 AI 编码助手（Gemini/Claude/Copilot/Cursor）在操作此项目时**必须遵守**以下规则。

## 🚨 核心红线

### 1. UI 重构不碰功能代码
- **只改** `.tsx` / `.css` 文件的**渲染部分**（JSX/样式）
- **不改** `invoke()` 调用、handler 函数内部逻辑、事件监听
- **不改** `.rs` 后端文件（除非任务明确要求）
- **不删除** 任何已有的功能代码
- **不编造** 不存在的 API/函数/模块

### 2. 后端接口冻结
- `#[tauri::command]` 函数的**签名**（名称 + 参数 + 返回类型）是接口契约
- 改签名 = Breaking Change，必须同步更新所有前端 `invoke()` 调用
- 新增命令可以，删除/改名命令必须经过讨论

### 3. 路径管理统一
- 沙箱路径（引擎源码）：通过 `paths::engine_dir()` 获取
- 用户配置路径（`~/.openclaw/`）：通过 `paths::user_config_dir()` 获取
- **严禁**在业务代码中直接拼接路径

---

## 📁 文件职责边界

### 前端
| 目录 | 职责 | 谁能改 |
|---|---|---|
| `src/components/ui/` | 可复用基础组件 | UI 任务 |
| `src/components/*.tsx` | 页面级组件 | UI 或功能任务 |
| `src/hooks/` | 业务逻辑封装 | 功能任务 |
| `src/types/` | TypeScript 类型定义 | 两者都行 |
| `src/utils/` | 纯工具函数 | 两者都行 |
| `src/App.tsx` | 路由和全局状态 | 慎改 |

### 后端
| 文件 | 职责 | 改动风险 |
|---|---|---|
| `environment.rs` | Node 沙箱管理 | 🔴 高 |
| `service.rs` | 进程启停/端口 | 🔴 高 |
| `config.rs` | 配置读写 | 🟡 中 |
| `paths.rs` | 统一路径 | 🟡 中 |
| `lib.rs` | 命令注册 | 🟢 低 |

---

## 🔀 Git 分支规范

| 分支 | 用途 | 谁能 push |
|---|---|---|
| `main` | 稳定发布版，已冻结 | 仅通过 PR |
| `v2-dev` | V2 开发主线 | 开发者 |
| `feature/*` | 新功能开发 | 各开发者 |
| `fix/*` | Bug 修复 | 各开发者 |
| `refactor/*` | 重构任务 | 各开发者 |

### Commit 规范
```
feat(component): add Modal reusable component
fix(service): handle WSL port conflict
refactor(frontend): extract LogViewer from App.tsx
docs(phase4): update architecture plan
style(css): adjust dashboard card spacing
```

---

## 🧪 验证规则

每次提交前**必须**通过：
1. `npm run tauri dev` — 能正常启动
2. 手动测试：启动服务 → 打开网关 → 聊天正常
3. 如果改了安装流程：删除 `AppData/Local/OpenClawLauncher/` 后全新安装测试

---

## ⚠️ AI 特别注意

1. **不要一次性改太多文件**。每个 PR/commit 聚焦一个模块。
2. **先看再改**。改任何文件前先 `view_file_outline` 了解全貌。
3. **渐进式重构**。不要把所有东西推倒重来。提取一个组件 → 验证 → 下一个。
4. **保持接口**。重构过程中，所有 `invoke('xxx')` 调用和返回值类型保持不变。
5. **切分支后清缓存**。`Remove-Item -Recurse -Force node_modules/.vite, dist`

---

## 🔄 标准开发循环 (Dev Cycle)

每一个功能/优化任务，**必须**严格按以下 6 步循环执行：

| 步骤 | 动作 | 产出 |
|---|---|---|
| 1. 讨论 | 与用户对齐需求和方案 | 会话记录 |
| 2. 文档落地 | 创建/更新 Phase 文档 + `TODO.md` 标 `[ ]` | `docs/phases/*.md` + `docs/TODO.md` |
| 3. 提交文档 | `docs: add Phase X.X plan` | Git commit（仅文档） |
| 4. 开发实现 | 编码实现，遵循本文件的红线规范 | 代码改动 |
| 5. 用户验收 | 用户确认 UI/功能符合预期 | 截图/录屏确认 |
| 6. 收尾打勾 | `TODO.md` 标 `[x]` + 功能 commit | Git commit（代码+TODO） |

> **铁律**：先文档，后代码。文档 commit 和代码 commit **必须分开**。
> 每一步都留痕，确保跨 Context 的可追溯性。
