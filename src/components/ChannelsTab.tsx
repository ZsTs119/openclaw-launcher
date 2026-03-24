// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// Phase 9: Channels Tab — Platform Integration

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Link, Download, Loader, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import type { ChannelStatus } from "../types";
import { ChannelCard } from "./ChannelCard";
import { BindingModal } from "./BindingModal";
import "../styles/channels.css";

// Platform icons (emoji fallback)
const PLATFORM_ICONS: Record<string, string> = {
    wechat: "💬",
    feishu: "🐦",
    telegram: "✈️",
    discord: "🎮",
    qq: "🐧",
};

const PLATFORM_DESCRIPTIONS: Record<string, string> = {
    wechat: "通过微信 ClawBot 插件，在微信中直接使用 AI 助手",
    feishu: "通过飞书官方插件，在飞书中直接使用 AI 助手",
    telegram: "通过 Telegram Bot 远程控制 AI 助手",
    discord: "通过 Discord Bot 在服务器中使用 AI 助手",
    qq: "通过 NapCat 插件在 QQ 中使用 AI 助手",
};

type UpgradeState = "idle" | "upgrading" | "done" | "error";

export function ChannelsTab() {
    const [channels, setChannels] = useState<ChannelStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [nodeOk, setNodeOk] = useState(true);
    const [nodeError, setNodeError] = useState("");
    const [bindingPlatform, setBindingPlatform] = useState<string | null>(null);

    // Upgrade state
    const [upgradeState, setUpgradeState] = useState<UpgradeState>("idle");
    const [upgradeMsg, setUpgradeMsg] = useState("");

    const loadChannels = useCallback(async () => {
        setLoading(true);
        try {
            const status = await invoke<ChannelStatus[]>("get_channel_status");
            setChannels(status);
        } catch (err) {
            console.error("Failed to load channels:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    const checkNode = useCallback(async () => {
        try {
            await invoke<string>("check_node_version");
            setNodeOk(true);
            setNodeError("");
        } catch (err) {
            setNodeOk(false);
            setNodeError(String(err));
        }
    }, []);

    // Check Node.js on mount
    useEffect(() => {
        checkNode();
        loadChannels();
    }, [checkNode, loadChannels]);

    // Listen for upgrade progress events
    useEffect(() => {
        const unlisten = listen<{ stage: string; message: string; percent: number }>("setup-progress", (event) => {
            if (upgradeState === "upgrading") {
                setUpgradeMsg(event.payload.message);
            }
        });
        return () => { unlisten.then(fn => fn()); };
    }, [upgradeState]);

    const handleUpgradeNode = async () => {
        setUpgradeState("upgrading");
        setUpgradeMsg("正在准备升级...");
        try {
            await invoke<string>("upgrade_node");
            setUpgradeState("done");
            setUpgradeMsg("Node.js 22 升级完成！建议重启 OpenClaw 服务");
            // Re-check version
            await checkNode();
        } catch (err) {
            setUpgradeState("error");
            setUpgradeMsg(String(err));
        }
    };

    const handleStartBinding = (platformId: string) => {
        setBindingPlatform(platformId);
    };

    const handleBindingClose = () => {
        setBindingPlatform(null);
        loadChannels();
    };

    const handleUnbind = async (platformId: string) => {
        try {
            await invoke("unbind_channel", { platform: platformId });
            await loadChannels();
        } catch (err) {
            console.error("Unbind failed:", err);
        }
    };

    return (
        <motion.div
            className="tab-panel channels-tab"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
        >
            <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Link size={20} strokeWidth={1.5} />
                平台接入
            </h2>

            {/* Node.js version warning + upgrade */}
            {!nodeOk && (
                <div className="channel-node-warning">
                    <div className="node-warning-content">
                        <span>⚠️ {nodeError || "Node.js 22+ 未安装，绑定功能不可用"}</span>
                        {upgradeState === "idle" && (
                            <button className="btn-upgrade" onClick={handleUpgradeNode}>
                                <Download size={13} /> 一键升级
                            </button>
                        )}
                        {upgradeState === "upgrading" && (
                            <span className="upgrade-progress">
                                <Loader size={13} className="spin-animation" /> {upgradeMsg}
                            </span>
                        )}
                        {upgradeState === "error" && (
                            <button className="btn-upgrade" onClick={handleUpgradeNode}>
                                <RefreshCw size={13} /> 重试升级
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Upgrade success hint (show even when nodeOk becomes true) */}
            {upgradeState === "done" && nodeOk && (
                <div className="channel-node-success">
                    ✅ {upgradeMsg}
                </div>
            )}

            {loading ? (
                <div className="channels-loading">加载中...</div>
            ) : (
                <div className="channels-grid">
                    {channels.map((ch) => (
                        <ChannelCard
                            key={ch.id}
                            channel={ch}
                            icon={PLATFORM_ICONS[ch.id] || "🔗"}
                            description={PLATFORM_DESCRIPTIONS[ch.id] || ""}
                            nodeOk={nodeOk}
                            onBind={() => handleStartBinding(ch.id)}
                            onUnbind={() => handleUnbind(ch.id)}
                        />
                    ))}
                </div>
            )}

            {/* Binding Modal */}
            {bindingPlatform && (
                <BindingModal
                    platformId={bindingPlatform}
                    platformName={channels.find(c => c.id === bindingPlatform)?.name || bindingPlatform}
                    onClose={handleBindingClose}
                />
            )}
        </motion.div>
    );
}

