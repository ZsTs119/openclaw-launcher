// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/**
 * AgentsTab Component
 *
 * Manages AI agents: list, create, edit, delete, chat.
 * Shows agent cards with model selection, permission control, and chat buttons.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Bot, Plus, Pencil, Trash2, Sparkles, Shield, MessageCircle, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { Modal } from "./ui/Modal";
import { CustomDropdown } from "./ui/CustomDropdown";
import type { AgentInfo, AgentDetail, SkillInfo, AvailableModel } from "../types";
import "../styles/agents.css";

interface AgentsTabProps {
    servicePort: number | null;
    running: boolean;
    handleStart: () => Promise<void>;
}

export function AgentsTab({ servicePort, running, handleStart }: AgentsTabProps) {
    const [agents, setAgents] = useState<AgentInfo[]>([]);
    const [skills, setSkills] = useState<SkillInfo[]>([]);
    const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState<AgentDetail | null>(null);

    // Form state
    const [newName, setNewName] = useState("");
    const [newModel, setNewModel] = useState("");
    const [newPrompt, setNewPrompt] = useState("");
    const [newSupervisor, setNewSupervisor] = useState(false);
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);

    // Pending chat: open browser once service becomes ready
    const pendingChatUrl = useRef<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [agentList, skillList, modelList] = await Promise.all([
                invoke<AgentInfo[]>("list_agents"),
                invoke<SkillInfo[]>("list_skills"),
                invoke<AvailableModel[]>("list_available_models"),
            ]);
            setAgents(agentList);
            setSkills(skillList);
            setAvailableModels(modelList);
        } catch (err) {
            console.error("Failed to load agents:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // When service becomes ready and we have a pending chat URL, open it
    useEffect(() => {
        if (!pendingChatUrl.current) return;

        const unlisten = listen<{ level: string; message: string }>("service-log", (event) => {
            const msg = event.payload.message?.toLowerCase() || "";
            if (
                pendingChatUrl.current &&
                (msg.includes("listening") ||
                    msg.includes("started on") ||
                    msg.includes("ready on") ||
                    msg.includes("server is running") ||
                    msg.includes("server started"))
            ) {
                const url = pendingChatUrl.current;
                pendingChatUrl.current = null;
                // Small delay so service.rs auto-open finishes first
                setTimeout(() => openUrl(url), 500);
                unlisten.then((fn) => fn());
            }
        });

        return () => { unlisten.then((fn) => fn()); };
    }, [running, servicePort]);

    const resetForm = () => {
        setNewName("");
        setNewModel("");
        setNewPrompt("");
        setNewSupervisor(false);
        setFormError("");
    };

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
                model: newModel || null,
                systemPrompt: newPrompt.trim() || null,
                isSupervisor: newSupervisor,
            });
            setShowCreate(false);
            resetForm();
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
            setNewSupervisor(detail.is_supervisor);
            if (detail.provider && detail.model) {
                setNewModel(`${detail.provider}/${detail.model}`);
            } else {
                setNewModel("");
            }
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
                model: newModel || null,
                isSupervisor: newSupervisor,
            });
            setShowEdit(false);
            setSelectedAgent(null);
            resetForm();
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

    const handleChat = async (agentName: string) => {
        const port = servicePort || 18789;
        const url = `http://localhost:${port}/chat?session=agent:${agentName}:main`;

        if (running && servicePort) {
            openUrl(url);
        } else {
            pendingChatUrl.current = url;
            await handleStart();
        }
    };

    // Build dropdown options
    const modelOptions = [
        { value: "", label: "继承默认模型" },
        ...availableModels.map((m) => ({
            value: m.full_ref,
            label: m.model_name,
            sublabel: m.provider,
        })),
    ];

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
                <button className="btn-primary" onClick={() => { setShowCreate(true); resetForm(); }}>
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
                                    <div className={`agent-card-model ${!agent.model_valid ? "model-invalid" : ""}`}>
                                        {agent.model || "未配置模型"}
                                        {!agent.model_valid && agent.model && (
                                            <span className="model-invalid-tag">
                                                <AlertTriangle size={11} strokeWidth={2} /> 已失效
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="agent-card-meta">
                                {agent.has_sessions && <span className="agent-meta-tag">有会话记录</span>}
                            </div>
                            <div className="agent-card-actions">
                                <button
                                    className="btn-ghost btn-chat"
                                    onClick={() => handleChat(agent.name)}
                                    title="对话"
                                >
                                    <MessageCircle size={14} strokeWidth={1.5} /> 对话
                                </button>
                                <button className="btn-ghost" onClick={() => handleEdit(agent.name)} title="编辑">
                                    <Pencil size={14} strokeWidth={1.5} />
                                </button>
                                {!agent.is_default && (
                                    <button
                                        className="btn-ghost btn-danger-ghost"
                                        onClick={() => {
                                            setSelectedAgent({
                                                name: agent.name,
                                                model: agent.model,
                                                provider: null,
                                                system_prompt: null,
                                                has_sessions: agent.has_sessions,
                                                is_default: agent.is_default,
                                                is_supervisor: false,
                                            });
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
                    <div className="form-label">
                        <span className="form-label-text">模型</span>
                        <CustomDropdown
                            options={modelOptions}
                            value={newModel}
                            onChange={setNewModel}
                            placeholder="继承默认模型"
                        />
                        <span className="form-hint">从已添加的 AI 引擎中选择模型</span>
                    </div>
                    <label className="form-label">
                        人设指令 <span className="form-optional">(可选)</span>
                        <textarea
                            className="form-textarea"
                            value={newPrompt}
                            onChange={(e) => setNewPrompt(e.target.value)}
                            placeholder="定义 Agent 的性格、语气和行为规则..."
                            rows={4}
                        />
                        <span className="form-hint">写入 workspace 的 SOUL.md，控制 Agent 人设和边界</span>
                    </label>
                    <label className="form-label form-toggle-label">
                        <span>权限级别</span>
                        <div className="form-toggle-row">
                            <button
                                type="button"
                                className={`form-toggle-btn ${!newSupervisor ? "active" : ""}`}
                                onClick={() => setNewSupervisor(false)}
                            >
                                下属
                            </button>
                            <button
                                type="button"
                                className={`form-toggle-btn ${newSupervisor ? "active" : ""}`}
                                onClick={() => setNewSupervisor(true)}
                            >
                                主管
                            </button>
                        </div>
                        <span className="form-hint">
                            {newSupervisor ? "可调用所有 Agent（适用于管理角色）" : "只能回调 main Agent（适用于专业角色）"}
                        </span>
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
                    <div className="form-label">
                        <span className="form-label-text">模型</span>
                        <CustomDropdown
                            options={modelOptions}
                            value={newModel}
                            onChange={setNewModel}
                            placeholder="继承默认模型"
                        />
                    </div>
                    <label className="form-label">
                        人设指令
                        <textarea
                            className="form-textarea"
                            value={newPrompt}
                            onChange={(e) => setNewPrompt(e.target.value)}
                            placeholder="定义 Agent 的性格、语气和行为规则..."
                            rows={6}
                        />
                        <span className="form-hint">写入 SOUL.md — 每次对话开始时注入到 Agent 上下文</span>
                    </label>
                    <label className="form-label form-toggle-label">
                        <span>权限级别</span>
                        <div className="form-toggle-row">
                            <button
                                type="button"
                                className={`form-toggle-btn ${!newSupervisor ? "active" : ""}`}
                                onClick={() => setNewSupervisor(false)}
                            >
                                下属
                            </button>
                            <button
                                type="button"
                                className={`form-toggle-btn ${newSupervisor ? "active" : ""}`}
                                onClick={() => setNewSupervisor(true)}
                            >
                                主管
                            </button>
                        </div>
                        <span className="form-hint">
                            {newSupervisor ? "可调用所有 Agent" : "只能回调 main Agent"}
                        </span>
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
                        确定要删除 Agent <strong style={{ color: "var(--text-primary)" }}>{selectedAgent?.name}</strong> 吗？
                        <br />
                        <span style={{ fontSize: "12px" }}>将同时删除 workspace 和会话记录，此操作不可撤销。</span>
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
