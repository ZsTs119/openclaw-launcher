// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// Phase 9: Binding Modal — QR code display + step guide

import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { QRCodeSVG } from "qrcode.react";
import { Modal } from "./ui/Modal";
import { CheckCircle, AlertTriangle, RefreshCw, Loader, Terminal } from "lucide-react";
import type { BindingProgress } from "../types";

interface BindingModalProps {
    platformId: string;
    platformName: string;
    onClose: () => void;
}

type BindingState = "loading" | "qr_ready" | "success" | "expired" | "error";

const STEP_GUIDES: Record<string, string[]> = {
    wechat: ["打开微信", "扫描左侧二维码", "在手机上确认绑定"],
    feishu: ["打开飞书", "扫描左侧二维码", "在手机上确认授权"],
};

export function BindingModal({ platformId, platformName, onClose }: BindingModalProps) {
    const [state, setState] = useState<BindingState>("loading");
    const [qrUrl, setQrUrl] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState("");
    const pollRef = useRef<number | null>(null);
    const closedRef = useRef(false);

    const startBinding = useCallback(async () => {
        setState("loading");
        setQrUrl(null);
        setErrorMsg("");

        try {
            const url = await invoke<string>("start_channel_binding", { platform: platformId });
            if (closedRef.current) return;
            setQrUrl(url);
            setState("qr_ready");
            // Start polling
            startPolling();
        } catch (err) {
            if (closedRef.current) return;
            setErrorMsg(String(err));
            setState("error");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [platformId]);

    const startPolling = useCallback(() => {
        stopPolling();
        const interval = window.setInterval(async () => {
            try {
                const result = await invoke<BindingProgress>("poll_binding_result", { platform: platformId });
                if (closedRef.current) return;

                if (result.status === "success") {
                    setState("success");
                    stopPolling();
                    // Auto-close after 1.5s
                    setTimeout(() => {
                        if (!closedRef.current) onClose();
                    }, 1500);
                } else if (result.status === "expired") {
                    setState("expired");
                    stopPolling();
                } else if (result.status === "error") {
                    setErrorMsg(result.message || "未知错误");
                    setState("error");
                    stopPolling();
                }
                // "pending" → keep polling
            } catch (err) {
                console.error("Poll error:", err);
            }
        }, 2000);
        pollRef.current = interval;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [platformId, onClose]);

    const stopPolling = useCallback(() => {
        if (pollRef.current !== null) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    // Start binding on mount
    useEffect(() => {
        closedRef.current = false;
        startBinding();
        return () => {
            closedRef.current = true;
            stopPolling();
            // Cancel binding process on unmount
            invoke("cancel_channel_binding", { platform: platformId }).catch(() => { });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRetry = () => {
        // Cancel current then restart
        invoke("cancel_channel_binding", { platform: platformId })
            .catch(() => { })
            .then(() => startBinding());
    };

    const handleOpenTerminal = () => {
        // Fallback: tell user to run manually
        setErrorMsg(
            platformId === "wechat"
                ? "请在终端执行：npx -y @tencent-weixin/openclaw-weixin-cli@latest install"
                : "请在终端执行：npx -y @larksuite/openclaw-lark install"
        );
    };

    const steps = STEP_GUIDES[platformId] || ["打开对应 App", "扫描二维码", "确认绑定"];

    return (
        <Modal show={true} onClose={onClose} title={`绑定${platformName}`} maxWidth={520}>
            <div className="binding-modal-content">
                {/* Loading */}
                {state === "loading" && (
                    <div className="binding-state binding-loading">
                        <Loader size={32} className="spin-animation" />
                        <p>正在生成二维码...</p>
                        <span className="binding-hint">首次使用需要下载 CLI 工具，请耐心等待</span>
                    </div>
                )}

                {/* QR Ready */}
                {state === "qr_ready" && qrUrl && (
                    <div className="binding-state binding-qr">
                        <div className="binding-qr-layout">
                            <div className="binding-qr-code">
                                <QRCodeSVG
                                    value={qrUrl}
                                    size={200}
                                    bgColor="transparent"
                                    fgColor="#ffffff"
                                    level="M"
                                />
                            </div>
                            <div className="binding-steps">
                                <h4>操作步骤</h4>
                                <ol>
                                    {steps.map((step, i) => (
                                        <li key={i}>{step}</li>
                                    ))}
                                </ol>
                            </div>
                        </div>
                        <div className="binding-waiting">
                            <Loader size={14} className="spin-animation" />
                            <span>等待扫码...</span>
                        </div>
                    </div>
                )}

                {/* Success */}
                {state === "success" && (
                    <div className="binding-state binding-success">
                        <CheckCircle size={48} strokeWidth={1.5} />
                        <p>{platformName} 绑定成功！</p>
                    </div>
                )}

                {/* Expired */}
                {state === "expired" && (
                    <div className="binding-state binding-expired">
                        <AlertTriangle size={32} strokeWidth={1.5} />
                        <p>二维码已过期</p>
                        <button className="btn-primary" onClick={handleRetry}>
                            <RefreshCw size={14} /> 重新生成
                        </button>
                    </div>
                )}

                {/* Error */}
                {state === "error" && (
                    <div className="binding-state binding-error">
                        <AlertTriangle size={32} strokeWidth={1.5} />
                        <p className="binding-error-msg">{errorMsg}</p>
                        <div className="binding-error-actions">
                            <button className="btn-primary" onClick={handleRetry}>
                                <RefreshCw size={14} /> 重试
                            </button>
                            <button className="btn-secondary" onClick={handleOpenTerminal}>
                                <Terminal size={14} /> 终端命令
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
