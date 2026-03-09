// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
import React from "react";
import { motion } from "framer-motion";
import { Cpu, Save, Gift, CreditCard, Globe } from "lucide-react";
import { CATEGORY_LABELS } from "../types";
import type { ProviderInfo, CurrentConfig } from "../types";

interface ModelsTabProps {
    providers: ProviderInfo[];
    filteredProviders: ProviderInfo[];
    currentConfig: CurrentConfig | null;
    selectedCategory: string;
    setSelectedCategory: (v: string) => void;
    selectedProvider: string;
    setSelectedProvider: (v: string) => void;
    apiKeyInput: string;
    setApiKeyInput: (v: string) => void;
    baseUrlInput: string;
    setBaseUrlInput: (v: string) => void;
    selectedModel: string;
    setSelectedModel: (v: string) => void;
    configSaving: boolean;
    setConfigStatus: (v: string) => void;
    setShowKeyModal: (v: boolean) => void;
    handleSaveConfig: () => void;
}

export function ModelsTab({
    filteredProviders, currentConfig,
    selectedCategory, setSelectedCategory,
    setSelectedProvider, setBaseUrlInput,
    setSelectedModel, setConfigStatus,
    setShowKeyModal,
    apiKeyInput, setApiKeyInput, baseUrlInput,
    selectedModel, configSaving,
    handleSaveConfig,
}: ModelsTabProps) {
    return (
        <motion.div
            key="models"
            className="models-page"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
        >
            <h2 className="page-title"><Cpu size={18} strokeWidth={1.5} style={{ verticalAlign: 'middle', marginRight: 6 }} />模型配置</h2>
            <p className="page-desc">选择 AI 模型提供商，配置 API Key 后即可开始使用。</p>

            <div className="category-tabs" style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
                {Object.entries(CATEGORY_LABELS).map(([key, { label, icon }]) => {
                    const IconMap: Record<string, React.ReactNode> = {
                        gift: <Gift size={14} strokeWidth={1.5} />,
                        "credit-card": <CreditCard size={14} strokeWidth={1.5} />,
                        globe: <Globe size={14} strokeWidth={1.5} />,
                    };
                    return (
                        <button key={key}
                            className={`category-btn ${selectedCategory === key ? "active" : ""}`}
                            data-text={label}
                            onClick={() => { setSelectedCategory(key); setSelectedProvider(""); setConfigStatus(""); }}>
                            {IconMap[icon]} {label}
                        </button>
                    );
                })}
            </div>

            {selectedCategory === "custom" ? (
                <div className="custom-config animate-fade-in">
                    <div className="form-group">
                        <label>API Base URL</label>
                        <input type="url" placeholder="https://your-relay.com/v1" value={baseUrlInput}
                            onChange={(e) => setBaseUrlInput(e.target.value)} className="input-field" />
                    </div>
                    <div className="form-group">
                        <label>API Key</label>
                        <input type="password" placeholder="sk-..." value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)} className="input-field" />
                    </div>
                    <div className="form-group">
                        <label>模型 ID（可选）</label>
                        <input type="text" placeholder="gpt-4o / deepseek-chat / ..." value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)} className="input-field" />
                    </div>
                    <button className="btn-primary" style={{ width: '100%', marginTop: 16, padding: '12px' }} onClick={handleSaveConfig} disabled={configSaving}>
                        {configSaving ? "保存中..." : <><Save size={14} strokeWidth={1.5} style={{ verticalAlign: 'middle', marginRight: 4 }} />保存配置</>}
                    </button>

                </div>
            ) : (
                <div className="provider-list animate-fade-in">
                    {filteredProviders.map((p) => (
                        <div key={p.id}
                            className={`provider-card ${currentConfig?.provider === p.id ? "active-provider" : ""}`}
                            onClick={() => {
                                setSelectedProvider(p.id);
                                setBaseUrlInput(p.base_url);
                                setSelectedModel(p.models[0]?.id || "");
                                setConfigStatus("");
                                setShowKeyModal(true);
                            }}>
                            <div className="provider-header">
                                <span className="provider-name">{p.name} <span style={{ fontSize: 12, fontWeight: 'normal', color: 'var(--text-muted)' }}>{currentConfig?.provider === p.id ? " (当前使用)" : ""}</span></span>
                                {p.category === "free" && <span className="badge-free">免费</span>}
                            </div>
                            <p className="provider-desc">{p.description}</p>
                            <div className="provider-models">
                                {p.models.slice(0, 3).map((m) => (
                                    <span key={m.id} className="model-tag">{m.name}</span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    );
}
