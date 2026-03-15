// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/**
 * ModelsTab Component — AI Engine Page (Redesigned)
 *
 * Shows saved providers as card list + "add provider" button.
 * Each card shows provider name, base URL, model count, and actions.
 */

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Cpu, Plus, Trash2, Server, Key, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Modal } from "./ui/Modal";
import type { SavedProvider, ProviderInfo, CurrentConfig } from "../types";

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
    configVersion: number;
    resetModalState: () => void;
}

export function ModelsTab({
    setShowKeyModal,
    currentConfig,
    configVersion,
    resetModalState,
}: ModelsTabProps) {
    const [savedProviders, setSavedProviders] = useState<SavedProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const loadProviders = useCallback(async () => {
        setLoading(true);
        try {
            const list = await invoke<SavedProvider[]>("list_saved_providers");
            setSavedProviders(list);
        } catch (err) {
            console.error("Failed to load providers:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadProviders(); }, [loadProviders, configVersion]);

    const handleOpenAddModal = () => {
        resetModalState();
        setShowKeyModal(true);
    };

    const handleDelete = async (name: string) => {
        setDeleting(true);
        try {
            await invoke("delete_provider", { name });
            setShowDeleteConfirm(null);
            await loadProviders();
        } catch (err) {
            console.error("Delete failed:", err);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <motion.div
            key="models"
            className="models-page"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
        >
            {/* Header */}
            <div className="agents-header">
                <div>
                    <h2 className="agents-title">
                        <Cpu size={20} strokeWidth={1.5} /> AI 引擎
                    </h2>
                    <p className="page-desc" style={{ margin: "6px 0 0" }}>管理已配置的模型提供商，添加新的 API Key 接入更多模型。</p>
                </div>
                <button className="btn-primary" onClick={handleOpenAddModal}>
                    <Plus size={14} strokeWidth={2} /> 添加模型商
                </button>
            </div>

            {/* Current Active */}
            {currentConfig?.provider && (
                <div className="provider-active-hint">
                    <Server size={14} strokeWidth={1.5} />
                    <span>当前使用：<strong>{currentConfig.provider}</strong> / {currentConfig.model || "未选择模型"}</span>
                </div>
            )}

            {/* Provider Cards */}
            {loading ? (
                <div className="agents-empty">正在加载...</div>
            ) : savedProviders.length === 0 ? (
                <div className="agents-empty">
                    暂无已保存的模型商
                    <br />
                    <button className="btn-primary" style={{ marginTop: 16 }} onClick={handleOpenAddModal}>
                        <Plus size={14} strokeWidth={2} /> 添加第一个模型商
                    </button>
                </div>
            ) : (
                <div className="provider-cards-list">
                    {savedProviders.map((sp) => (
                        <motion.div
                            key={sp.name}
                            className={`provider-saved-card ${currentConfig?.provider === sp.name ? "active" : ""}`}
                            layout
                        >
                            <div className="provider-saved-header" onClick={() => setExpandedProvider(expandedProvider === sp.name ? null : sp.name)}>
                                <div className="provider-saved-icon">
                                    <Server size={18} strokeWidth={1.5} />
                                </div>
                                <div className="provider-saved-info">
                                    <div className="provider-saved-name">
                                        {sp.name}
                                        {currentConfig?.provider === sp.name && <span className="agent-badge">当前使用</span>}
                                        {sp.has_api_key && <Key size={12} strokeWidth={1.5} style={{ color: "var(--accent-green)", marginLeft: 4 }} />}
                                    </div>
                                    <div className="provider-saved-url">{sp.base_url || "无 Base URL"}</div>
                                </div>
                                <div className="provider-saved-meta">
                                    <span className="agent-meta-tag">{sp.model_count} 个模型</span>
                                    {sp.api && <span className="agent-meta-tag">{sp.api}</span>}
                                </div>
                                <div className="provider-saved-expand">
                                    {expandedProvider === sp.name ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                            </div>

                            {/* Expanded: model list */}
                            <AnimatePresence>
                                {expandedProvider === sp.name && (
                                    <motion.div
                                        className="provider-saved-models"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <div className="provider-model-grid">
                                            {sp.models.map((m) => (
                                                <div key={m.id} className="provider-model-chip">
                                                    {m.name || m.id}
                                                </div>
                                            ))}
                                            {sp.models.length === 0 && (
                                                <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>无已配置模型</div>
                                            )}
                                        </div>
                                        <div className="provider-saved-actions">
                                            <button
                                                className="btn-ghost btn-danger-ghost"
                                                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(sp.name); }}
                                            >
                                                <Trash2 size={14} strokeWidth={1.5} /> 删除
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Delete Confirm */}
            <Modal show={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="确认删除" maxWidth={400}>
                <div className="modal-form">
                    <p style={{ color: "var(--text-secondary)", margin: "12px 0 20px" }}>
                        确定要删除模型商 <strong style={{ color: "var(--text-primary)" }}>{showDeleteConfirm}</strong> 吗？
                        <br />删除后使用该模型商的 Agent 将需要重新配置。
                    </p>
                    <div className="form-actions">
                        <button className="btn-secondary" onClick={() => setShowDeleteConfirm(null)}>取消</button>
                        <button className="btn-danger" onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)} disabled={deleting}>
                            {deleting ? "删除中..." : "确认删除"}
                        </button>
                    </div>
                </div>
            </Modal>
        </motion.div>
    );
}
