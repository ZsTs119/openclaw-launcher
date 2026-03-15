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
}

export interface AgentDetail {
    name: string;
    model: string | null;
    provider: string | null;
    system_prompt: string | null;
    has_sessions: boolean;
    is_default: boolean;
}

export interface SkillInfo {
    name: string;
    description: string;
    path: string;
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
