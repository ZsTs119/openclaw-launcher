// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
use std::path::PathBuf;
use crate::providers::{CurrentConfig, get_providers};
use tauri::Emitter;

/// Get the ACTUAL OpenClaw config directory that the gateway reads: ~/.openclaw/
/// This is different from crate::paths::get_openclaw_dir() which returns the sandbox path
pub fn get_user_openclaw_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let dir = home.join(".openclaw");
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建 .openclaw 目录失败: {}", e))?;
    Ok(dir)
}






/// Migrate the gateway config at ~/.openclaw/openclaw.json to ensure
/// device auth is disabled and auth mode is set correctly for local Launcher use.
/// This must target ~/.openclaw/ (get_user_openclaw_dir) because that's where
/// the gateway actually reads its config — NOT the sandbox engine directory.
#[tauri::command]
pub fn migrate_gateway_config() -> Result<String, String> {
    let openclaw_dir = get_user_openclaw_dir()?;
    let config_path = openclaw_dir.join("openclaw.json");

    if !config_path.exists() {
        return Ok("No config to migrate yet".to_string());
    }

    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置失败: {}", e))?;

    // Already has the fix? Skip.
    if content.contains("dangerouslyDisableDeviceAuth") {
        return Ok("Config already has device auth disabled".to_string());
    }

    // Patch the config
    let mut patched = content.clone();

    // Add controlUi block before "auth": in gateway section
    if patched.contains("\"gateway\"") && !patched.contains("\"controlUi\"") {
        patched = patched.replace(
            "\"auth\":",
            "\"controlUi\": {\n      \"allowInsecureAuth\": true,\n      \"dangerouslyDisableDeviceAuth\": true\n    },\n    \"auth\":",
        );
    }

    // Add auth.mode: "token" if missing
    if !patched.contains("\"mode\": \"token\"") && patched.contains("\"token\":") {
        patched = patched.replace(
            "\"auth\": {",
            "\"auth\": {\n      \"mode\": \"token\",",
        );
    }

    if patched != content {
        std::fs::write(&config_path, &patched)
            .map_err(|e| format!("写入配置失败: {}", e))?;
        return Ok("✅ 已修补网关配置：禁用设备签名校验".to_string());
    }

    Ok("Config unchanged".to_string())
}


/// Get current OpenClaw config status
#[tauri::command]
pub fn get_current_config() -> Result<CurrentConfig, String> {
    let openclaw_dir = get_user_openclaw_dir()?;
    let config_path = openclaw_dir.join("openclaw.json");

    if !config_path.exists() {
        return Ok(CurrentConfig {
            has_api_key: false,
            provider: None,
            model: None,
            base_url: None,
        });
    }

    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置失败: {}", e))?;
    let config: serde_json::Value = serde_json::from_str(&content)
        .unwrap_or(serde_json::json!({}));

    // Check if any provider has an apiKey
    let has_key = config.get("models")
        .and_then(|m| m.get("providers"))
        .and_then(|p| p.as_object())
        .map(|obj| obj.values().any(|v|
            v.get("apiKey").and_then(|k| k.as_str()).map(|s| !s.is_empty()).unwrap_or(false)
            || v.get("auth").is_some()
        ))
        .unwrap_or(false);

    // Get primary model — format is "provider/model-id"
    let primary = config.get("agents")
        .and_then(|a| a.get("defaults"))
        .and_then(|d| d.get("model"))
        .and_then(|m| m.get("primary"))
        .and_then(|p| p.as_str())
        .map(|s| s.to_string());

    // Extract provider from primary  (e.g. "bailian/glm-5" → "bailian")
    let provider = primary.as_ref()
        .and_then(|p| p.split('/').next())
        .map(|s| s.to_string());

    Ok(CurrentConfig {
        has_api_key: has_key,
        provider,
        model: primary,
        base_url: None,
    })
}

