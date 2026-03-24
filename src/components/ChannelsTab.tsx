// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// Phase 9: Channels Tab — Platform Integration

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Link } from "lucide-react";
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

export function ChannelsTab() {
    const [channels, setChannels] = useState<ChannelStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [nodeOk, setNodeOk] = useState(true);
    const [nodeError, setNodeError] = useState("");
    const [bindingPlatform, setBindingPlatform] = useState<string | null>(null);

    const loadChannels = useCallback(async () => {
        setLoading(true);
        try {
            const [status] = await Promise.all([
                invoke<ChannelStatus[]>("get_channel_status"),
            ]);
            setChannels(status);
        } catch (err) {
            console.error("Failed to load channels:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Check Node.js on mount
    useEffect(() => {
        (async () => {
            try {
                await invoke<string>("check_node_version");
                setNodeOk(true);
            } catch (err) {
                setNodeOk(false);
                setNodeError(String(err));
            }
        })();
        loadChannels();
    }, [loadChannels]);

    const handleStartBinding = (platformId: string) => {
        setBindingPlatform(platformId);
    };

    const handleBindingClose = () => {
        setBindingPlatform(null);
        // Reload channel status after binding attempt
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

            {!nodeOk && (
                <div className="channel-node-warning">
                    ⚠️ {nodeError || "Node.js 22+ 未安装，绑定功能不可用"}
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
