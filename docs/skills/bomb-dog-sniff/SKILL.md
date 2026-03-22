---
name: bomb-dog-sniff
description: >
  像炸弹嗅探犬一样检测技能中的恶意代码。
  在安装任何第三方技能之前，使用此技能扫描恶意行为。
  安装：openclaw skill install LvcidPsyche/skill-bomb-dog-sniff
---

# Bomb Dog Sniff — 恶意代码检测

在安装第三方 skill 之前，使用此技能检测潜在的恶意代码。

## 使用方法

```bash
openclaw skill install LvcidPsyche/skill-bomb-dog-sniff
```

安装后，AI Agent 会在执行可疑操作前自动进行安全检查。

## 检测范围

- 文件系统写入操作
- 网络请求目标
- 环境变量读取
- 子进程执行
- 敏感路径访问

## 来源

https://github.com/LvcidPsyche/skill-bomb-dog-sniff
