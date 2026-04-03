// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// Phase 9: Binding Modal — guided steps + QR code + real-time progress

import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { QRCodeSVG } from "qrcode.react";
import { Modal } from "./ui/Modal";
import { CheckCircle, AlertTriangle, RefreshCw, Loader, Terminal, Smartphone } from "lucide-react";
import type { BindingProgress } from "../types";

interface BindingModalProps {
    platformId: string;
    platformName: string;
    onClose: () => void;
}

type BindingStage = "guide" | "preparing" | "downloading" | "qr_ready" | "success" | "expired" | "error";

const WECHAT_GUIDE_STEPS = [
    "确保微信已更新至最新版本（v8.0.70+）",
    "打开微信 → 我 → 设置 → 插件",
    "找到「ClawBot」插件 → 点击「连接」",
    "用微信扫描下方二维码",
];

const FEISHU_GUIDE_STEPS = [
    "打开飞书 App",
    "用飞书扫描下方二维码",
    "在手机上确认授权，自动创建机器人",
];

export function BindingModal({ platformId, platformName, onClose }: BindingModalProps) {
    const [stage, setStage] = useState<BindingStage>("guide");
    const [qrUrl, setQrUrl] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [progressMsg, setProgressMsg] = useState("");
    const pollRef = useRef<number | null>(null);
    const closedRef = useRef(false);

    const startBinding = useCallback(async () => {
        setStage("preparing");
        setQrUrl(null);
        setErrorMsg("");
        setProgressMsg("正在准备 CLI 工具...");

        try {
            // Check if gateway is running (required for binding)
            const running = await invoke<boolean>("is_service_running");
            if (!running) {
                if (closedRef.current) return;
                setErrorMsg("请先在仪表盘启动 OpenClaw 服务");
                setStage("error");
                return;
            }

            const url = await invoke<string>("start_channel_binding", { platform: platformId });
            if (closedRef.current) return;
            setQrUrl(url);
            setStage("qr_ready");
            startPolling();
        } catch (err) {
            if (closedRef.current) return;
            const errStr = String(err);

            // Auto-retry on network errors (max 2 retries)
            const isNetworkError = errStr.includes("fetch failed")
                || errStr.includes("ECONNRESET")
                || errStr.includes("ETIMEDOUT")
                || errStr.includes("安装失败");
            const retryCount = (window as unknown as Record<string, number>).__bindingRetries || 0;

            if (isNetworkError && retryCount < 2) {
                (window as unknown as Record<string, number>).__bindingRetries = retryCount + 1;
                setProgressMsg(`网络错误，正在重试 (${retryCount + 1}/2)...`);
                setStage("preparing");
                // Wait 2s then retry
                await new Promise(r => setTimeout(r, 2000));
                if (!closedRef.current) startBinding();
                return;
            }
            (window as unknown as Record<string, number>).__bindingRetries = 0;

            // Friendly message for plugins.allow errors
            if (errStr.includes("plugins.allow") || errStr.includes("plugins")) {
                setErrorMsg("插件权限未生效，请在仪表盘重启 OpenClaw 服务后重试");
            } else if (isNetworkError) {
                setErrorMsg("网络连接失败，请检查网络后重试");
            } else {
                setErrorMsg(errStr);
            }
            setStage("error");
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
                    setStage("success");
                    stopPolling();
                    setTimeout(() => {
                        if (!closedRef.current) onClose();
                    }, 1500);
                } else if (result.status === "expired") {
                    setStage("expired");
                    stopPolling();
                } else if (result.status === "error") {
                    setErrorMsg(result.message || "未知错误");
                    setStage("error");
                    stopPolling();
                }
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

    // Listen for binding-progress events from backend
    useEffect(() => {
        const unlisten = listen<{ platform: string; stage: string; message: string }>(
            "binding-progress",
            (event) => {
                if (event.payload.platform !== platformId || closedRef.current) return;
                setProgressMsg(event.payload.message);

                switch (event.payload.stage) {
                    case "downloading":
                        setStage("downloading");
                        break;
                    case "qr_ready":
                        setStage("qr_ready");
                        break;
                    case "connected":
                        // CLI detected "连接成功" — show success and auto-close
                        setStage("success");
                        stopPolling();
                        setTimeout(() => {
                            if (!closedRef.current) onClose();
                        }, 2000);
                        break;
                    case "plugins_injected":
                        setProgressMsg("已自动配置插件权限");
                        break;
                    case "process_ended":
                        // Process ended, let polling detect success/expired
                        break;
                }
            }
        );

        return () => {
            unlisten.then((fn) => fn());
        };
    }, [platformId]);

    // Auto start binding on mount
    useEffect(() => {
        closedRef.current = false;
        // Don't auto-start, show guide first
        return () => {
            closedRef.current = true;
            stopPolling();
            invoke("cancel_channel_binding", { platform: platformId }).catch(() => { });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleStartBinding = () => {
        startBinding();
    };

    const handleRetry = () => {
        invoke("cancel_channel_binding", { platform: platformId })
            .catch(() => { })
            .then(() => startBinding());
    };

    const handleCopyCommand = () => {
        const cmd =
            platformId === "wechat"
                ? "npx -y @tencent-weixin/openclaw-weixin-cli@latest install"
                : "npx -y @larksuite/openclaw-lark install";
        navigator.clipboard.writeText(cmd).catch(() => { });
        setErrorMsg(`已复制命令：${cmd}`);
    };

    const guideSteps = platformId === "wechat" ? WECHAT_GUIDE_STEPS : FEISHU_GUIDE_STEPS;

    return (
        <Modal show={true} onClose={onClose} title={`绑定${platformName}`} maxWidth={560}>
            <div className="binding-modal-content">
                {/* Step 1: Guide */}
                {stage === "guide" && (
                    <div className="binding-state binding-guide">
                        <div className="binding-guide-header">
                            <Smartphone size={24} />
                            <h4>操作引导</h4>
                        </div>
                        <ol className="binding-guide-steps">
                            {guideSteps.map((step, i) => (
                                <li key={i}>
                                    <span className="step-number">{i + 1}</span>
                                    <span className="step-text">{step}</span>
                                </li>
                            ))}
                        </ol>
                        <button className="btn-primary binding-start-btn" onClick={handleStartBinding}>
                            开始绑定
                        </button>
                    </div>
                )}

                {/* Step 2: Preparing / Downloading */}
                {(stage === "preparing" || stage === "downloading") && (
                    <div className="binding-state binding-loading">
                        <Loader size={32} className="spin-animation" />
                        <p>{progressMsg || "正在准备..."}</p>
                        {stage === "downloading" && (
                            <span className="binding-hint">首次使用需要下载 CLI 工具，请耐心等待</span>
                        )}
                    </div>
                )}

                {/* Step 3: QR Ready */}
                {stage === "qr_ready" && qrUrl && (
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
                                <h4>扫码绑定</h4>
                                <ol>
                                    {guideSteps.slice(-2).map((step, i) => (
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
                {stage === "success" && (
                    <div className="binding-state binding-success">
                        <CheckCircle size={48} strokeWidth={1.5} />
                        <p>{platformName} 绑定成功！</p>
                    </div>
                )}

                {/* Expired */}
                {stage === "expired" && (
                    <div className="binding-state binding-expired">
                        <AlertTriangle size={32} strokeWidth={1.5} />
                        <p>二维码已过期</p>
                        <button className="btn-primary" onClick={handleRetry}>
                            <RefreshCw size={14} /> 重新生成
                        </button>
                    </div>
                )}

                {/* Error */}
                {stage === "error" && (
                    <div className="binding-state binding-error">
                        <AlertTriangle size={32} strokeWidth={1.5} />
                        <p className="binding-error-msg">{errorMsg}</p>
                        <div className="binding-error-actions">
                            <button className="btn-primary" onClick={handleRetry}>
                                <RefreshCw size={14} /> 重试
                            </button>
                            <button className="btn-secondary" onClick={handleCopyCommand}>
                                <Terminal size={14} /> 复制终端命令
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
