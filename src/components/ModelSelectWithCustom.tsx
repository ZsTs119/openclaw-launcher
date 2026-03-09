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
    const isCustomActive = showCustom || (selectedModel && !presetIds.includes(selectedModel));

    return (
        <div className="model-select-list">
            {models.map((m) => (
                <button key={m.id}
                    className={`model-select-btn ${selectedModel === m.id ? "active" : ""}`}
                    data-text={m.name}
                    onClick={() => {
                        setShowCustom(false);
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
                    // If selectedModel is already custom, pre-fill
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
                        onBlur={() => {
                            const v = customValue.trim();
                            if (v) {
                                onSelect(v);
                            } else if (!v && showCustom) {
                                // If empty and user had toggled custom, revert to first preset
                                setShowCustom(false);
                                if (models.length > 0) onSelect(models[0].id);
                            }
                        }}
                    />
                </div>
            )}
        </div>
    );
}
