// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/**
 * AnalyticsTab Component
 *
 * Placeholder page for Phase 10 — "数据统计".
 * Shows a coming-soon state with consistent styling.
 */

import { BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import "../styles/analytics.css";

export function AnalyticsTab() {
    return (
        <motion.div
            key="analytics"
            className="analytics-page"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
        >
            <div className="analytics-placeholder">
                <div className="analytics-icon">
                    <BarChart3 size={48} strokeWidth={1} />
                </div>
                <h2 className="analytics-title">数据统计</h2>
                <p className="analytics-desc">
                    请求量趋势、Token 用量分析、模型分布等数据看板
                    <br />
                    将在后续版本中推出
                </p>
                <div className="analytics-badge">敬请期待</div>
            </div>
        </motion.div>
    );
}
