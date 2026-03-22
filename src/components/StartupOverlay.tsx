// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/**
 * StartupOverlay Component
 *
 * Full-screen loading overlay shown while the OpenClaw service is starting up.
 * Displays logo + spinning animation + status text.
 * Dismissed when the service emits a "ready" signal (browser opens).
 * Click anywhere to dismiss manually. Auto-dismisses after 30s timeout.
 */

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import logo from "../assets/logo.jpg";

interface StartupOverlayProps {
    show: boolean;
    onDismiss?: () => void;
}

export function StartupOverlay({ show, onDismiss }: StartupOverlayProps) {
    // Auto-dismiss after 30s to prevent permanent stuck state
    useEffect(() => {
        if (!show || !onDismiss) return;
        const timer = setTimeout(() => onDismiss(), 30000);
        return () => clearTimeout(timer);
    }, [show, onDismiss]);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className="startup-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    onClick={onDismiss}
                    style={{ cursor: onDismiss ? "pointer" : "default" }}
                >
                    <div className="startup-overlay-content">
                        <img src={logo} alt="OpenClaw" className="startup-overlay-logo" />
                        <Loader2 className="startup-overlay-spinner" size={28} strokeWidth={1.5} />
                        <div className="startup-overlay-text">正在启动 OpenClaw 服务...</div>
                        <div className="startup-overlay-hint">服务就绪后将自动打开浏览器</div>
                        {onDismiss && (
                            <div className="startup-overlay-hint" style={{ marginTop: 12, opacity: 0.4, fontSize: 11 }}>
                                点击任意位置关闭此弹窗
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
