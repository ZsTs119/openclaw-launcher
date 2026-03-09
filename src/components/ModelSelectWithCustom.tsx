// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/**
 * ModelSelectWithCustom Component
 *
 * Renders a list of preset model buttons plus a "手动输入" (custom input) option.
 * Reused by ApiKeyModal and ModelSwitchModal.
 */

import { useState } from "react";
import { Edit3 } from "lucide-react";
import type { ModelInfo } from "../types";

interface ModelSelectWithCustomProps {
    models: ModelInfo[];
    selectedModel: string;
    onSelect: (modelId: string) => void;
}

export function ModelSelectWithCustom({ models, selectedModel, onSelect }: ModelSelectWithCustomProps) {
    const [showCustom, setShowCustom] = useState(false);
    const [customValue, setCustomValue] = useState("");

    const presetIds = models.map(m => m.id);
    // Only show custom input when user explicitly toggled it
    const isCustomActive = showCustom;

    return (
        <div className="model-select-list">
            {models.map((m) => (
                <button key={m.id}
                    className={`model-select-btn ${!showCustom && selectedModel === m.id ? "active" : ""}`}
                    data-text={m.name}
                    onClick={() => {
                        setShowCustom(false);
                        setCustomValue("");
                        onSelect(m.id);
                    }}
                >
                    {m.name}
                    {m.is_free && <span className="badge-free-sm">免费</span>}
                </button>
            ))}
            <button
                className={`model-select-btn model-custom-toggle ${isCustomActive ? "active" : ""}`}
                data-text="手动输入"
                onClick={() => {
                    setShowCustom(true);
                    // If selectedModel is already custom (not in presets), pre-fill
                    if (selectedModel && !presetIds.includes(selectedModel)) {
                        setCustomValue(selectedModel);
                    }
                }}
            >
                <Edit3 size={12} strokeWidth={2} style={{ marginRight: 4 }} />
                手动输入
            </button>
            {isCustomActive && (
                <div className="model-custom-input-row">
                    <input
                        type="text"
                        className="input-field model-custom-input"
                        placeholder="输入模型 ID，如 gpt-4o、deepseek-r1-0528"
                        value={customValue}
                        autoFocus
                        onChange={(e) => {
                            setCustomValue(e.target.value);
                            const v = e.target.value.trim();
                            if (v) onSelect(v);
                        }}
                    />
                </div>
            )}
        </div>
    );
}
