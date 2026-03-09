// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/**
 * Header Component
 *
 * Top navigation bar with logo, version, and service status indicator.
 * Uses -webkit-app-region: drag for Tauri window dragging.
 */

interface HeaderProps {
    running: boolean;
    phase: string;
    statusClass: string;
}

export function Header({ running, phase, statusClass }: HeaderProps) {
    return (
        <header className="header">
            <div className="header-left">
                <span className="header-logo">OpenClaw Launcher</span>
                <span className="header-version">v0.4.0</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {phase === "ready" && (
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {running ? "运行中" : "已停止"}
                    </span>
                )}
                <span className={`status-dot ${statusClass}`} />
            </div>
        </header>
    );
}
