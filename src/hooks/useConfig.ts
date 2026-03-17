// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/**
 * useConfig Hook
 *
 * Manages provider/model configuration state and API key operations.
 * All Tauri command calls match the actual backend API exactly.
 */

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ProviderInfo, CurrentConfig } from "../types";

interface UseConfigOptions {
    addLog: (level: string, message: string) => void;
    running: boolean;
    setRunning: (r: boolean) => void;
    setStartingUp?: (v: boolean) => void;
}

export function useConfig({ addLog, running, setRunning, setStartingUp }: UseConfigOptions) {
    const [providers, setProviders] = useState<ProviderInfo[]>([]);
    const [selectedCategory, setSelectedCategory] = useState("free");
    const [selectedProvider, setSelectedProvider] = useState("");
    const [apiKeyInput, setApiKeyInput] = useState("");
    const [baseUrlInput, setBaseUrlInput] = useState("");
    const [selectedModel, setSelectedModel] = useState("");
    const [configSaving, setConfigSaving] = useState(false);
    const [configStatus, setConfigStatus] = useState("");
    const [currentConfig, setCurrentConfig] = useState<CurrentConfig | null>(null);

    // Modal state
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [showModelSwitchModal, setShowModelSwitchModal] = useState(false);
    const [infoModalTitle, setInfoModalTitle] = useState("");
    const [configVersion, setConfigVersion] = useState(0);

    const filteredProviders = providers.filter((p) => p.category === selectedCategory);

    // Load providers on mount
    useEffect(() => {
        invoke<ProviderInfo[]>("get_providers").then(setProviders).catch(() => { });
    }, []);

    const checkApiKey = useCallback(async () => {
        try {
            await invoke("migrate_gateway_config").catch(() => { });
            const config = await invoke<CurrentConfig>("get_current_config");
            setCurrentConfig(config);
            if (!config.has_api_key) {
                setShowKeyModal(true);
            }
        } catch {
            setShowKeyModal(true);
        }
    }, []);

    const handleSaveConfig = useCallback(async () => {
        if (!apiKeyInput.trim()) { setConfigStatus("[!] 请输入 API Key"); return; }
        setConfigSaving(true);
        setConfigStatus("");
        try {
            const result = await invoke<string>("save_api_config", {
                provider: selectedProvider || "custom",
                apiKey: apiKeyInput,
                baseUrl: baseUrlInput || null,
                model: selectedModel || null,
            });
            setConfigStatus(result);
            addLog("success", result);
            // Use full provider/model format for consistent matching
            const fullModelId = selectedModel
                ? `${selectedProvider || "custom"}/${selectedModel}`
                : null;
            setCurrentConfig({ has_api_key: true, provider: selectedProvider, model: fullModelId, base_url: baseUrlInput || null });
            setShowKeyModal(false);
            setConfigVersion(v => v + 1);

            // Auto-restart service if running, so new config takes effect
            if (running) {
                addLog("info", "正在重启服务以加载新配置...");
                try {
                    await invoke("stop_service");
                    setRunning(false);
                    await new Promise(r => setTimeout(r, 1000));
                    await invoke("start_service");
                    setRunning(true);
                    addLog("success", "[OK] 服务已重启，新配置生效");
                } catch (err) {
                    addLog("error", `重启服务失败: ${err}`);
                }
            }
        } catch (err) {
            setConfigStatus(`[!] 保存失败: ${err}`);
        } finally {
            setConfigSaving(false);
        }
    }, [apiKeyInput, selectedProvider, baseUrlInput, selectedModel, addLog, running, setRunning]);

    const handleSetModel = useCallback(async (modelId: string) => {
        try {
            const result = await invoke<string>("set_default_model", { modelId });
            setSelectedModel(modelId);
            setConfigStatus(result);
            addLog("success", result);
            // Extract provider from "provider/model" format
            const parts = modelId.split("/");
            const newProvider = parts.length > 1 ? parts[0] : undefined;
            setCurrentConfig(prev => prev ? {
                ...prev,
                model: modelId,
                provider: newProvider ?? prev.provider,
            } : prev);
            // Trigger all consumers to reload (ModelsTab, etc.)
            setConfigVersion(v => v + 1);
            // Auto-restart service if running so new model takes effect
            if (running) {
                setStartingUp?.(true);
                addLog("info", "正在重启服务以加载新模型...");
                try {
                    await invoke("stop_service");
                    setRunning(false);
                    await new Promise(r => setTimeout(r, 1000));
                    await invoke("start_service");
                    setRunning(true);
                    // Don't clear startingUp here — useService event listener
                    // clears it when service emits "started on" / "ready on"
                    addLog("success", "[OK] 服务已重启，新模型配置生效");
                } catch (restartErr) {
                    addLog("error", `重启服务失败: ${restartErr}`);
                    setStartingUp?.(false);
                }
            }
        } catch (err) {
            setConfigStatus(`[!] 切换失败: ${err}`);
        }
    }, [addLog]);

    const handleOpenRegister = useCallback(async (providerId: string) => {
        try { await invoke("open_provider_register", { providerId }); } catch { /* */ }
    }, []);

    const handleFactoryReset = useCallback(() => {
        setShowResetModal(true);
    }, []);

    const confirmFactoryReset = useCallback(async () => {
        setShowResetModal(false);
        try {
            // Frontend should stop service first if running
            if (running) {
                try {
                    await invoke("stop_service");
                    setRunning(false);
                } catch { /* service might not be running */ }
                await new Promise(r => setTimeout(r, 1500));
            }
            addLog("info", "正在执行一键重置...");
            const result = await invoke<string>("factory_reset");
            addLog("success", result);
            // Reload to return to fresh install flow
            setTimeout(() => window.location.reload(), 1000);
        } catch (err) {
            addLog("error", `一键重置失败: ${err}`);
        }
    }, [addLog, running, setRunning]);

    /** Reset modal form state — call before opening ApiKeyModal */
    const resetModalState = useCallback(() => {
        setSelectedCategory("free");
        setSelectedProvider("");
        setApiKeyInput("");
        setBaseUrlInput("");
        setSelectedModel("");
        setConfigStatus("");
    }, []);

    return {
        providers,
        selectedCategory, setSelectedCategory,
        selectedProvider, setSelectedProvider,
        apiKeyInput, setApiKeyInput,
        baseUrlInput, setBaseUrlInput,
        selectedModel, setSelectedModel,
        configSaving, configStatus, setConfigStatus,
        currentConfig, setCurrentConfig,
        filteredProviders,
        // Modals
        showKeyModal, setShowKeyModal,
        showResetModal, setShowResetModal,
        showModelSwitchModal, setShowModelSwitchModal,
        infoModalTitle, setInfoModalTitle,
        // Actions
        checkApiKey,
        handleSaveConfig,
        handleSetModel,
        handleOpenRegister,
        handleFactoryReset,
        confirmFactoryReset,
        configVersion,
        resetModalState,
    };
}
