// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// Phase 9: Channel Card — bound/unbound states

import { useState, useEffect } from "react";
import { CheckCircle, Circle, Lock } from "lucide-react";
import type { ChannelStatus } from "../types";

interface ChannelCardProps {
    channel: ChannelStatus;
    icon: string;
    description: string;
    nodeOk: boolean;
    onBind: () => void;
    onUnbind: () => void;
}

export function ChannelCard({ channel, icon, description, nodeOk, onBind, onUnbind }: ChannelCardProps) {
    const [unbindCountdown, setUnbindCountdown] = useState(0);
    const [confirming, setConfirming] = useState(false);

    useEffect(() => {
        if (unbindCountdown > 0) {
            const timer = setTimeout(() => setUnbindCountdown(c => c - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [unbindCountdown]);

    const handleUnbindClick = () => {
        if (!confirming) {
            setConfirming(true);
            setUnbindCountdown(3);
        } else if (unbindCountdown === 0) {
            onUnbind();
            setConfirming(false);
        }
    };

    const cancelUnbind = () => {
        setConfirming(false);
        setUnbindCountdown(0);
    };

    // Coming Soon card
    if (!channel.available) {
        return (
            <div className="channel-card channel-card-disabled">
                <div className="channel-card-header">
                    <span className="channel-icon">{icon}</span>
                    <span className="channel-name">{channel.name}</span>
                    <span className="channel-badge badge-coming-soon">
                        <Lock size={10} /> 敬请期待
                    </span>
                </div>
                <div className="channel-desc">{description}</div>
            </div>
        );
    }

    // Bound card
    if (channel.bound) {
        return (
            <div className="channel-card channel-card-bound">
                <div className="channel-card-header">
                    <span className="channel-icon">{icon}</span>
                    <span className="channel-name">{channel.name}</span>
                    <span className="channel-badge badge-bound">
                        <CheckCircle size={10} /> 已绑定
                    </span>
                </div>
                <div className="channel-desc">{description}</div>
                <div className="channel-bound-info">
                    {channel.bound_at && (
                        <span className="channel-bound-time">
                            绑定时间：{new Date(channel.bound_at).toLocaleString("zh-CN")}
                        </span>
                    )}
                </div>
                <div className="channel-actions">
                    {confirming ? (
                        <>
                            <button
                                className="btn-danger-sm"
                                disabled={unbindCountdown > 0}
                                onClick={handleUnbindClick}
                            >
                                {unbindCountdown > 0 ? `确认解绑 (${unbindCountdown}s)` : "确认解绑"}
                            </button>
                            <button className="btn-ghost-sm" onClick={cancelUnbind}>取消</button>
                        </>
                    ) : (
                        <button className="btn-ghost-sm btn-unbind" onClick={handleUnbindClick}>
                            解绑
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Unbound card
    return (
        <div className="channel-card channel-card-unbound">
            <div className="channel-card-header">
                <span className="channel-icon">{icon}</span>
                <span className="channel-name">{channel.name}</span>
                <span className="channel-badge badge-unbound">
                    <Circle size={10} /> 未绑定
                </span>
            </div>
            <div className="channel-desc">{description}</div>
            <div className="channel-actions">
                <button
                    className="btn-primary-sm"
                    disabled={!nodeOk}
                    onClick={onBind}
                    title={!nodeOk ? "需要 Node.js 22+" : ""}
                >
                    开始绑定
                </button>
            </div>
        </div>
    );
}
