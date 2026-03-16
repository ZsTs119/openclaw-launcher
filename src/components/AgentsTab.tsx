// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/**
 * AgentsTab Component
 *
 * Placeholder page for Phase 8.2 — "智能体管理".
 * Shows a coming-soon state with consistent styling.
 */

import { Bot } from "lucide-react";
import { motion } from "framer-motion";
import "../styles/agents.css";

export function AgentsTab() {
    return (
        <motion.div
            key="agents"
            className="agents-page"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
        >
            <div className="analytics-placeholder">
                <div className="analytics-icon">
                    <Bot size={48} strokeWidth={1} />
                </div>
                <h2 className="analytics-title">智能体</h2>
                <p className="analytics-desc">
                    多 Agent 编排、模型选择、权限管理、会话历史
                    <br />
                    将在后续版本中推出
                </p>
                <div className="analytics-badge">敬请期待</div>
            </div>
        </motion.div>
    );
}
