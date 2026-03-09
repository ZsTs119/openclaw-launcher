// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/// Provider data management.
///
/// Loads the provider catalog from providers.json
/// and exposes Tauri commands for provider queries and URL opening.

use serde::{Deserialize, Serialize};

/// Provider categories for the UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfo {
    pub id: String,
    pub name: String,
    pub category: String, // "free", "paid", "custom"
    pub base_url: String,
    pub register_url: String,
    pub description: String,
    pub api_type: String, // "openai-completions" etc.
    pub models: Vec<ModelInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub is_free: bool,
    pub context_window: u64,
    pub max_tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrentConfig {
    pub has_api_key: bool,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub base_url: Option<String>,
}

/// Return the list of supported providers (loaded from providers.json)
#[tauri::command]
pub fn get_providers() -> Vec<ProviderInfo> {
    let json_str = include_str!("../resources/providers.json");
    serde_json::from_str(json_str).unwrap_or_else(|e| {
        eprintln!("Failed to parse providers.json: {}", e);
        vec![]
    })
}

/// Open a provider's registration page
#[tauri::command]
pub fn open_provider_register(provider_id: String) -> Result<String, String> {
    let providers = get_providers();
    if let Some(provider) = providers.iter().find(|p| p.id == provider_id) {
        let _ = open::that(&provider.register_url);
        Ok(format!("已打开 {} 注册页面", provider.name))
    } else {
        Err(format!("未知的提供商: {}", provider_id))
    }
}

/// Open any URL in system browser
#[tauri::command]
pub fn open_url(url: String) -> Result<String, String> {
    open::that(&url).map_err(|e| format!("打开链接失败: {}", e))?;
    Ok(format!("已打开: {}", url))
}
