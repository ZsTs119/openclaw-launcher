/**
 * Header Component
 *
 * Top navigation bar with logo, version, and service status indicator.
 * Uses -webkit-app-region: drag for Tauri window dragging.
 */

import logo from "../assets/logo.jpg";

interface HeaderProps {
    running: boolean;
    phase: string;
    statusClass: string;
}

export function Header({ running, phase, statusClass }: HeaderProps) {
    return (
        <header className="header">
            <div className="header-left">
                <img src={logo} alt="OpenClaw" className="header-logo-icon" />
                <span className="header-logo">OpenClaw Launcher</span>
                <span className="header-version">v0.3.1</span>
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
