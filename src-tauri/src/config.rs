use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Emitter;

/// Get the ACTUAL OpenClaw config directory that the gateway reads: ~/.openclaw/
/// This is different from crate::paths::get_openclaw_dir() which returns the sandbox path
fn get_user_openclaw_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let dir = home.join(".openclaw");
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建 .openclaw 目录失败: {}", e))?;
    Ok(dir)
}


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

    let has_key = content.contains("apiKey");
    let model = extract_json_value(&content, "primary");
    let provider = extract_first_provider(&content);

    Ok(CurrentConfig {
        has_api_key: has_key,
        provider,
        model,
        base_url: None,
    })
}

/// Save API key config — writes OpenClaw-compatible config
#[tauri::command]
pub fn save_api_config(
    app: tauri::AppHandle,
    provider: String,
    api_key: String,
    base_url: Option<String>,
    model: Option<String>,
) -> Result<String, String> {
    let openclaw_dir = get_user_openclaw_dir()?;

    // Get provider info
    let providers = get_providers();
    let provider_info = providers.iter().find(|p| p.id == provider);
    let effective_base_url = base_url.clone()
        .or_else(|| provider_info.map(|p| p.base_url.clone()))
        .unwrap_or_default();
    let api_type = provider_info.map(|p| p.api_type.as_str()).unwrap_or("openai-completions");

    // Determine model — add provider prefix: "provider/model-id"
    let selected_model = model.unwrap_or_else(|| {
        provider_info
            .and_then(|p| p.models.first())
            .map(|m| m.id.clone())
            .unwrap_or_default()
    });
    let full_model_id = format!("{}/{}", provider, selected_model);

    // Build model definitions JSON
    let model_defs: Vec<String> = provider_info
        .map(|p| &p.models)
        .unwrap_or(&vec![])
        .iter()
        .map(|m| {
            format!(
                r#"          {{
            "id": "{}",
            "name": "{}",
            "reasoning": false,
            "input": ["text"],
            "cost": {{ "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }},
            "contextWindow": {},
            "maxTokens": {}
          }}"#,
                m.id, m.name, m.context_window, m.max_tokens
            )
        })
        .collect();
    let model_defs_json = model_defs.join(",\n");

    // Build models map for agents.defaults.models
    let models_map: Vec<String> = provider_info
        .map(|p| &p.models)
        .unwrap_or(&vec![])
        .iter()
        .map(|m| format!("        \"{}/{}\": {{}}", provider, m.id))
        .collect();
    let models_map_json = models_map.join(",\n");

    // Workspace path
    let workspace = dirs::document_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default().join("Documents"))
        .join("OpenClaw-Projects");
    let _ = std::fs::create_dir_all(&workspace);

    // Write the full OpenClaw-compatible config
    // Use mode: "replace" so we fully overwrite any old model catalog
    let config_content = format!(
        r#"{{
  "models": {{
    "providers": {{
      "{}": {{
        "baseUrl": "{}",
        "apiKey": "{}",
        "api": "{}",
        "models": [
{}
        ]
      }}
    }}
  }},
  "agents": {{
    "defaults": {{
      "workspace": "{}",
      "model": {{
        "primary": "{}"
      }},
      "models": {{
{}
      }}
    }}
  }},
  "gateway": {{
    "mode": "local",
    "auth": {{
      "mode": "token",
      "token": "openclaw-launcher-local"
    }},
    "controlUi": {{
      "allowInsecureAuth": true,
      "dangerouslyDisableDeviceAuth": true
    }}
  }}
}}"#,
        provider,
        effective_base_url,
        api_key,
        api_type,
        model_defs_json,
        workspace.to_string_lossy().replace('\\', "\\\\"),
        full_model_id,
        models_map_json,
    );

    let config_path = openclaw_dir.join("openclaw.json");
    std::fs::write(&config_path, &config_content)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;

    // Also write agents/main/agent/models.json — this is where the agent reads its model catalog
    // Per docs: "Non-empty agent models.json apiKey/baseUrl win"
    let agent_dir = openclaw_dir.join("agents").join("main").join("agent");
    let _ = std::fs::create_dir_all(&agent_dir);
    let models_json = format!(r#"{{
  "providers": {{
    "{}": {{
      "baseUrl": "{}",
      "apiKey": "{}",
      "api": "{}",
      "models": [
{}
      ]
    }}
  }}
}}"#, provider, effective_base_url, api_key, api_type, model_defs_json);
    let models_path = agent_dir.join("models.json");
    let _ = std::fs::write(&models_path, &models_json);

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

