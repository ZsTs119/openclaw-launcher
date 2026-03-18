// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/**
 * Shared TypeScript type definitions for OpenClaw Launcher
 *
 * These types are the contract between the Tauri backend and
 * React frontend. Do NOT modify without updating both sides.
 */

// ===== App State =====
export type AppPhase = "checking" | "initializing" | "workspace" | "ready";
export type TabId = "dashboard" | "models" | "agents" | "analytics" | "settings";

// ===== Data Models =====
export interface LogEntry {
    time: string;
    level: string;
    message: string;
    humanized?: string;
}

export interface AgentInfo {
    name: string;
    model: string | null;
    has_sessions: boolean;
    is_default: boolean;
    model_valid: boolean;
}

export interface SessionInfo {
    id: string;
    session_key: string;
    name: string;
    timestamp: string;
    message_count: number;
    preview: string[];
    is_renamed: boolean;
}

export interface AgentDetail {
    name: string;
    model: string | null;
    provider: string | null;
    /** Raw model ref (e.g. "bailian/glm-5") for config round-trip */
    model_ref: string | null;
    system_prompt: string | null;
    has_sessions: boolean;
    is_default: boolean;
    is_supervisor: boolean;
}

export interface AvailableModel {
    provider: string;
    model_id: string;
    model_name: string;
    full_ref: string;
}

export interface SkillInfo {
    name: string;
    description: string;
    path: string;
}

export interface SavedProvider {
    name: string;
    base_url: string;
    api: string | null;
    has_api_key: boolean;
    model_count: number;
    models: SavedModel[];
}

export interface SavedModel {
    id: string;
    name: string | null;
}

export interface ProviderInfo {
    id: string;
    name: string;
    category: string;
    base_url: string;
    register_url: string;
    description: string;
    models: ModelInfo[];
}

export interface ModelInfo {
    id: string;
    name: string;
    provider: string;
    is_free: boolean;
}

export interface CurrentConfig {
    has_api_key: boolean;
    provider: string | null;
    model: string | null;
    base_url: string | null;
}

// ===== UI Constants =====
export const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
    free: { label: "免费注册", icon: "gift" },
    provider: { label: "Coding Plan", icon: "credit-card" },
    custom: { label: "自定义中转站", icon: "globe" },
};
