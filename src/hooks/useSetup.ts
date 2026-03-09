/**
 * useSetup Hook
 *
 * Manages the initial setup flow: environment checking, downloading,
 * installing dependencies, workspace selection, and config injection.
 * All setup-related Tauri command calls and event listeners live here.
 */

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { AppPhase } from "../types";

interface UseSetupOptions {
    addLog: (level: string, message: string) => void;
    checkApiKey: () => Promise<void>;
    setRunning: (r: boolean) => void;
}

export function useSetup({ addLog, checkApiKey, setRunning }: UseSetupOptions) {
    const [phase, setPhase] = useState<AppPhase>("checking");
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressMsg, setProgressMsg] = useState("正在检查环境...");
    const [workspacePath, setWorkspacePath] = useState("");
    const [setupError, setSetupError] = useState<string | null>(null);

    const runSetup = useCallback(async () => {
        setLoading(true);
        setSetupError(null);
        try {
            await invoke("setup_openclaw");
            setPhase("ready");
            addLog("success", "OpenClaw 初始化完成！");
            await checkApiKey();
        } catch (err) {
            addLog("error", `初始化失败: ${err}`);
            setSetupError(String(err));
        } finally {
            setLoading(false);
        }
    }, [addLog, checkApiKey]);

    const checkEnvironment = useCallback(async () => {
        try {
            const nodeOk = await invoke<boolean>("check_node_exists");
            const openclawOk = await invoke<boolean>("check_openclaw_exists");
            const modulesOk = await invoke<boolean>("check_node_modules_exists");
            const serviceRunning = await invoke<boolean>("is_service_running");

            if (nodeOk && openclawOk && modulesOk) {
                const configOk = await invoke<boolean>("check_config_exists");
                if (!configOk) {
                    setPhase("workspace");
                    addLog("info", "首次使用，请选择工作区目录");
                } else {
                    setPhase("ready");
                    setRunning(serviceRunning);
                    addLog("success", "[OK] 环境检查通过，所有组件就绪");
                    await checkApiKey();
                }
            } else {
                setPhase("initializing");
                addLog("info", "首次启动，开始初始化环境...");
                await runSetup();
            }
        } catch (err) {
            addLog("error", `环境检查失败: ${err}`);
            setPhase("initializing");
            await runSetup();
        }
    }, [addLog, checkApiKey, runSetup]);

    // On mount: check environment + register setup event listeners
    useEffect(() => {
        checkEnvironment();

        const unlistenProgress = listen<{ stage: string; message: string; percent: number }>(
            "setup-progress",
            (event) => {
                setProgress(event.payload.percent);
                setProgressMsg(event.payload.message);
                addLog("info", event.payload.message);
            }
        );

        const unlistenLogs = listen<{ level: string; message: string }>(
            "service-log",
            (event) => addLog(event.payload.level, event.payload.message)
        );

        return () => {
            unlistenProgress.then((fn) => fn());
            unlistenLogs.then((fn) => fn());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSelectFolder = useCallback(async () => {
        const selected = await open({ directory: true, multiple: false, title: "选择你的工作区目录" });
        if (selected && typeof selected === "string") setWorkspacePath(selected);
    }, []);

    const handleConfirmWorkspace = useCallback(async () => {
        setLoading(true);
        try {
            await invoke("inject_default_config");
            await invoke("inject_default_models");
            addLog("success", `[OK] 工作区已配置: ${workspacePath || "默认目录"}`);
            setPhase("ready");
            await checkApiKey();
        } catch (err) {
            addLog("error", `配置失败: ${err}`);
        } finally {
            setLoading(false);
        }
    }, [addLog, checkApiKey, workspacePath]);

    const handleSwitchWorkspace = useCallback(async () => {
        const selected = await open({ directory: true, multiple: false, title: "切换工作区目录" });
        if (selected && typeof selected === "string") {
            setWorkspacePath(selected);
            setLoading(true);
            try {
                await invoke("inject_default_config");
                addLog("success", `[OK] 工作区已切换到: ${selected}`);
            } catch (err) {
                addLog("error", `切换失败: ${err}`);
            } finally {
                setLoading(false);
            }
        }
    }, [addLog]);

    const clearSetupError = useCallback(() => setSetupError(null), []);

    const retrySetup = useCallback(() => {
        setSetupError(null);
        setProgress(0);
        setProgressMsg("正在重试初始化...");
        runSetup();
    }, [runSetup]);

    return {
        phase, setPhase,
        loading, setLoading,
        progress, setProgress,
        progressMsg, setProgressMsg,
        workspacePath,
        setupError, clearSetupError, retrySetup,
        handleSelectFolder,
        handleConfirmWorkspace,
        handleSwitchWorkspace,
    };
}