/// Set the default model
#[tauri::command]
pub fn set_default_model(
    app: tauri::AppHandle,
    model_id: String,
) -> Result<String, String> {
    let openclaw_dir = get_user_openclaw_dir()?;
    let config_path = openclaw_dir.join("openclaw.json");

    if config_path.exists() {
        let content = std::fs::read_to_string(&config_path)
            .map_err(|e| format!("读取配置失败: {}", e))?;

        // Get current provider to build full model ID (provider/model_id)
        let current_provider = extract_first_provider(&content).unwrap_or_default();
        let full_model_id = if current_provider.is_empty() || model_id.starts_with(&format!("{}/", current_provider)) {
            model_id.clone()
        } else {
            format!("{}/{}", current_provider, model_id)
        };

        // Replace the primary model in config
        let updated = replace_primary_model(&content, &full_model_id);
        std::fs::write(&config_path, &updated)
            .map_err(|e| format!("写入配置失败: {}", e))?;

        let _ = app.emit("config-updated", serde_json::json!({
            "model": full_model_id,
        }));

        Ok(format!("✅ 默认模型已切换为: {}", full_model_id))
    } else {
        Err("配置文件不存在，请先配置 API Key".into())
    }
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

/// Reset config — delete openclaw.json and auth to simulate fresh install
#[tauri::command]
pub fn reset_config(app: tauri::AppHandle) -> Result<String, String> {
    let openclaw_dir = get_user_openclaw_dir()?;
    let config_path = openclaw_dir.join("openclaw.json");

    if config_path.exists() {
        std::fs::remove_file(&config_path)
            .map_err(|e| format!("删除配置失败: {}", e))?;
    }

    // Also remove agent models.json
    let models_path = openclaw_dir.join("agents").join("main").join("agent").join("models.json");
    if models_path.exists() {
        let _ = std::fs::remove_file(&models_path);
    }

    let _ = app.emit("config-updated", serde_json::json!({
        "provider": serde_json::Value::Null,
        "hasKey": false,
        "model": serde_json::Value::Null,
    }));

    Ok("✅ 配置已重置，请重新配置 API Key".to_string())
}

// ===== Helper functions =====

/// Replace "primary" model value in JSON content
fn replace_primary_model(content: &str, new_model: &str) -> String {
    // Find "primary": "xxx" and replace xxx
    if let Some(pos) = content.find("\"primary\"") {
        let after = &content[pos..];
        if let Some(colon) = after.find(':') {
            let value_start = &after[colon + 1..];
            if let Some(q1) = value_start.find('"') {
                if let Some(q2) = value_start[q1 + 1..].find('"') {
                    let abs_start = pos + colon + 1 + q1 + 1;
                    let abs_end = abs_start + q2;
                    let mut result = String::new();
                    result.push_str(&content[..abs_start]);
                    result.push_str(new_model);
                    result.push_str(&content[abs_end..]);
                    return result;
                }
            }
        }
    }
    content.to_string()
}

/// Extract a simple string value from JSON-like content by key
fn extract_json_value(content: &str, key: &str) -> Option<String> {
    let pattern = format!("\"{}\"", key);
    if let Some(pos) = content.find(&pattern) {
        let after = &content[pos + pattern.len()..];
        if let Some(colon_pos) = after.find(':') {
            let value_part = after[colon_pos + 1..].trim();
            if value_part.starts_with('"') {
                if let Some(end) = value_part[1..].find('"') {
                    return Some(value_part[1..end + 1].to_string());
                }
            }
        }
    }
    None
}

/// Extract the first provider name from models.providers
fn extract_first_provider(content: &str) -> Option<String> {
    // Look for "providers": { "xxx" pattern
    if let Some(pos) = content.find("\"providers\"") {
        let after = &content[pos + 11..];
        if let Some(brace) = after.find('{') {
            let inner = &after[brace + 1..];
            if let Some(q1) = inner.find('"') {
                if let Some(q2) = inner[q1 + 1..].find('"') {
                    return Some(inner[q1 + 1..q1 + 1 + q2].to_string());
                }
            }
        }
    }
    None
}
