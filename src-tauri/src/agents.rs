// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::config::get_user_openclaw_dir;

// ─────────── Types ───────────

/// Info returned for each discovered agent
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentInfo {
    pub name: String,
    pub model: Option<String>,
    pub has_sessions: bool,
    pub is_default: bool,
    pub model_valid: bool,
}

/// Detail for a single agent
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentDetail {
    pub name: String,
    pub model: Option<String>,
    pub provider: Option<String>,
    /// Raw model ref (e.g. "bailian/glm-5") for config round-trip
    pub model_ref: Option<String>,
    pub system_prompt: Option<String>,
    pub has_sessions: bool,
    pub is_default: bool,
    pub is_supervisor: bool,
}

/// Available model for dropdown
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AvailableModel {
    pub provider: String,
    pub model_id: String,
    pub model_name: String,
    /// Full reference: "provider/model_id"
    pub full_ref: String,
}

/// Skill info parsed from SKILL.md frontmatter
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    pub path: String,
}

// ─────────── Helpers ───────────

fn agents_dir() -> Result<PathBuf, String> {
    let dir = get_user_openclaw_dir()?.join("agents");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("创建 agents 目录失败: {}", e))?;
    }
    Ok(dir)
}

fn skills_dir() -> Result<PathBuf, String> {
    let dir = get_user_openclaw_dir()?.join("skills");
    Ok(dir)
}

fn read_config() -> Result<serde_json::Value, String> {
    let path = get_user_openclaw_dir()?.join("openclaw.json");
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("读取 openclaw.json 失败: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("解析 openclaw.json 失败: {}", e))
}

fn write_config(value: &serde_json::Value) -> Result<(), String> {
    let path = get_user_openclaw_dir()?.join("openclaw.json");
    let content = serde_json::to_string_pretty(value)
        .map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("写入 openclaw.json 失败: {}", e))
}

/// Get workspace path for an agent (always uses "workspace-{name}" pattern, matching gateway)
fn workspace_path(name: &str) -> Result<PathBuf, String> {
    let base = get_user_openclaw_dir()?;
    Ok(base.join(format!("workspace-{}", name)))
}

/// Extract model ref (e.g. "bailian/glm-5") for an agent from openclaw.json agents.list[]
/// Returns (display_name, provider) — display_name is human-readable from models.providers
fn extract_model_from_config(config: &serde_json::Value, agent_id: &str) -> (Option<String>, Option<String>) {
    // Get the full model ref from agents.list[] or fall back to defaults
    let full_ref = config.get("agents")
        .and_then(|a| a.get("list"))
        .and_then(|l| l.as_array())
        .and_then(|arr| arr.iter().find(|a| a.get("id").and_then(|id| id.as_str()) == Some(agent_id)))
        .and_then(|entry| entry.get("model"))
        .and_then(|m| m.as_str())
        .or_else(|| {
            config.get("agents")
                .and_then(|a| a.get("defaults"))
                .and_then(|d| d.get("model"))
                .and_then(|m| m.get("primary"))
                .and_then(|p| p.as_str())
        })
        .map(|s| s.to_string());

    match full_ref {
        Some(ref fr) => {
            let parts: Vec<&str> = fr.splitn(2, '/').collect();
            if parts.len() == 2 {
                let provider = parts[0];
                let model_id = parts[1];
                // Look up human-readable name from models.providers
                let display_name = config.get("models")
                    .and_then(|m| m.get("providers"))
                    .and_then(|p| p.get(provider))
                    .and_then(|prov| prov.get("models"))
                    .and_then(|m| m.as_array())
                    .and_then(|arr| arr.iter().find(|m| m.get("id").and_then(|id| id.as_str()) == Some(model_id)))
                    .and_then(|m| m.get("name"))
                    .and_then(|n| n.as_str())
                    .unwrap_or(model_id)
                    .to_string();
                (Some(display_name), Some(provider.to_string()))
            } else {
                (Some(fr.clone()), None)
            }
        }
        None => (None, None),
    }
}

