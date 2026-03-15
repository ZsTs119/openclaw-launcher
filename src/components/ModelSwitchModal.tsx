// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/**
 * ModelSwitchModal — Dashboard model switch dialog
 *
 * Uses SAVED providers from backend (not built-in catalog) to ensure
 * complete sync with AI Engine provider cards.
 */

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Modal, ModalFooter } from "./ui/Modal";
import type { CurrentConfig, SavedProvider } from "../types";
import { ModelSelectWithCustom } from "./ModelSelectWithCustom";

interface ModelSwitchModalProps {
    show: boolean;
    onClose: () => void;
    currentConfig: CurrentConfig | null;
    handleSetModel: (modelId: string) => Promise<void>;
    configVersion: number;
}

export function ModelSwitchModal({
    show, onClose, currentConfig, handleSetModel, configVersion,
}: ModelSwitchModalProps) {
    const [localSelected, setLocalSelected] = useState("");
    const [savedProviders, setSavedProviders] = useState<SavedProvider[]>([]);

    // Load saved providers from backend — same source as AI Engine
    const loadProviders = useCallback(async () => {
        try {
            const list = await invoke<SavedProvider[]>("list_saved_providers");
            setSavedProviders(list);
        } catch { /* */ }
    }, []);

    useEffect(() => { loadProviders(); }, [loadProviders, configVersion]);

    // Derive current active model id (bare, without provider prefix)
    const currentModelId = currentConfig?.model?.includes("/")
        ? currentConfig.model.split("/").slice(1).join("/")
        : currentConfig?.model || "";

    // Reset local selection when modal opens or config changes
    useEffect(() => {
        if (show) setLocalSelected(currentModelId);
    }, [show, currentModelId]);

    // Find current provider from saved providers
    const currentProvider = savedProviders.find(p => p.name === currentConfig?.provider);
    // Map SavedModel[] to ModelInfo[] format for ModelSelectWithCustom
    const models = (currentProvider?.models || []).map(m => ({
        id: m.id,
        name: m.name || m.id,
        provider: currentConfig?.provider || "",
        is_free: false,
    }));

    const effectiveSelected = localSelected || currentModelId;

    return (
        <Modal show={show} onClose={onClose} title="切换模型" maxWidth={400}>
            <div className="modal-desc">选择要使用的 AI 模型</div>
            {currentConfig?.provider ? (
                <div className="model-switch-list" style={{ marginTop: 12 }}>
                    <ModelSelectWithCustom
                        models={models}
                        selectedModel={effectiveSelected}
                        onSelect={(modelId) => {
                            setLocalSelected(modelId);
                        }}
                    />
                    <button
                        className="btn-primary"
                        style={{ width: '100%', marginTop: 12, padding: '10px' }}
                        onClick={async () => {
                            if (!effectiveSelected.trim()) return;
                            const fullModelId = `${currentConfig.provider}/${effectiveSelected.trim()}`;
                            await handleSetModel(fullModelId);
                            onClose();
                        }}
                        disabled={!effectiveSelected || effectiveSelected === currentModelId}
                    >
                        确认切换
                    </button>
                </div>
            ) : (
                <div style={{ color: "var(--text-secondary)", marginTop: 12 }}>
                    请先在「AI 引擎」标签页配置模型提供商
                </div>
            )}
            <ModalFooter>
                <button className="btn-secondary" onClick={onClose}>关闭</button>
            </ModalFooter>
        </Modal>
    );
}
