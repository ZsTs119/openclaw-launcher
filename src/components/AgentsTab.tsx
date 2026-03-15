// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/**
 * AgentsTab Component
 *
 * Manages AI agents: list, create, edit, delete.
 * Shows agent cards in a grid layout with skill listing.
 */

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Bot, Plus, Pencil, Trash2, Sparkles, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { Modal } from "./ui/Modal";
import type { AgentInfo, AgentDetail, SkillInfo } from "../types";
import "../styles/agents.css";

export function AgentsTab() {
    const [agents, setAgents] = useState<AgentInfo[]>([]);
    const [skills, setSkills] = useState<SkillInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState<AgentDetail | null>(null);

    // Create form state
    const [newName, setNewName] = useState("");
    const [newPrompt, setNewPrompt] = useState("");
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [agentList, skillList] = await Promise.all([
                invoke<AgentInfo[]>("list_agents"),
                invoke<SkillInfo[]>("list_skills"),
            ]);
            setAgents(agentList);
            setSkills(skillList);
        } catch (err) {
            console.error("Failed to load agents:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleCreate = async () => {
        if (!newName.trim()) {
            setFormError("请输入 Agent 名称");
            return;
        }
        setSaving(true);
        setFormError("");
        try {
            await invoke("create_agent", {
                name: newName.trim(),
                model: null,
                systemPrompt: newPrompt.trim() || null,
            });
            setShowCreate(false);
            setNewName("");
            setNewPrompt("");
            await loadData();
        } catch (err) {
            setFormError(String(err));
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = async (name: string) => {
        try {
            const detail = await invoke<AgentDetail>("get_agent_detail", { name });
            setSelectedAgent(detail);
            setNewPrompt(detail.system_prompt || "");
            setShowEdit(true);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSaveEdit = async () => {
        if (!selectedAgent) return;
        setSaving(true);
        setFormError("");
        try {
            await invoke("update_agent", {
                name: selectedAgent.name,
                systemPrompt: newPrompt.trim() || null,
            });
            setShowEdit(false);
            setSelectedAgent(null);
            setNewPrompt("");
            await loadData();
        } catch (err) {
            setFormError(String(err));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedAgent) return;
        setSaving(true);
        try {
            await invoke("delete_agent", { name: selectedAgent.name });
            setShowDelete(false);
            setSelectedAgent(null);
            await loadData();
        } catch (err) {
            setFormError(String(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <motion.div
            key="agents"
            className="agents-page"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
        >
            {/* Header */}
            <div className="agents-header">
                <h2 className="agents-title">
                    <Bot size={20} strokeWidth={1.5} /> 智能体管理
                </h2>
                <button className="btn-primary" onClick={() => { setShowCreate(true); setFormError(""); setNewName(""); setNewPrompt(""); }}>
                    <Plus size={14} strokeWidth={2} /> 创建 Agent
                </button>
            </div>

            {/* Agent Grid */}
            {loading ? (
                <div className="agents-empty">正在加载...</div>
            ) : agents.length === 0 ? (
                <div className="agents-empty">暂无 Agent，点击上方按钮创建</div>
            ) : (
                <div className="agents-grid">
                    {agents.map((agent) => (
                        <motion.div
                            key={agent.name}
                            className={`agent-card ${agent.is_default ? "default" : ""}`}
                            whileHover={{ scale: 1.02 }}
                            transition={{ duration: 0.15 }}
                        >
                            <div className="agent-card-header">
                                <div className="agent-card-icon">
                                    {agent.is_default ? <Shield size={18} strokeWidth={1.5} /> : <Bot size={18} strokeWidth={1.5} />}
                                </div>
                                <div className="agent-card-info">
                                    <div className="agent-card-name">
                                        {agent.name}
                                        {agent.is_default && <span className="agent-badge">默认</span>}
                                    </div>
                                    <div className="agent-card-model">
                                        {agent.model || "未配置模型"}
                                    </div>
                                </div>
                            </div>
                            <div className="agent-card-meta">
                                {agent.has_sessions && <span className="agent-meta-tag">有会话记录</span>}
                            </div>
                            <div className="agent-card-actions">
                                <button className="btn-ghost" onClick={() => handleEdit(agent.name)} title="编辑">
                                    <Pencil size={14} strokeWidth={1.5} />
                                </button>
                                {!agent.is_default && (
                                    <button
                                        className="btn-ghost btn-danger-ghost"
                                        onClick={() => {
                                            setSelectedAgent({ name: agent.name, model: agent.model, provider: null, system_prompt: null, has_sessions: agent.has_sessions, is_default: agent.is_default });
                                            setShowDelete(true);
                                        }}
                                        title="删除"
                                    >
                                        <Trash2 size={14} strokeWidth={1.5} />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Skills Section */}
            <div className="skills-section">
                <h3 className="skills-title">
                    <Sparkles size={16} strokeWidth={1.5} /> 已安装技能
                </h3>
                {skills.length === 0 ? (
                    <div className="skills-empty">暂无技能</div>
                ) : (
                    <div className="skills-grid">
                        {skills.map((skill) => (
                            <div key={skill.path} className="skill-card">
                                <div className="skill-name">{skill.name}</div>
                                <div className="skill-desc">{skill.description || "无描述"}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            <Modal show={showCreate} onClose={() => setShowCreate(false)} title="创建 Agent" maxWidth={480}>
                <div className="modal-form">
                    <label className="form-label">
                        Agent 名称
                        <input
                            className="form-input"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                            placeholder="例如：my-coder"
                            maxLength={32}
                        />
                        <span className="form-hint">小写字母、数字、连字符，1-32 字符</span>
                    </label>
                    <label className="form-label">
                        系统提示词 <span className="form-optional">(可选)</span>
                        <textarea
                            className="form-textarea"
                            value={newPrompt}
                            onChange={(e) => setNewPrompt(e.target.value)}
                            placeholder="自定义 Agent 行为的系统提示词..."
                            rows={4}
                        />
                    </label>
                    {formError && <div className="form-error">{formError}</div>}
                    <div className="form-actions">
                        <button className="btn-secondary" onClick={() => setShowCreate(false)}>取消</button>
                        <button className="btn-primary" onClick={handleCreate} disabled={saving}>
                            {saving ? "创建中..." : "创建"}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Edit Modal */}
            <Modal show={showEdit} onClose={() => setShowEdit(false)} title={`编辑 Agent: ${selectedAgent?.name || ""}`} maxWidth={480}>
                <div className="modal-form">
                    <label className="form-label">
                        系统提示词
                        <textarea
                            className="form-textarea"
                            value={newPrompt}
                            onChange={(e) => setNewPrompt(e.target.value)}
                            placeholder="自定义 Agent 行为的系统提示词..."
                            rows={6}
                        />
                    </label>
                    {formError && <div className="form-error">{formError}</div>}
                    <div className="form-actions">
                        <button className="btn-secondary" onClick={() => setShowEdit(false)}>取消</button>
                        <button className="btn-primary" onClick={handleSaveEdit} disabled={saving}>
                            {saving ? "保存中..." : "保存"}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirm */}
            <Modal show={showDelete} onClose={() => setShowDelete(false)} title="确认删除" maxWidth={400}>
                <div className="modal-form">
                    <p style={{ color: "var(--text-secondary)", margin: "12px 0 20px" }}>
                        确定要删除 Agent <strong style={{ color: "var(--text-primary)" }}>{selectedAgent?.name}</strong> 吗？此操作不可撤销。
                    </p>
                    <div className="form-actions">
                        <button className="btn-secondary" onClick={() => setShowDelete(false)}>取消</button>
                        <button className="btn-danger" onClick={handleDelete} disabled={saving}>
                            {saving ? "删除中..." : "确认删除"}
                        </button>
                    </div>
                </div>
            </Modal>
        </motion.div>
    );
}