/// Extract system prompt from workspace SOUL.md (the gateway reads this, not agent.json)
fn extract_system_prompt(agent_name: &str) -> Option<String> {
    let ws = workspace_path(agent_name).ok()?;
    let soul_path = ws.join("SOUL.md");
    if !soul_path.exists() {
        return None;
    }
    let content = fs::read_to_string(&soul_path).ok()?;
    let trimmed = content.trim();
    if trimmed.is_empty() || trimmed == "# Persona\n\n<!-- Define the agent's personality, tone, and boundaries -->" {
        return None;
    }
    Some(content)
}

/// Check if a provider exists in the openclaw.json config
fn is_provider_valid(config: &serde_json::Value, provider_name: &str) -> bool {
    config.get("models")
        .and_then(|m| m.get("providers"))
        .and_then(|p| p.get(provider_name))
        .is_some()
}

/// Check if agent is a supervisor (allowAgents: ["*"]) from agents.list[]
fn is_agent_supervisor(config: &serde_json::Value, agent_id: &str) -> bool {
    config.get("agents")
        .and_then(|a| a.get("list"))
        .and_then(|l| l.as_array())
        .and_then(|arr| arr.iter().find(|a| a.get("id").and_then(|id| id.as_str()) == Some(agent_id)))
        .and_then(|a| a.get("subagents"))
        .and_then(|s| s.get("allowAgents"))
        .and_then(|aa| aa.as_array())
        .map(|arr| arr.iter().any(|v| v.as_str() == Some("*")))
        .unwrap_or(agent_id == "main") // main defaults to supervisor
}

/// Update model field in agents.list[] entry in openclaw.json
/// If agent is not in agents.list[], auto-add it
fn update_agent_model_in_config(agent_id: &str, model_ref: &str) -> Result<(), String> {
    let mut config = read_config()?;

    // Ensure agents.list exists
    if config.get("agents").is_none() {
        config["agents"] = serde_json::json!({});
    }
    if config["agents"].get("list").is_none() {
        config["agents"]["list"] = serde_json::json!([]);
    }

    let list = config["agents"]["list"].as_array_mut()
        .ok_or("agents.list 不是数组")?;

    let entry = list.iter_mut().find(|a|
        a.get("id").and_then(|id| id.as_str()) == Some(agent_id)
    );

    match entry {
        Some(entry) => {
            if model_ref.is_empty() {
                if let Some(obj) = entry.as_object_mut() {
                    obj.remove("model");
                }
            } else {
                entry["model"] = serde_json::Value::String(model_ref.to_string());
            }
        }
        None => {
            // Agent not in list — auto-add (handles agents created before config sync)
            let ws = workspace_path(agent_id)?;
            let mut new_entry = serde_json::json!({
                "id": agent_id,
                "workspace": ws.to_string_lossy(),
                "subagents": { "allowAgents": ["main"] }
            });
            if !model_ref.is_empty() {
                new_entry["model"] = serde_json::Value::String(model_ref.to_string());
            }
            list.push(new_entry);
        }
    }

    write_config(&config)
}

/// Create bootstrap files in a workspace directory
fn create_bootstrap_files(workspace: &PathBuf) -> Result<(), String> {
    fs::create_dir_all(workspace).map_err(|e| format!("创建 workspace 失败: {}", e))?;

    let files = [
        ("AGENTS.md", "# Agent Instructions\n\n<!-- Add operating instructions for this agent here -->\n"),
        ("SOUL.md", "# Persona\n\n<!-- Define the agent's personality, tone, and boundaries -->\n"),
        ("USER.md", "# User Profile\n\n<!-- Describe who you are and how the agent should address you -->\n"),
    ];

    for (name, default_content) in &files {
        let path = workspace.join(name);
        if !path.exists() {
            fs::write(&path, default_content)
                .map_err(|e| format!("创建 {} 失败: {}", name, e))?;
        }
    }

    Ok(())
}

