// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/**
 * Log humanization utilities
 *
 * Translates raw terminal output into user-friendly Chinese messages.
 * Used by LogViewer to show both raw and humanized log entries.
 */

const LOG_TRANSLATIONS: [RegExp, string][] = [
    [/npm warn/i, "[WARN] 依赖警告（可忽略）"],
    [/npm error/i, "[!] 依赖安装出错"],
    [/added \d+ packages/i, "[OK] 依赖包安装完成"],
    [/listening on.*:?(\d+)/i, "[OK] 服务已就绪，端口已打开"],
    [/server (is )?running/i, "[OK] 服务正在运行"],
    [/EADDRINUSE/i, "[!] 端口被占用，请关闭占用程序后重试"],
    [/ECONNREFUSED/i, "[!] 连接被拒绝，检查网络设置"],
    [/ENOTFOUND/i, "[!] 域名解析失败，检查网络连接"],
    [/compiling/i, "正在编译..."],
    [/deprecated/i, "有过时的依赖（不影响使用）"],
    [/ready in/i, "[OK] 启动完成！"],
];

/**
 * Attempt to translate a raw log message into a human-friendly version.
 * Returns undefined if no translation matches.
 */
export function humanizeLog(msg: string): string | undefined {
    for (const [pattern, translation] of LOG_TRANSLATIONS) {
        if (pattern.test(msg)) return translation;
    }
    return undefined;
}

/**
 * Format seconds into a human-readable uptime string.
 * Examples: "5s", "3m 12s", "1h 5m 30s"
 */
export function formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}
