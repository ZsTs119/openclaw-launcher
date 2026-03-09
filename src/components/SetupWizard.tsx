/**
 * SetupWizard Component
 *
 * Renders the startup/initialization screen and the workspace selection wizard.
 * Shown during "checking", "initializing", and "workspace" phases.
 *
 * Phase 5.4: Aurora floating style — no card, white→gray gradient title,
 * white glow progress bar, error modal.
 */

import { motion } from "framer-motion";
import { FolderOpen, FolderSearch, AlertTriangle } from "lucide-react";
import type { AppPhase } from "../types";
import { Modal } from "./ui/Modal";

interface SetupWizardProps {
    phase: AppPhase;
    progress: number;
    progressMsg: string;
    workspacePath: string;
    loading: boolean;
    appVersion: string;
    setupError: string | null;
    onDismissError: () => void;
    onRetry: () => void;
    onSelectFolder: () => void;
    onConfirmWorkspace: () => void;
}

export function SetupWizard({
    phase,
    progress,
    progressMsg,
    workspacePath,
    loading,
    appVersion,
    setupError,
    onDismissError,
    onRetry,
    onSelectFolder,
    onConfirmWorkspace,
}: SetupWizardProps) {
    // Init Screen (Checking / Initializing) — Aurora Floating Style
    if (phase === "checking" || phase === "initializing") {
        return (
            <div className="startup-container">
                <motion.div
                    className="startup-box"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    <div className="startup-logo">OpenClaw Launcher</div>
                    <div className="startup-version">v{appVersion}</div>
                    <div className="startup-progress-bar">
                        <motion.div
                            className="startup-progress-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ ease: "easeOut", duration: 0.3 }}
                        />
                    </div>
                    <div className="startup-text">{progressMsg}</div>
                    {progress > 0 && (
                        <div className="startup-percent">{progress}%</div>
                    )}
                </motion.div>

                {/* Error Modal */}
                <Modal
                    show={!!setupError}
                    onClose={onDismissError}
                    title="初始化失败"
                    maxWidth={420}
                >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 16, marginBottom: 20, padding: 16, background: 'rgba(239, 68, 68, 0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                        <AlertTriangle size={18} strokeWidth={1.5} style={{ color: 'var(--accent-red)', flexShrink: 0, marginTop: 2 }} />
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, wordBreak: 'break-word' }}>
                            {setupError}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn-secondary" style={{ flex: 1 }} onClick={onDismissError}>关闭</button>
                        <button className="btn-primary btn-hero" style={{ flex: 1 }} onClick={onRetry}>重试</button>
                    </div>
                </Modal>
            </div>
        );
    }

    // Workspace Wizard
    if (phase === "workspace") {
        return (
            <div className="startup-container">
                <motion.div
                    className="startup-box"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                >
                    <div className="startup-logo">
                        <FolderOpen size={24} strokeWidth={1.5} style={{ verticalAlign: 'middle', marginRight: 10 }} />
                        选择工作区目录
                    </div>
                    <p className="modal-desc" style={{ marginBottom: 20, textAlign: 'center' }}>
                        AI 会在这个文件夹里帮你写代码。你可以选择任意文件夹，或使用默认目录。
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <code className="workspace-path">
                            {workspacePath || "~/Documents/OpenClaw-Projects (默认)"}
                        </code>
                        <button className="btn-quick" onClick={onSelectFolder}>
                            <FolderSearch size={14} strokeWidth={1.5} style={{ verticalAlign: 'middle', marginRight: 4 }} />浏览...
                        </button>
                    </div>
                    <button className="btn-primary btn-hero start" onClick={onConfirmWorkspace} disabled={loading} style={{ marginTop: 16 }}>
                        确认并继续
                    </button>
                </motion.div>
            </div>
        );
    }

    return null;
}