/// Add an agent entry to agents.list[] in openclaw.json
fn add_to_agents_list(agent_id: &str, workspace: &str, is_supervisor: bool, model: Option<&str>) -> Result<(), String> {
    let mut config = read_config()?;

    // Ensure agents.list exists
    if config.get("agents").is_none() {
        config["agents"] = serde_json::json!({});
    }
    if config["agents"].get("list").is_none() {
        config["agents"]["list"] = serde_json::json!([]);
    }

    let list = config["agents"]["list"].as_array_mut()
        .ok_or("agents.list 不是数组")?;

    // Check if already exists
    let already_exists = list.iter().any(|a|
        a.get("id").and_then(|id| id.as_str()) == Some(agent_id)
    );

    if !already_exists {
        let allow_agents = if is_supervisor {
            serde_json::json!(["*"])
        } else {
            serde_json::json!(["main"])
        };

        let mut entry = serde_json::json!({
            "id": agent_id,
            "workspace": workspace,
            "subagents": {
                "allowAgents": allow_agents
            }
        });

        // Set model if specified (otherwise inherits agents.defaults.model.primary)
        if let Some(model_ref) = model {
            if !model_ref.is_empty() {
                entry["model"] = serde_json::Value::String(model_ref.to_string());
            }
        }

        list.push(entry);
    }

    write_config(&config)
}

/// Remove an agent entry from agents.list[] in openclaw.json
fn remove_from_agents_list(agent_id: &str) -> Result<(), String> {
    let mut config = read_config()?;

    if let Some(list) = config.get_mut("agents")
        .and_then(|a| a.get_mut("list"))
        .and_then(|l| l.as_array_mut())
    {
        list.retain(|a| a.get("id").and_then(|id| id.as_str()) != Some(agent_id));
    }

    write_config(&config)
}

/// Update an agent's permission in agents.list[]
fn update_agent_permission(agent_id: &str, is_supervisor: bool) -> Result<(), String> {
    let mut config = read_config()?;

    if let Some(list) = config.get_mut("agents")
        .and_then(|a| a.get_mut("list"))
        .and_then(|l| l.as_array_mut())
    {
        if let Some(entry) = list.iter_mut().find(|a|
            a.get("id").and_then(|id| id.as_str()) == Some(agent_id)
        ) {
            let allow_agents = if is_supervisor {
                serde_json::json!(["*"])
            } else {
                serde_json::json!(["main"])
            };
            entry["subagents"] = serde_json::json!({ "allowAgents": allow_agents });
        }
    }

    write_config(&config)
}

// ─────────── Tauri Commands ───────────

#[tauri::command]
pub fn list_agents() -> Result<Vec<AgentInfo>, String> {
    let dir = agents_dir()?;
    let config = read_config()?;
    let mut agents = Vec::new();

    let entries = fs::read_dir(&dir)
        .map_err(|e| format!("读取 agents 目录失败: {}", e))?;

    for entry in entries.flatten() {
        if !entry.path().is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let (model, provider) = extract_model_from_config(&config, &name);
        let has_sessions = entry.path().join("sessions").exists();

        // Check if the agent's provider still exists in config
        let model_valid = provider.as_ref()
            .map(|p| is_provider_valid(&config, p))
            .unwrap_or(true); // No model set = valid (just empty)

        agents.push(AgentInfo {
            is_default: name == "main",
            name,
            model,
            has_sessions,
            model_valid,
        });
    }

    // Sort: main first, then alphabetical
    agents.sort_by(|a, b| {
        if a.is_default { return std::cmp::Ordering::Less; }
        if b.is_default { return std::cmp::Ordering::Greater; }
        a.name.cmp(&b.name)
    });

    Ok(agents)
}

