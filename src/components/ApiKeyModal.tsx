// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/**
 * API Key Configuration Modal
 *
 * Handles provider selection, API key input, and model configuration.
 * Shows category tabs (Free/Paid/Custom) and provider cards.
 * This is a presentational component — all state is passed via props from App.
 */

import { AnimatePresence, motion } from "framer-motion";
import { Key, Gift, CreditCard, Globe, ExternalLink } from "lucide-react";
import React from "react";
import type { ProviderInfo, CurrentConfig } from "../types";
import { CATEGORY_LABELS } from "../types";
import { ModelSelectWithCustom } from "./ModelSelectWithCustom";

interface ApiKeyModalProps {
    show: boolean;
    onClose: () => void;
    // Provider data
    providers: ProviderInfo[];
    filteredProviders: ProviderInfo[];
    currentConfig: CurrentConfig | null;
    // Selection state
    activeTab: string;
    selectedCategory: string;
    setSelectedCategory: (c: string) => void;
    selectedProvider: string;
    setSelectedProvider: (p: string) => void;
    // Form state
    apiKeyInput: string;
    setApiKeyInput: (v: string) => void;
    baseUrlInput: string;
    setBaseUrlInput: (v: string) => void;
    selectedModel: string;
    setSelectedModel: (m: string) => void;
    configSaving: boolean;
    setConfigStatus: (s: string) => void;
    // Actions
    onSaveConfig: () => void;
    onOpenRegister: (providerId: string) => void;
}

export function ApiKeyModal({
    show,
    onClose,
    providers,
    filteredProviders,
    currentConfig,
    activeTab,
    selectedCategory,
    setSelectedCategory,
    selectedProvider,
    setSelectedProvider,
    apiKeyInput,
    setApiKeyInput,
    baseUrlInput,
    setBaseUrlInput,
    selectedModel,
    setSelectedModel,
    configSaving,
    setConfigStatus,
    onSaveConfig,
    onOpenRegister,
}: ApiKeyModalProps) {
    if (!show) return null;

    const isDirectConfig = activeTab === "models" && selectedProvider && selectedCategory !== "custom";

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className="modal-overlay"
                    onClick={() => { if (currentConfig?.has_api_key) onClose(); }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <motion.div
                        className="modal-box"
                        onClick={(e) => e.stopPropagation()}
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                    >
                        <div className="modal-title">
                            {isDirectConfig ? `配置 ${providers.find(p => p.id === selectedProvider)?.name}` : <><Key size={16} strokeWidth={1.5} style={{ verticalAlign: 'middle', marginRight: 6 }} />配置 AI 模型 API Key</>}
                        </div>
                        {!isDirectConfig && (
                            <div className="modal-desc">
                                使用 OpenClaw 需要配置一个 API Key。推荐选择免费注册的提供商，无需付费。
                            </div>
                        )}

                        {/* Category tabs (Hide if direct config) */}
                        {!isDirectConfig && (
                            <div className="category-tabs" style={{ marginBottom: 16 }}>
                                {Object.entries(CATEGORY_LABELS).map(([key, { label, icon }]) => {
                                    const IconMap: Record<string, React.ReactNode> = {
                                        gift: <Gift size={14} strokeWidth={1.5} />,
                                        "credit-card": <CreditCard size={14} strokeWidth={1.5} />,
                                        globe: <Globe size={14} strokeWidth={1.5} />,
                                    };
                                    return (
                                        <button
                                            key={key}
                                            className={`category-btn ${selectedCategory === key ? "active" : ""}`}
                                            data-text={label}
                                            onClick={() => { setSelectedCategory(key); setSelectedProvider(""); setConfigStatus(""); }}
                                        >
                                            {IconMap[icon]} {label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div style={{ minHeight: 280 }}>
                            {selectedCategory === "custom" ? (
                                <div className="modal-form animate-fade-in">
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
                                </div>
                            ) : (
                                <>
                                    {/* Provider List (Hide if direct config) */}
                                    {!isDirectConfig && (
                                        <div className="provider-list modal-providers animate-fade-in">
                                            {filteredProviders.map((p) => (
                                                <div
                                                    key={p.id}
                                                    className={`provider-card ${selectedProvider === p.id ? "selected" : ""}`}
                                                    onClick={() => {
                                                        setSelectedProvider(p.id);
                                                        setBaseUrlInput(p.base_url);
                                                        setSelectedModel(p.models[0]?.id || "");
                                                        setConfigStatus("");
                                                    }}
                                                >
                                                    <div className="provider-header">
                                                        <span className="provider-name">{p.name}</span>
                                                        {p.category === "free" && <span className="badge-free">免费</span>}
                                                    </div>
                                                    <p className="provider-desc">{p.description}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Config Form for selected provider */}
                                    {selectedProvider && (
                                        <div className="modal-form animate-fade-in" style={{ marginTop: isDirectConfig ? 0 : 16 }}>
                                            <div className="form-group-row" style={{ marginBottom: 12 }}>
                                                <button className="btn-link" onClick={() => onOpenRegister(selectedProvider)}>
                                                    <ExternalLink size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {selectedCategory === "free" ? "点击此处注册获取免费 API Key →" : "前往官网获取 API Key →"}
                                                </button>
                                            </div>
                                            <div className="form-group">
                                                <label>粘贴 API Key</label>
                                                <input type="password" placeholder="粘贴你的 API Key..." value={apiKeyInput}
                                                    onChange={(e) => setApiKeyInput(e.target.value)} className="input-field" />
                                            </div>
                                            <div className="form-group">
                                                <label>选择验证模型</label>
                                                <ModelSelectWithCustom
                                                    models={providers.find(p => p.id === selectedProvider)?.models || []}
                                                    selectedModel={selectedModel}
                                                    onSelect={setSelectedModel}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                        </div>

                        <button className="btn-primary btn-hero start modal-save"
                            onClick={onSaveConfig} disabled={configSaving || !apiKeyInput.trim()}>
                            {configSaving ? "保存中..." : "保存并开始使用"}
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
