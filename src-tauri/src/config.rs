use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Emitter;

/// Get the ACTUAL OpenClaw config directory that the gateway reads: ~/.openclaw/
/// This is different from crate::openclaw::get_openclaw_dir() which returns the sandbox path
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

/// Return the list of supported providers grouped by category
#[tauri::command]
pub fn get_providers() -> Vec<ProviderInfo> {
    vec![
        // ===== 🆓 免费注册 =====
        ProviderInfo {
            id: "nvidia".into(),
            name: "Nvidia (免费)".into(),
            category: "free".into(),
            base_url: "https://integrate.api.nvidia.com/v1".into(),
            register_url: "https://build.nvidia.com/explore/discover".into(),
            description: "免费注册，支持 Kimi K2.5、DeepSeek V3 等优质模型".into(),
            api_type: "openai-completions".into(),
            models: vec![
                ModelInfo { id: "kimi-k2.5".into(), name: "Kimi K2.5".into(), provider: "nvidia".into(), is_free: true, context_window: 262144, max_tokens: 32768 },
                ModelInfo { id: "deepseek-v3.2".into(), name: "DeepSeek V3.2".into(), provider: "nvidia".into(), is_free: true, context_window: 262144, max_tokens: 65536 },
                ModelInfo { id: "glm-4.7".into(), name: "GLM 4.7".into(), provider: "nvidia".into(), is_free: true, context_window: 202752, max_tokens: 16384 },
            ],
        },
        ProviderInfo {
            id: "openrouter".into(),
            name: "OpenRouter (免费额度)".into(),
            category: "free".into(),
            base_url: "https://openrouter.ai/api/v1".into(),
            register_url: "https://openrouter.ai/keys".into(),
            description: "免费注册，聚合多家模型，免费模型无限用".into(),
            api_type: "openai-completions".into(),
            models: vec![
                ModelInfo { id: "google/gemini-2.0-flash-exp:free".into(), name: "Gemini 2.0 Flash (免费)".into(), provider: "openrouter".into(), is_free: true, context_window: 1000000, max_tokens: 65536 },
                ModelInfo { id: "meta-llama/llama-4-maverick:free".into(), name: "Llama 4 Maverick (免费)".into(), provider: "openrouter".into(), is_free: true, context_window: 131072, max_tokens: 32768 },
                ModelInfo { id: "qwen/qwen3-235b-a22b:free".into(), name: "Qwen3 235B (免费)".into(), provider: "openrouter".into(), is_free: true, context_window: 262144, max_tokens: 65536 },
            ],
        },
        ProviderInfo {
            id: "groq".into(),
            name: "Groq (免费)".into(),
            category: "free".into(),
            base_url: "https://api.groq.com/openai/v1".into(),
            register_url: "https://console.groq.com/keys".into(),
            description: "免费注册，超快推理速度，适合编程".into(),
            api_type: "openai-completions".into(),
            models: vec![
                ModelInfo { id: "llama-3.3-70b-versatile".into(), name: "Llama 3.3 70B".into(), provider: "groq".into(), is_free: true, context_window: 131072, max_tokens: 32768 },
                ModelInfo { id: "gemma2-9b-it".into(), name: "Gemma2 9B".into(), provider: "groq".into(), is_free: true, context_window: 8192, max_tokens: 8192 },
            ],
        },
        // ===== 💳 主流 Coding Plan =====
        ProviderInfo {
            id: "bailian".into(),
            name: "阿里云百炼".into(),
            category: "paid".into(),
            base_url: "https://coding.dashscope.aliyuncs.com/v1".into(),
            register_url: "https://bailian.console.aliyun.com/".into(),
            description: "聚合多家顶级模型，支持 Qwen3/Kimi/GLM/MiniMax".into(),
            api_type: "openai-completions".into(),
            models: vec![
                ModelInfo { id: "qwen3.5-plus".into(), name: "Qwen3.5 Plus".into(), provider: "bailian".into(), is_free: false, context_window: 1000000, max_tokens: 65536 },
                ModelInfo { id: "qwen3-coder-plus".into(), name: "Qwen3 Coder Plus".into(), provider: "bailian".into(), is_free: false, context_window: 1000000, max_tokens: 65536 },
                ModelInfo { id: "qwen3-coder-next".into(), name: "Qwen3 Coder Next".into(), provider: "bailian".into(), is_free: false, context_window: 262144, max_tokens: 65536 },
                ModelInfo { id: "qwen3-max-2026-01-23".into(), name: "Qwen3 Max".into(), provider: "bailian".into(), is_free: false, context_window: 262144, max_tokens: 65536 },
                ModelInfo { id: "kimi-k2.5".into(), name: "Kimi K2.5".into(), provider: "bailian".into(), is_free: false, context_window: 262144, max_tokens: 32768 },
                ModelInfo { id: "glm-5".into(), name: "GLM 5".into(), provider: "bailian".into(), is_free: false, context_window: 202752, max_tokens: 16384 },
                ModelInfo { id: "glm-4.7".into(), name: "GLM 4.7".into(), provider: "bailian".into(), is_free: false, context_window: 202752, max_tokens: 16384 },
                ModelInfo { id: "MiniMax-M2.5".into(), name: "MiniMax M2.5".into(), provider: "bailian".into(), is_free: false, context_window: 204800, max_tokens: 131072 },
            ],
        },
        ProviderInfo {
            id: "bytedance".into(),
            name: "字节方舟".into(),
            category: "paid".into(),
            base_url: "https://ark.cn-beijing.volces.com/api/v3".into(),
            register_url: "https://www.volcengine.com/product/doubao".into(),
            description: "首月 ¥9.9，支持 Kimi K2.5、DeepSeek V3.2 等".into(),
            api_type: "openai-completions".into(),
            models: vec![
                ModelInfo { id: "doubao-kimi-k2.5".into(), name: "Kimi K2.5".into(), provider: "bytedance".into(), is_free: false, context_window: 262144, max_tokens: 32768 },
                ModelInfo { id: "doubao-deepseek-v3.2".into(), name: "DeepSeek V3.2".into(), provider: "bytedance".into(), is_free: false, context_window: 262144, max_tokens: 65536 },
            ],
        },
        ProviderInfo {
            id: "zhipu".into(),
            name: "智谱 GLM".into(),
            category: "paid".into(),
            base_url: "https://open.bigmodel.cn/api/paas/v4".into(),
            register_url: "https://open.bigmodel.cn/".into(),
            description: "GLM-4.7 / GLM-5 系列".into(),
            api_type: "openai-completions".into(),
            models: vec![
                ModelInfo { id: "glm-5".into(), name: "GLM 5".into(), provider: "zhipu".into(), is_free: false, context_window: 202752, max_tokens: 16384 },
                ModelInfo { id: "glm-4.7".into(), name: "GLM 4.7".into(), provider: "zhipu".into(), is_free: false, context_window: 202752, max_tokens: 16384 },
            ],
        },
        ProviderInfo {
            id: "deepseek".into(),
            name: "DeepSeek".into(),
            category: "paid".into(),
            base_url: "https://api.deepseek.com/v1".into(),
            register_url: "https://platform.deepseek.com/api_keys".into(),
            description: "按量付费，DeepSeek V3/R1 编程利器".into(),
            api_type: "openai-completions".into(),
            models: vec![
                ModelInfo { id: "deepseek-chat".into(), name: "DeepSeek V3".into(), provider: "deepseek".into(), is_free: false, context_window: 131072, max_tokens: 65536 },
                ModelInfo { id: "deepseek-reasoner".into(), name: "DeepSeek R1".into(), provider: "deepseek".into(), is_free: false, context_window: 131072, max_tokens: 65536 },
            ],
        },
        ProviderInfo {
            id: "openai".into(),
            name: "OpenAI".into(),
            category: "paid".into(),
            base_url: "https://api.openai.com/v1".into(),
            register_url: "https://platform.openai.com/api-keys".into(),
            description: "按量付费，GPT-4o / o3 系列".into(),
            api_type: "openai-completions".into(),
            models: vec![
                ModelInfo { id: "gpt-4o".into(), name: "GPT-4o".into(), provider: "openai".into(), is_free: false, context_window: 128000, max_tokens: 16384 },
                ModelInfo { id: "gpt-4o-mini".into(), name: "GPT-4o Mini".into(), provider: "openai".into(), is_free: false, context_window: 128000, max_tokens: 16384 },
                ModelInfo { id: "o3-mini".into(), name: "o3 Mini".into(), provider: "openai".into(), is_free: false, context_window: 128000, max_tokens: 65536 },
            ],
        },
        ProviderInfo {
            id: "kimi".into(),
            name: "Kimi Code (月之暗面)".into(),
            category: "paid".into(),
            base_url: "https://api.moonshot.cn/v1".into(),
            register_url: "https://platform.moonshot.cn/console/api-keys".into(),
            description: "Kimi 工具生态".into(),
            api_type: "openai-completions".into(),
            models: vec![
                ModelInfo { id: "moonshot-v1-128k".into(), name: "Kimi v1 128K".into(), provider: "kimi".into(), is_free: false, context_window: 131072, max_tokens: 32768 },
            ],
        },
    ]
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
    "mode": "replace",
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
      "token": "openclaw-launcher-local"
    }}
  }},
  "sandbox": {{
    "paths": [
      "{}"
    ]
  }}
}}"#,
        provider,
        effective_base_url,
        api_key,
        api_type,
        model_defs_json,
        full_model_id,
        models_map_json,
        workspace.to_string_lossy().replace('\\', "\\\\")
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

        // Replace the primary model in config
        let updated = replace_primary_model(&content, &model_id);
        std::fs::write(&config_path, &updated)
            .map_err(|e| format!("写入配置失败: {}", e))?;
    }

    let _ = app.emit("config-updated", serde_json::json!({
        "model": model_id,
    }));

    Ok(format!("✅ 默认模型已切换为: {}", model_id))
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