#[tauri::command]
pub fn get_agent_detail(name: String) -> Result<AgentDetail, String> {
    let dir = agents_dir()?;
    let agent_path = dir.join(&name);

    if !agent_path.exists() {
        return Err(format!("Agent '{}' 不存在", name));
    }

    let config = read_config()?;
    let (model, provider) = extract_model_from_config(&config, &name);
    // Get raw model ref for edit form dropdown pre-selection
    let model_ref = config.get("agents")
        .and_then(|a| a.get("list"))
        .and_then(|l| l.as_array())
        .and_then(|arr| arr.iter().find(|a| a.get("id").and_then(|id| id.as_str()) == Some(&name)))
        .and_then(|entry| entry.get("model"))
        .and_then(|m| m.as_str())
        .map(|s| s.to_string());
    let system_prompt = extract_system_prompt(&name);
    let has_sessions = agent_path.join("sessions").exists();
    let is_supervisor = is_agent_supervisor(&config, &name);

    Ok(AgentDetail {
        is_default: name == "main",
        name,
        model,
        provider,
        model_ref,
        system_prompt,
        has_sessions,
        is_supervisor,
    })
}

#[tauri::command]
pub fn create_agent(
    name: String,
    model: Option<String>,
    system_prompt: Option<String>,
    is_supervisor: Option<bool>,
) -> Result<(), String> {
    // Validate name
    let name_re = regex_lite::Regex::new(r"^[a-z0-9][a-z0-9-]{0,31}$").unwrap();
    if !name_re.is_match(&name) {
        return Err("Agent 名称只能包含小写字母、数字和连字符，1-32 字符".to_string());
    }
    if name == "main" {
        return Err("不能创建名为 'main' 的 Agent".to_string());
    }

    let dir = agents_dir()?;
    let agent_path = dir.join(&name);

    if agent_path.exists() {
        return Err(format!("Agent '{}' 已存在", name));
    }

    // 1. Create agent directory structure
    let agent_dir = agent_path.join("agent");
    fs::create_dir_all(&agent_dir).map_err(|e| format!("创建目录失败: {}", e))?;

    // 2. Create workspace with bootstrap files
    let ws = workspace_path(&name)?;
    create_bootstrap_files(&ws)?;

    // 3. Write system prompt to workspace SOUL.md (this is what the gateway reads)
    if let Some(prompt) = system_prompt {
        fs::write(
            ws.join("SOUL.md"),
            &prompt,
        ).map_err(|e| format!("写入系统提示词失败: {}", e))?;
    }

    // 4. Sync to openclaw.json agents.list[] (with model)
    let supervisor = is_supervisor.unwrap_or(false);
    add_to_agents_list(&name, &ws.to_string_lossy(), supervisor, model.as_deref())?;

    Ok(())
}

#[tauri::command]
pub fn update_agent(
    name: String,
    system_prompt: Option<String>,
    model: Option<String>,
    is_supervisor: Option<bool>,
) -> Result<(), String> {
    let dir = agents_dir()?;
    let agent_path = dir.join(&name);

    if !agent_path.exists() {
        return Err(format!("Agent '{}' 不存在", name));
    }

    let agent_dir = agent_path.join("agent");

    // Update system prompt → write to workspace SOUL.md
    if let Some(prompt) = system_prompt {
        let ws = workspace_path(&name)?;
        fs::create_dir_all(&ws).map_err(|e| format!("创建 workspace 失败: {}", e))?;
        fs::write(
            ws.join("SOUL.md"),
            &prompt,
        ).map_err(|e| format!("写入系统提示词失败: {}", e))?;
    }

    // Update model in agents.list[] (empty string = inherit default)
    if let Some(ref model_ref) = model {
        update_agent_model_in_config(&name, model_ref)?;
    }

    // Update permission
    if let Some(supervisor) = is_supervisor {
        update_agent_permission(&name, supervisor)?;
    }

    Ok(())
}

#[tauri::command]
pub fn delete_agent(name: String) -> Result<(), String> {
    if name == "main" {
        return Err("默认 Agent 'main' 不可删除".to_string());
    }

    let dir = agents_dir()?;
    let agent_path = dir.join(&name);

    if !agent_path.exists() {
        return Err(format!("Agent '{}' 不存在", name));
    }

    // 1. Delete agent directory (agents/<name>/)
    fs::remove_dir_all(&agent_path)
        .map_err(|e| format!("删除 Agent 目录失败: {}", e))?;

    // 2. Delete workspace (workspace-<name>/)
    let ws = workspace_path(&name)?;
    if ws.exists() {
        let _ = fs::remove_dir_all(&ws);
    }

    // 3. Remove from openclaw.json agents.list[]
    remove_from_agents_list(&name)?;

    Ok(())
}

