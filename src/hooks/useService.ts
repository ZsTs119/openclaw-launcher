// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/**
 * useService Hook
 *
 * Manages the runtime service lifecycle: start, stop, heartbeat monitoring,
 * port detection, uptime tracking, reinstall, and connection repair.
 * Setup/initialization logic lives in useSetup.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";

import type { AppPhase } from "../types";

interface UseServiceOptions {
    addLog: (level: string, message: string) => void;
    checkApiKey: () => Promise<void>;
    setRepairToast: (show: boolean) => void;
    setShowResetModal: (show: boolean) => void;
    running: boolean;
    setRunning: (r: boolean) => void;
    // From useSetup — needed for reinstall/reset to control phase
    setPhase: (phase: AppPhase) => void;
    setProgress: (p: number) => void;
    setProgressMsg: (m: string) => void;
}

export function useService({
    addLog, checkApiKey, setRepairToast, setShowResetModal,
    running, setRunning,
    setPhase, setProgress, setProgressMsg,
}: UseServiceOptions) {
    const [loading, setLoading] = useState(false);
    const [uptime, setUptime] = useState(0);
    const [servicePort, setServicePort] = useState(18789);
    const [reinstalling, setReinstalling] = useState(false);
    const [repairing, setRepairing] = useState(false);
    const [startingUp, setStartingUp] = useState(false);
    const uptimeRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // One-shot callback fired when service becomes truly ready (listening on port)
    const onServiceReadyRef = useRef<((port: number) => void) | null>(null);
    // Keep latest servicePort in a ref for access inside stale closures (listen callback)
    const servicePortRef = useRef(servicePort);

    // Uptime counter
    useEffect(() => {
        if (running) {
            setUptime(0);
            uptimeRef.current = setInterval(() => setUptime((u) => u + 1), 1000);
        } else {
            if (uptimeRef.current) clearInterval(uptimeRef.current);
            setUptime(0);
        }
        return () => { if (uptimeRef.current) clearInterval(uptimeRef.current); };
    }, [running]);

    // Runtime event listeners: heartbeat + port
    useEffect(() => {
        const unlistenHeartbeat = listen("service-heartbeat", async () => {
            try {
                const alive = await invoke<boolean>("is_service_running");
                if (!alive) {
                    setRunning(false);
                    addLog("error", "OpenClaw 服务进程已意外退出");
                }
            } catch { /* ignore */ }
        });

        const unlistenPort = listen<{ port: number }>(
            "service-port",
            (event) => {
                setServicePort(event.payload.port);
                servicePortRef.current = event.payload.port;
            }
        );

        // Listen for service-ready signal to dismiss startup overlay
        const unlistenLog = listen<{ level: string; message: string }>(
            "service-log",
            (event) => {
                const msg = event.payload.message?.toLowerCase() || "";
                if (
                    msg.includes("listening") ||
                    msg.includes("started on") ||
                    msg.includes("ready on") ||
                    msg.includes("server is running") ||
                    msg.includes("server started") ||
                    msg.includes("正在打开浏览器")
                ) {
                    setStartingUp(false);
                    // Fire one-shot onServiceReady callback (e.g. open agent chat browser)
                    if (onServiceReadyRef.current) {
                        const cb = onServiceReadyRef.current;
                        onServiceReadyRef.current = null;
                        cb(servicePortRef.current);
                    }
                }
            }
        );

        return () => {
            unlistenHeartbeat.then((fn) => fn());
            unlistenPort.then((fn) => fn());
            unlistenLog.then((fn) => fn());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleStart = useCallback(async () => {
        setLoading(true);
        setStartingUp(true);
        try {
            await invoke("start_service");
            setRunning(true);
        } catch (err) {
            addLog("error", `启动失败: ${err}`);
            setStartingUp(false);
        } finally {
            setLoading(false);
        }
    }, [addLog]);

    /**
     * Shared utility: open a URL in browser, handling cold-start automatically.
     * - Hot start (service running): opens immediately
     * - Cold start: shows startup overlay → waits for service ready → opens
     *
     * @param buildUrl - function that receives the service port and returns the full URL
     */
    const openInBrowser = useCallback(async (buildUrl: (port: number) => string) => {
        if (running && servicePort) {
            openUrl(buildUrl(servicePort));
        } else {
            onServiceReadyRef.current = (port: number) => {
                openUrl(buildUrl(port));
            };
            await handleStart();
        }
    }, [running, servicePort, handleStart]);

    const handleStop = useCallback(async () => {
        setLoading(true);
        try {
            await invoke("stop_service");
            setRunning(false);
        } catch (err) {
            addLog("error", `停止失败: ${err}`);
        } finally {
            setLoading(false);
        }
    }, [addLog]);

    const confirmReinstall = useCallback(async () => {
        setReinstalling(true);
        setPhase("initializing");
        setProgress(0);
        setProgressMsg("正在清理并重新安装...");
        try {
            await invoke("reinstall_environment");
            setPhase("ready");
            addLog("success", "环境重新安装完成！");
            await checkApiKey();
        } catch (err) {
            addLog("error", `重新安装失败: ${err}`);
            setProgressMsg(`[!] 重新安装失败: ${err}`);
        } finally {
            setReinstalling(false);
        }
    }, [addLog, checkApiKey, setPhase, setProgress, setProgressMsg]);

    const handleRepairConnection = useCallback(async () => {
        setRepairing(true);
        setRepairToast(false);
        addLog("info", "🔧 开始一键修复连接...");
        try {
            if (running) {
                addLog("info", "正在停止服务...");
                await invoke("stop_service");
                setRunning(false);
                await new Promise(r => setTimeout(r, 1500));
            }
            addLog("info", "正在重新启动服务...");
            await invoke("start_service");
            setRunning(true);
            addLog("success", "[OK] 连接修复完成，服务已重启");
        } catch (err) {
            addLog("error", `修复失败: ${err}`);
        } finally {
            setRepairing(false);
        }
    }, [addLog, running, servicePort, setRepairToast]);

    const confirmFactoryReset = useCallback(async () => {
        setShowResetModal(false);
        setReinstalling(true);
        // 1. Stop service if running
        if (running) {
            try {
                addLog("info", "正在停止服务...");
                await invoke("stop_service");
                setRunning(false);
            } catch { /* service might not be running */ }
            await new Promise(r => setTimeout(r, 1000));
        }
        // 2. Switch to install UI immediately
        setPhase("initializing");
        setProgress(0);
        setProgressMsg("正在执行一键重置...");
        // 3. Call backend: npm uninstall + delete data + setup_openclaw
        try {
            await invoke("factory_reset");
            setPhase("ready");
            addLog("success", "一键重置完成，环境已重新安装！");
            await checkApiKey();
        } catch (err) {
            addLog("error", `一键重置失败: ${err}`);
            setProgressMsg(`[!] 一键重置失败: ${err}`);
        } finally {
            setReinstalling(false);
        }
    }, [addLog, checkApiKey, running, setRunning, setShowResetModal, setPhase, setProgress, setProgressMsg]);

    return {
        loading, startingUp, setStartingUp,
        uptime, servicePort,
        reinstalling, repairing,
        handleStart,
        handleStop,
        confirmReinstall,
        confirmFactoryReset,
        handleRepairConnection,
        openInBrowser,
    };
}
