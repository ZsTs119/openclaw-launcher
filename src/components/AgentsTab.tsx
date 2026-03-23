// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/**
 * AgentsTab Component
 *
 * Manages AI agents: list, create, edit, delete, chat.
 * Shows agent cards with model selection, permission control, and chat buttons.
 */

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Bot, Plus, Pencil, Trash2, Sparkles, Shield, MessageCircle, AlertTriangle, History, SquarePlus, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { Modal } from "./ui/Modal";
import { CustomDropdown } from "./ui/CustomDropdown";
import { SkillDetailModal } from "./SkillDetailModal";
import { SkillBrowser, SkillMarketButton } from "./SkillBrowser";
import type { AgentInfo, AgentDetail, SkillInfo, AvailableModel, SessionInfo } from "../types";
import "../styles/agents.css";

interface AgentsTabProps {
    openInBrowser: (buildUrl: (port: number) => string) => Promise<void>;
}

export function AgentsTab({ openInBrowser }: AgentsTabProps) {
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
    const [newAllowAgents, setNewAllowAgents] = useState<string[]>(["main"]);
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);

    // Session history modal state
    const [showHistory, setShowHistory] = useState(false);
    const [historyAgent, setHistoryAgent] = useState("");
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
    const [deleteCountdown, setDeleteCountdown] = useState(0);
    const [agentDeleteCountdown, setAgentDeleteCountdown] = useState(0);

    // Skill detail modal state
    const [showSkillDetail, setShowSkillDetail] = useState(false);
    const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);
    const [showMarketplace, setShowMarketplace] = useState(false);

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

    const resetForm = () => {
        setNewName("");
        setNewModel("");
        setNewPrompt("");
        setNewAllowAgents(["main"]);
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
                allowAgents: newAllowAgents,
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
            setNewAllowAgents(detail.allow_agents || ["main"]);
            // Use model_ref (raw "provider/model_id") for dropdown pre-selection
            setNewModel(detail.model_ref || "");
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
                allowAgents: newAllowAgents,
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

    const handleChat = (agent: AgentInfo) => {
        const sessionKey = agent.last_chat_session_key ?? `agent:${agent.name}:launcher`;
        openInBrowser((port) =>
            `http://localhost:${port}/chat?session=${encodeURIComponent(sessionKey)}`
        );
    };

    const handleNewChat = (agentName: string) => {
        const newKey = `agent:${agentName}:chat-${Date.now()}`;
        openInBrowser((port) =>
            `http://localhost:${port}/chat?session=${encodeURIComponent(newKey)}`
        );
        // Update local state so "打开对话" immediately uses this new session
        setAgents(prev => prev.map(a =>
            a.name === agentName ? { ...a, last_chat_session_key: newKey } : a
        ));
    };

    const handleHistory = async (agentName: string) => {
        setHistoryAgent(agentName);
        setShowHistory(true);
        setSessionsLoading(true);
        setRenamingId(null);
        try {
            const list = await invoke<SessionInfo[]>("list_sessions", { agentName });
            setSessions(list);
        } catch (err) {
            console.error("Failed to load sessions:", err);
            setSessions([]);
        } finally {
            setSessionsLoading(false);
        }
    };

    const handleOpenSession = (sessionKey: string) => {
        setShowHistory(false); // Close modal so startup overlay is visible
        openInBrowser((port) =>
            `http://localhost:${port}/chat?session=${encodeURIComponent(sessionKey)}`
        );
    };

    const handleRenameSession = async (sessionId: string) => {
        try {
            await invoke("rename_session", { agentName: historyAgent, sessionId, newName: renameValue });
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === sessionId
                        ? { ...s, name: renameValue.trim() || s.name, is_renamed: renameValue.trim().length > 0 }
                        : s
                )
            );
            setRenamingId(null);
        } catch (err) {
            console.error("Rename failed:", err);
        }
    };

    const formatTime = (ts: string) => {
        try {
            const d = new Date(ts);
            return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
        } catch {
            return ts;
        }
    };

    // Delete session with countdown confirmation
    const startDeleteSession = (sessionId: string) => {
        setDeleteSessionId(sessionId);
        setDeleteCountdown(3);
    };

    useEffect(() => {
        if (deleteCountdown > 0) {
            const timer = setTimeout(() => setDeleteCountdown((c) => c - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [deleteCountdown]);

    // Agent delete countdown timer
    useEffect(() => {
        if (agentDeleteCountdown > 0) {
            const timer = setTimeout(() => setAgentDeleteCountdown((c) => c - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [agentDeleteCountdown]);

    const handleDeleteSession = async () => {
        if (!deleteSessionId) return;
        try {
            await invoke("delete_session", { agentName: historyAgent, sessionId: deleteSessionId });
            setSessions((prev) => prev.filter((s) => s.id !== deleteSessionId));
            setDeleteSessionId(null);
            // Refresh agent list so has_sessions badge updates immediately
            loadData();
        } catch (err) {
            console.error("Delete session failed:", err);
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
                                    onClick={() => handleNewChat(agent.name)}
                                    title="新建会话"
                                >
                                    <SquarePlus size={14} strokeWidth={1.5} /> 新建会话
                                </button>
                                <button
                                    className="btn-ghost btn-chat"
                                    onClick={() => handleChat(agent)}
                                    title="打开对话"
                                >
                                    <MessageCircle size={14} strokeWidth={1.5} /> 打开对话
                                </button>
                                {agent.has_sessions && (
                                    <button
                                        className="btn-ghost btn-history"
                                        onClick={() => handleHistory(agent.name)}
                                        title="历史会话"
                                    >
                                        <History size={14} strokeWidth={1.5} /> 历史
                                    </button>
                                )}
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
                                                model_ref: null,
                                                system_prompt: null,
                                                has_sessions: agent.has_sessions,
                                                is_default: agent.is_default,
                                                is_supervisor: false,
                                                allow_agents: [],
                                            });
                                            setAgentDeleteCountdown(3);
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
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Sparkles size={16} strokeWidth={1.5} /> 已安装技能
                        <span className="skills-count">{skills.length}</span>
                    </span>
                    <SkillMarketButton onClick={() => setShowMarketplace(true)} />
                </h3>
                {skills.length === 0 ? (
                    <div className="skills-empty">暂无技能</div>
                ) : (
                    <div className="skills-grid">
                        {skills.map((skill) => (
                            <div key={skill.path} className="skill-card">
                                <div className="skill-card-header">
                                    <Sparkles size={14} strokeWidth={1.5} className="skill-icon" />
                                    <div className="skill-name">{skill.name}</div>
                                </div>
                                <div className="skill-desc">
                                    {skill.description || "无描述"}
                                </div>
                                <div className="skill-footer">
                                    <span className="skill-path-hint" title={skill.path}>
                                        {skill.path.split(/[/\\]/).slice(-2).join("/")}
                                    </span>
                                    <button
                                        className="btn-ghost btn-skill-detail"
                                        onClick={() => {
                                            setSelectedSkill(skill);
                                            setShowSkillDetail(true);
                                        }}
                                    >
                                        <Eye size={12} strokeWidth={1.5} /> 详情
                                    </button>
                                </div>
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
                    <label className="form-label">
                        <span>可调用的 Agent</span>
                        <div className="perm-checkbox-group">
                            <label className="perm-checkbox">
                                <input
                                    type="checkbox"
                                    checked={newAllowAgents.includes("*")}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setNewAllowAgents(["*"]);
                                        } else {
                                            setNewAllowAgents(["main"]);
                                        }
                                    }}
                                />
                                <span>全部权限</span>
                            </label>
                            {!newAllowAgents.includes("*") && agents
                                .filter(a => a.name !== newName.trim() && a.name !== "main")
                                .map(a => (
                                    <label key={a.name} className="perm-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={newAllowAgents.includes(a.name)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setNewAllowAgents([...newAllowAgents, a.name]);
                                                } else {
                                                    setNewAllowAgents(newAllowAgents.filter(n => n !== a.name));
                                                }
                                            }}
                                        />
                                        <span>{a.name}</span>
                                    </label>
                                ))
                            }
                        </div>
                        <span className="form-hint">
                            {newAllowAgents.includes("*")
                                ? "可调用所有 Agent（包含未来新建的）"
                                : `已选 ${newAllowAgents.filter(n => n !== "main").length} 个 Agent（main 默认可回调）`}
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
                    {selectedAgent?.is_default ? (
                        <label className="form-label">
                            <span>可调用的 Agent</span>
                            <div className="perm-readonly">默认全部权限（main 不可修改）</div>
                        </label>
                    ) : (
                        <label className="form-label">
                            <span>可调用的 Agent</span>
                            <div className="perm-checkbox-group">
                                <label className="perm-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={newAllowAgents.includes("*")}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setNewAllowAgents(["*"]);
                                            } else {
                                                setNewAllowAgents(["main"]);
                                            }
                                        }}
                                    />
                                    <span>全部权限</span>
                                </label>
                                {!newAllowAgents.includes("*") && agents
                                    .filter(a => a.name !== selectedAgent?.name && a.name !== "main")
                                    .map(a => (
                                        <label key={a.name} className="perm-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={newAllowAgents.includes(a.name)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setNewAllowAgents([...newAllowAgents, a.name]);
                                                    } else {
                                                        setNewAllowAgents(newAllowAgents.filter(n => n !== a.name));
                                                    }
                                                }}
                                            />
                                            <span>{a.name}</span>
                                        </label>
                                    ))
                                }
                            </div>
                            <span className="form-hint">
                                {newAllowAgents.includes("*")
                                    ? "可调用所有 Agent"
                                    : `已选 ${newAllowAgents.length} 个 Agent`}
                            </span>
                        </label>
                    )}
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
                    <p style={{ color: "var(--text-secondary)", margin: "12px 0 8px" }}>
                        确定要删除 Agent <strong style={{ color: "var(--text-primary)" }}>{selectedAgent?.name}</strong> 吗？
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: "var(--text-warning, #ef4444)" }}>
                        <AlertTriangle size={16} /> <span>删除后不可恢复</span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
                        将同时删除 workspace 和所有会话记录，此操作无法撤销。
                    </p>
                    <div className="form-actions">
                        <button className="btn-secondary" onClick={() => setShowDelete(false)}>取消</button>
                        <button
                            className="btn-delete"
                            disabled={saving || agentDeleteCountdown > 0}
                            onClick={handleDelete}
                        >
                            {saving ? "删除中..." : agentDeleteCountdown > 0 ? `确认删除 (${agentDeleteCountdown}s)` : "确认删除"}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Session History Modal */}
            <Modal show={showHistory} onClose={() => setShowHistory(false)} title={`${historyAgent} — 历史会话`} maxWidth={580}>
                <div className="session-history-list">
                    {sessionsLoading ? (
                        <div className="session-loading">加载中...</div>
                    ) : sessions.length === 0 ? (
                        <div className="session-empty">没有历史会话</div>
                    ) : (
                        sessions.map((s) => (
                            <div key={s.id} className="session-card">
                                <div className="session-card-top">
                                    {renamingId === s.id ? (
                                        <div className="session-rename-input">
                                            <input
                                                type="text"
                                                value={renameValue}
                                                onChange={(e) => setRenameValue(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleRenameSession(s.id);
                                                    if (e.key === "Escape") setRenamingId(null);
                                                }}
                                                autoFocus
                                                placeholder="输入新名称..."
                                            />
                                            <button className="btn-ghost btn-sm" onClick={() => handleRenameSession(s.id)}>✓</button>
                                            <button className="btn-ghost btn-sm" onClick={() => setRenamingId(null)}>✕</button>
                                        </div>
                                    ) : (
                                        <div className="session-card-name">{s.name}</div>
                                    )}
                                    <div className="session-card-meta">
                                        <span>{formatTime(s.timestamp)}</span>
                                        <span>·</span>
                                        <span>{s.message_count} 条</span>
                                    </div>
                                </div>
                                {s.preview.length > 0 && (
                                    <div className="session-preview">
                                        {s.preview.map((p, i) => (
                                            <div key={i} className="session-preview-line">{p}</div>
                                        ))}
                                    </div>
                                )}
                                <div className="session-card-actions">
                                    <button
                                        className="btn-ghost btn-sm btn-delete-session"
                                        onClick={() => startDeleteSession(s.id)}
                                    >
                                        <Trash2 size={12} /> 删除
                                    </button>
                                    <div className="session-card-actions-right">
                                        <button
                                            className="btn-ghost btn-sm"
                                            onClick={() => { setRenamingId(s.id); setRenameValue(s.name); }}
                                        >
                                            <Pencil size={12} /> 重命名
                                        </button>
                                        <button
                                            className="btn-ghost btn-sm btn-open-session"
                                            onClick={() => handleOpenSession(s.session_key)}
                                        >
                                            <MessageCircle size={12} /> 打开会话
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Modal>

            {/* Delete Session Confirmation */}
            <Modal show={!!deleteSessionId} onClose={() => setDeleteSessionId(null)} title="删除会话" maxWidth={400}>
                <div style={{ padding: "8px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: "var(--text-warning, #ef4444)" }}>
                        <AlertTriangle size={16} /> <span>删除后不可恢复</span>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                        确定要删除此会话及其所有消息记录吗？此操作无法撤销。
                    </p>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                        <button className="btn-ghost" onClick={() => setDeleteSessionId(null)}>取消</button>
                        <button
                            className="btn-delete"
                            disabled={deleteCountdown > 0}
                            onClick={handleDeleteSession}
                        >
                            {deleteCountdown > 0 ? `确认删除 (${deleteCountdown}s)` : "确认删除"}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Skill Detail Modal */}
            <SkillDetailModal
                show={showSkillDetail}
                skill={selectedSkill}
                onClose={() => setShowSkillDetail(false)}
            />

            {/* Skill Marketplace Browser */}
            <SkillBrowser
                show={showMarketplace}
                onClose={() => setShowMarketplace(false)}
            />
        </motion.div>
    );
}