/// List all available models from saved providers in openclaw.json
#[tauri::command]
pub fn list_available_models() -> Result<Vec<AvailableModel>, String> {
    let config = read_config()?;
    let mut models = Vec::new();

    if let Some(providers) = config.get("models")
        .and_then(|m| m.get("providers"))
        .and_then(|p| p.as_object())
    {
        for (provider_name, provider_obj) in providers {
            if let Some(model_arr) = provider_obj.get("models").and_then(|m| m.as_array()) {
                for model in model_arr {
                    let model_id = model.get("id")
                        .and_then(|id| id.as_str())
                        .unwrap_or_default()
                        .to_string();
                    let model_name = model.get("name")
                        .and_then(|n| n.as_str())
                        .unwrap_or(&model_id)
                        .to_string();

                    if !model_id.is_empty() {
                        models.push(AvailableModel {
                            full_ref: format!("{}/{}", provider_name, model_id),
                            provider: provider_name.clone(),
                            model_id,
                            model_name,
                        });
                    }
                }
            }
        }
    }

    Ok(models)
}

#[tauri::command]
pub fn list_skills() -> Result<Vec<SkillInfo>, String> {
    let dir = match skills_dir() {
        Ok(d) => d,
        Err(_) => return Ok(Vec::new()),
    };

    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut skills = Vec::new();

    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return Ok(Vec::new()),
    };

    for entry in entries.flatten() {
        if !entry.path().is_dir() {
            continue;
        }
        let skill_md = entry.path().join("SKILL.md");
        if !skill_md.exists() {
            continue;
        }

        let content = match fs::read_to_string(&skill_md) {
            Ok(c) => c,
            Err(_) => continue,
        };

        // Parse YAML frontmatter: ---\nname: ...\ndescription: ...\n---
        let mut skill_name = entry.file_name().to_string_lossy().to_string();
        let mut description = String::new();

        if content.starts_with("---") {
            if let Some(end) = content[3..].find("---") {
                let frontmatter = &content[3..3 + end];
                for line in frontmatter.lines() {
                    let line = line.trim();
                    if let Some(val) = line.strip_prefix("name:") {
                        skill_name = val.trim().trim_matches('"').trim_matches('\'').to_string();
                    } else if let Some(val) = line.strip_prefix("description:") {
                        description = val.trim().trim_matches('"').trim_matches('\'').to_string();
                    }
                }
            }
        }

        skills.push(SkillInfo {
            name: skill_name,
            description,
            path: entry.path().to_string_lossy().to_string(),
        });
    }

    skills.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(skills)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_name_validation() {
        let re = regex_lite::Regex::new(r"^[a-z0-9][a-z0-9-]{0,31}$").unwrap();
        assert!(re.is_match("main"));
        assert!(re.is_match("my-agent"));
        assert!(re.is_match("coder123"));
        assert!(!re.is_match(""));
        assert!(!re.is_match("-start"));
        assert!(!re.is_match("UPPER"));
        assert!(!re.is_match("has space"));
        assert!(!re.is_match(&"a".repeat(33)));
    }

    #[test]
    fn test_workspace_path_main() {
        let ws = workspace_path("main").unwrap();
        assert!(ws.to_string_lossy().ends_with("workspace"));
        assert!(!ws.to_string_lossy().ends_with("workspace-main"));
    }

    #[test]
    fn test_workspace_path_custom() {
        let ws = workspace_path("coder").unwrap();
        assert!(ws.to_string_lossy().ends_with("workspace-coder"));
    }

    #[test]
    fn test_model_ref_parsing() {
        let parts: Vec<&str> = "siliconflow/deepseek-ai/DeepSeek-V3".splitn(2, '/').collect();
        assert_eq!(parts.len(), 2);
        assert_eq!(parts[0], "siliconflow");
        assert_eq!(parts[1], "deepseek-ai/DeepSeek-V3");
    }
}
