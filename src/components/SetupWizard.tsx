/**
 * SetupWizard Component
 *
 * Renders the startup/initialization screen and the workspace selection wizard.
 * Shown during "checking", "initializing", and "workspace" phases.
 */

import { motion } from "framer-motion";
import type { AppPhase } from "../types";

interface SetupWizardProps {
    phase: AppPhase;
    progress: number;
    progressMsg: string;
    workspacePath: string;
    loading: boolean;
    onSelectFolder: () => void;
    onConfirmWorkspace: () => void;
}

export function SetupWizard({
    phase,
    progress,
    progressMsg,
    workspacePath,
    loading,
    onSelectFolder,
    onConfirmWorkspace,
}: SetupWizardProps) {
    // Init Screen (Checking / Initializing)
    if (phase === "checking" || phase === "initializing") {
        return (
            <div className="startup-container">
                <motion.div
                    className="startup-box"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="startup-logo">OpenClaw Launcher</div>
                    <div className="startup-progress-bar">
                        <motion.div
                            className="startup-progress-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ ease: "easeOut", duration: 0.3 }}
                        />
                    </div>
                    <div className="startup-text">{progressMsg}</div>
                </motion.div>
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
                >
                    <div className="startup-logo">📂 选择工作区目录</div>
                    <p className="modal-desc" style={{ marginBottom: 20, textAlign: 'center' }}>
                        AI 会在这个文件夹里帮你写代码。你可以选择任意文件夹，或使用默认目录。
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <code className="workspace-path">
                            {workspacePath || "~/Documents/OpenClaw-Projects (默认)"}
                        </code>
                        <button className="btn-quick" onClick={onSelectFolder}>📁 浏览...</button>
                    </div>
                    <button className="btn-primary btn-hero start" onClick={onConfirmWorkspace} disabled={loading} style={{ marginTop: 16 }}>
                        ✅ 确认并继续
                    </button>
                </motion.div>
            </div>
        );
    }

    return null;
}
