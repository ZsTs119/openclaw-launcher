# 安全策略 | Security Policy

## 支持的版本

| 版本 | 支持状态 |
|---|---|
| 0.2.x | ✅ 当前版本，积极维护 |
| 0.1.x | ⚠️ 仅关键安全修复 |
| < 0.1 | ❌ 不再支持 |

## 报告安全漏洞

如果你发现了安全漏洞，**请不要**通过公开 Issue 报告。

请通过以下方式私密报告：

1. **GitHub Security Advisory**: 前往 [Security Advisories](https://github.com/ZsTs119/openclaw-launcher/security/advisories/new) 创建私密报告
2. **邮件**: 发送至 `security@openclaw-launcher.dev` (如有)

### 报告内容

请包含以下信息：
- 漏洞类型和影响范围
- 重现步骤
- 受影响的版本
- 可能的修复建议 (如有)

### 响应时间

- **确认收到**: 48 小时内
- **初步评估**: 7 天内
- **修复发布**: 取决于严重程度 (关键漏洞 72 小时内)

## 安全设计

OpenClaw Launcher 的安全架构：

- **沙盒隔离**: Node.js 运行在独立沙盒中，不污染系统环境
- **本地运行**: 所有数据和服务运行在用户本地，不上传到云端
- **无 API Key 明文存储**: 配置文件中的 API Key 建议使用环境变量
- **自动更新源验证**: 下载源码时验证来源为 GitHub 官方仓库
