// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
import { useState } from "react";
import { Modal, ModalFooter } from "./ui/Modal";
import type { ProviderInfo, CurrentConfig } from "../types";
import { ModelSelectWithCustom } from "./ModelSelectWithCustom";

interface ModelSwitchModalProps {
    show: boolean;
    onClose: () => void;
    providers: ProviderInfo[];
    currentConfig: CurrentConfig | null;
    handleSetModel: (modelId: string) => Promise<void>;
}

export function ModelSwitchModal({
    show, onClose, providers, currentConfig, handleSetModel,
}: ModelSwitchModalProps) {
    const [customModelId, setCustomModelId] = useState("");

    const currentProvider = providers.find(p => p.id === currentConfig?.provider);
    const models = currentProvider?.models || [];

    return (
        <Modal show={show} onClose={onClose} title="切换模型" maxWidth={400}>
            <div className="modal-desc">选择要使用的 AI 模型</div>
            {currentConfig?.provider ? (
                <div className="model-switch-list" style={{ marginTop: 12 }}>
                    <ModelSelectWithCustom
                        models={models}
                        selectedModel={
                            // Extract model id from full "provider/model" format
                            currentConfig.model?.includes("/")
                                ? currentConfig.model.split("/").slice(1).join("/")
                                : currentConfig.model || ""
                        }
                        onSelect={(modelId) => {
                            setCustomModelId(modelId);
                        }}
                    />
                    <button
                        className="btn-primary"
                        style={{ width: '100%', marginTop: 12, padding: '10px' }}
                        onClick={async () => {
                            const modelToSet = customModelId || (
                                currentConfig.model?.includes("/")
                                    ? currentConfig.model.split("/").slice(1).join("/")
                                    : currentConfig.model || ""
                            );
                            if (!modelToSet.trim()) return;
                            const fullModelId = `${currentConfig.provider}/${modelToSet.trim()}`;
                            await handleSetModel(fullModelId);
                            onClose();
                        }}
                        disabled={!customModelId}
                    >
                        确认切换
                    </button>
                </div>
            ) : (
                <div style={{ color: "var(--text-secondary)", marginTop: 12 }}>
                    请先在「模型」标签页配置 API 提供商
                </div>
            )}
            <ModalFooter>
                <button className="btn-secondary" onClick={onClose}>关闭</button>
            </ModalFooter>
        </Modal>
    );
}
