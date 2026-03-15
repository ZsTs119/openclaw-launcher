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
}

export function useConfig({ addLog, running, setRunning }: UseConfigOptions) {
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
    const [showReinstallModal, setShowReinstallModal] = useState(false);
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
            setCurrentConfig({ has_api_key: true, provider: selectedProvider, model: selectedModel, base_url: baseUrlInput || null });
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
            setCurrentConfig(prev => prev ? { ...prev, model: modelId } : prev);
        } catch (err) {
            setConfigStatus(`[!] 切换失败: ${err}`);
        }
    }, [addLog]);

    const handleOpenRegister = useCallback(async (providerId: string) => {
        try { await invoke("open_provider_register", { providerId }); } catch { /* */ }
    }, []);

    const handleReset = useCallback(() => {
        setShowResetModal(true);
    }, []);

    const confirmReset = useCallback(async () => {
        setShowResetModal(false);
        try {
            const result = await invoke<string>("reset_config");
            setCurrentConfig({ has_api_key: false, provider: null, model: null, base_url: null });
            setApiKeyInput("");
            setSelectedProvider("");
            setSelectedModel("");
            setBaseUrlInput("");
            setConfigStatus("");
            addLog("success", result);
            setShowKeyModal(true);
        } catch (err) {
            addLog("error", `重置失败: ${err}`);
        }
    }, [addLog]);

    const handleReinstall = useCallback(() => {
        setShowReinstallModal(true);
    }, []);

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
        showReinstallModal, setShowReinstallModal,
        showModelSwitchModal, setShowModelSwitchModal,
        infoModalTitle, setInfoModalTitle,
        // Actions
        checkApiKey,
        handleSaveConfig,
        handleSetModel,
        handleOpenRegister,
        handleReset,
        confirmReset,
        handleReinstall,
        configVersion,
        resetModalState,
    };
}