/// Save API key config — MERGES provider into existing openclaw.json
/// instead of replacing the entire file.
#[tauri::command]
pub fn save_api_config(
    app: tauri::AppHandle,
    provider: String,
    api_key: String,
    base_url: Option<String>,
    model: Option<String>,
) -> Result<String, String> {
    let openclaw_dir = get_user_openclaw_dir()?;
    let config_path = openclaw_dir.join("openclaw.json");

    // Get provider info from our built-in catalog
    let providers = get_providers();
    let provider_info = providers.iter().find(|p| p.id == provider);
    let effective_base_url = base_url.clone()
        .or_else(|| provider_info.map(|p| p.base_url.clone()))
        .unwrap_or_default();
    let api_type = provider_info.map(|p| p.api_type.as_str()).unwrap_or("openai-completions");

    // Determine model
    let selected_model = model.unwrap_or_else(|| {
        provider_info
            .and_then(|p| p.models.first())
            .map(|m| m.id.clone())
            .unwrap_or_default()
    });
    let full_model_id = format!("{}/{}", provider, selected_model);

    // Build the new provider entry as serde_json::Value
    let model_defs: Vec<serde_json::Value> = provider_info
        .map(|p| &p.models)
        .unwrap_or(&vec![])
        .iter()
        .map(|m| serde_json::json!({
            "id": m.id,
            "name": m.name,
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": m.context_window,
            "maxTokens": m.max_tokens,
        }))
        .collect();

    let new_provider_entry = serde_json::json!({
        "baseUrl": effective_base_url,
        "apiKey": api_key,
        "api": api_type,
        "models": model_defs,
    });

    // Read existing config or start fresh
    let mut config: serde_json::Value = if config_path.exists() {
        let content = std::fs::read_to_string(&config_path)
            .map_err(|e| format!("读取配置失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Ensure models.providers exists
    if config.get("models").is_none() {
        config["models"] = serde_json::json!({});
    }
    if config["models"].get("providers").is_none() {
        config["models"]["providers"] = serde_json::json!({});
    }

    // MERGE: add/update the provider (preserves all other providers)
    config["models"]["providers"][&provider] = new_provider_entry;

    // Set default model
    if config.get("agents").is_none() {
        config["agents"] = serde_json::json!({});
    }
    if config["agents"].get("defaults").is_none() {
        config["agents"]["defaults"] = serde_json::json!({});
    }
    config["agents"]["defaults"]["model"] = serde_json::json!({ "primary": full_model_id });

    // Add models to agents.defaults.models map (merge, don't replace)
    if config["agents"]["defaults"].get("models").is_none() {
        config["agents"]["defaults"]["models"] = serde_json::json!({});
    }
    if let Some(pi) = provider_info {
        for m in &pi.models {
            let key = format!("{}/{}", provider, m.id);
            config["agents"]["defaults"]["models"][&key] = serde_json::json!({});
        }
    }

    // Ensure workspace
    if config["agents"]["defaults"].get("workspace").is_none() {
        let workspace = dirs::document_dir()
            .unwrap_or_else(|| dirs::home_dir().unwrap_or_default().join("Documents"))
            .join("OpenClaw-Projects");
        let _ = std::fs::create_dir_all(&workspace);
        config["agents"]["defaults"]["workspace"] = serde_json::Value::String(
            workspace.to_string_lossy().to_string()
        );
    }

    // Ensure gateway config
    if config.get("gateway").is_none() {
        config["gateway"] = serde_json::json!({
            "mode": "local",
            "auth": {
                "mode": "token",
                "token": "openclaw-launcher-local"
            },
            "controlUi": {
                "allowInsecureAuth": true,
                "dangerouslyDisableDeviceAuth": true
            }
        });
    }

    // Write merged config
    let output = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("序列化失败: {}", e))?;
    std::fs::write(&config_path, &output)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;

    // Also MERGE into agents/main/agent/models.json
    let agent_dir = openclaw_dir.join("agents").join("main").join("agent");
    let _ = std::fs::create_dir_all(&agent_dir);
    let models_path = agent_dir.join("models.json");
    let mut agent_models: serde_json::Value = if models_path.exists() {
        let content = std::fs::read_to_string(&models_path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    if agent_models.get("providers").is_none() {
        agent_models["providers"] = serde_json::json!({});
    }
    agent_models["providers"][&provider] = serde_json::json!({
        "baseUrl": effective_base_url,
        "apiKey": api_key,
        "api": api_type,
        "models": model_defs,
    });
    let _ = std::fs::write(&models_path,
        serde_json::to_string_pretty(&agent_models).unwrap_or_default()
    );

    let _ = app.emit("config-updated", serde_json::json!({
        "provider": provider,
        "hasKey": true,
        "model": full_model_id,
    }));

    Ok(format!("✅ {} 配置已保存，模型: {}", 
        provider_info.map(|p| p.name.as_str()).unwrap_or(&provider),
        full_model_id
    ))
}

/// Set the default model using serde_json.
/// Also persists custom model IDs into the provider's models array.
#[tauri::command]
pub fn set_default_model(
    app: tauri::AppHandle,
    model_id: String,
) -> Result<String, String> {
    let openclaw_dir = get_user_openclaw_dir()?;
    let config_path = openclaw_dir.join("openclaw.json");

    if !config_path.exists() {
        return Err("配置文件不存在，请先配置 API Key".into());
    }

    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置失败: {}", e))?;
    let mut config: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析配置失败: {}", e))?;

    // Ensure the model_id has provider/ prefix
    let full_model_id = if model_id.contains('/') {
        model_id.clone()
    } else {
        let first_provider = config.get("models")
            .and_then(|m| m.get("providers"))
            .and_then(|p| p.as_object())
            .and_then(|obj| obj.keys().next().cloned())
            .unwrap_or_default();
        if first_provider.is_empty() {
            model_id.clone()
        } else {
            format!("{}/{}", first_provider, model_id)
        }
    };

    // Extract provider name and bare model id
    let parts: Vec<&str> = full_model_id.splitn(2, '/').collect();
    let (provider_name, bare_model_id) = if parts.len() == 2 {
        (parts[0], parts[1])
    } else {
        ("", full_model_id.as_str())
    };

    // Update agents.defaults.model.primary
    if config.get("agents").is_none() {
        config["agents"] = serde_json::json!({});
    }
    if config["agents"].get("defaults").is_none() {
        config["agents"]["defaults"] = serde_json::json!({});
    }
    config["agents"]["defaults"]["model"] = serde_json::json!({ "primary": full_model_id });

    // Add custom model to provider's models array if not already present
    if !provider_name.is_empty() {
        if let Some(provider_obj) = config
            .get_mut("models")
            .and_then(|m| m.get_mut("providers"))
            .and_then(|p| p.get_mut(provider_name))
        {
            let models_arr = provider_obj
                .get_mut("models")
                .and_then(|m| m.as_array_mut());

            if let Some(arr) = models_arr {
                let already_exists = arr.iter().any(|m|
                    m.get("id").and_then(|id| id.as_str()) == Some(bare_model_id)
                );
                if !already_exists {
                    arr.push(serde_json::json!({
                        "id": bare_model_id,
                        "name": bare_model_id,
                        "reasoning": false,
                        "input": ["text"],
                        "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
                        "contextWindow": 128000,
                        "maxTokens": 8192
                    }));
                }
            }
        }
    }

    // Add to agents.defaults.models map
    if config["agents"]["defaults"].get("models").is_none() {
        config["agents"]["defaults"]["models"] = serde_json::json!({});
    }
    config["agents"]["defaults"]["models"][&full_model_id] = serde_json::json!({});

    let output = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("序列化失败: {}", e))?;
    std::fs::write(&config_path, &output)
        .map_err(|e| format!("写入配置失败: {}", e))?;

    // Also update agents/main/agent/models.json
    let agent_dir = openclaw_dir.join("agents").join("main").join("agent");
    let models_path = agent_dir.join("models.json");
    if models_path.exists() {
        if let Ok(mc) = std::fs::read_to_string(&models_path) {
            if let Ok(mut agent_models) = serde_json::from_str::<serde_json::Value>(&mc) {
                if !provider_name.is_empty() {
                    if let Some(p) = agent_models.get_mut("providers")
                        .and_then(|p| p.get_mut(provider_name))
                    {
                        if let Some(arr) = p.get_mut("models").and_then(|m| m.as_array_mut()) {
                            let exists = arr.iter().any(|m|
                                m.get("id").and_then(|id| id.as_str()) == Some(bare_model_id)
                            );
                            if !exists {
                                arr.push(serde_json::json!({
                                    "id": bare_model_id,
                                    "name": bare_model_id,
                                    "reasoning": false,
                                    "input": ["text"],
                                    "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
                                    "contextWindow": 128000,
                                    "maxTokens": 8192
                                }));
                            }
                        }
                    }
                }
                let _ = std::fs::write(&models_path,
                    serde_json::to_string_pretty(&agent_models).unwrap_or_default()
                );
            }
        }
    }

    let _ = app.emit("config-updated", serde_json::json!({
        "model": full_model_id,
    }));

    Ok(format!("✅ 默认模型已切换为: {}", full_model_id))
}


/// Factory reset — uninstall openclaw, delete all data, re-run full setup
/// Frontend should: stopService → setPhase("initializing") → call this
#[tauri::command]
pub async fn factory_reset(app: tauri::AppHandle) -> Result<String, String> {
    let openclaw_dir = get_user_openclaw_dir()?;

    // 1. npm uninstall openclaw globally
    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "cleanup",
        "message": "正在卸载 OpenClaw...",
        "percent": 5
    }));

    let npm_cmd = if cfg!(target_os = "windows") { "npm.cmd" } else { "npm" };
    let _ = std::process::Command::new(npm_cmd)
        .args(["uninstall", "-g", "@anthropic-ai/openclaw"])
        .output();

    // 2. Delete entire ~/.openclaw/ directory (config, workspace, sessions, agents, etc.)
    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "cleanup",
        "message": "正在删除所有数据和配置...",
        "percent": 15
    }));

    if openclaw_dir.exists() {
        std::fs::remove_dir_all(&openclaw_dir)
            .map_err(|e| format!("删除 OpenClaw 数据目录失败: {}", e))?;
    }

    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "cleanup",
        "message": "清理完成，开始重新安装...",
        "percent": 20
    }));

    // 3. Re-run full setup pipeline (npm install + openclaw setup)
    crate::setup::setup_openclaw(app).await
}
