// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::config::get_user_openclaw_dir;

/// Info returned for each discovered agent
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentInfo {
    pub name: String,
    pub model: Option<String>,
    pub has_sessions: bool,
    pub is_default: bool,
}

/// Detail for a single agent
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentDetail {
    pub name: String,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub system_prompt: Option<String>,
    pub has_sessions: bool,
    pub is_default: bool,
}

/// Skill info parsed from SKILL.md frontmatter
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    pub path: String,
}

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

/// Extract the primary model from an agent's models.json
fn extract_model_from_dir(agent_path: &PathBuf) -> (Option<String>, Option<String>) {
    let models_path = agent_path.join("agent").join("models.json");
    if !models_path.exists() {
        return (None, None);
    }
    let content = match fs::read_to_string(&models_path) {
        Ok(c) => c,
        Err(_) => return (None, None),
    };
    let json: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return (None, None),
    };

    // Try to find provider name
    let provider = json.get("providers")
        .and_then(|p| p.as_object())
        .and_then(|obj| obj.keys().next().map(|k| k.to_string()));

    // Try to find primary model from providers -> first -> models -> first -> id
    let model = json.get("providers")
        .and_then(|p| p.as_object())
        .and_then(|obj| obj.values().next())
        .and_then(|p| p.get("models"))
        .and_then(|m| m.as_array())
        .and_then(|arr| arr.first())
        .and_then(|m| m.get("id"))
        .and_then(|id| id.as_str())
        .map(|s| s.to_string());

    (model, provider)
}

/// Extract system prompt from agent.json (if exists)
fn extract_system_prompt(agent_path: &PathBuf) -> Option<String> {
    let agent_json = agent_path.join("agent").join("agent.json");
    if !agent_json.exists() {
        return None;
    }
    let content = fs::read_to_string(&agent_json).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    json.get("systemPrompt")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

// ─────────── Tauri Commands ───────────

#[tauri::command]
pub fn list_agents() -> Result<Vec<AgentInfo>, String> {
    let dir = agents_dir()?;
    let mut agents = Vec::new();

    let entries = fs::read_dir(&dir)
        .map_err(|e| format!("读取 agents 目录失败: {}", e))?;

    for entry in entries.flatten() {
        if !entry.path().is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let (model, _) = extract_model_from_dir(&entry.path());
        let has_sessions = entry.path().join("sessions").exists();

        agents.push(AgentInfo {
            is_default: name == "main",
            name,
            model,
            has_sessions,
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

    let (model, provider) = extract_model_from_dir(&agent_path);
    let system_prompt = extract_system_prompt(&agent_path);
    let has_sessions = agent_path.join("sessions").exists();

    Ok(AgentDetail {
        is_default: name == "main",
        name,
        model,
        provider,
        system_prompt,
        has_sessions,
    })
}

#[tauri::command]
pub fn create_agent(name: String, _model: Option<String>, system_prompt: Option<String>) -> Result<(), String> {
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

    // Create directory structure
    let agent_dir = agent_path.join("agent");
    fs::create_dir_all(&agent_dir).map_err(|e| format!("创建目录失败: {}", e))?;

    // Copy models.json from main agent as template (if exists)
    let main_models = dir.join("main").join("agent").join("models.json");
    let new_models = agent_dir.join("models.json");
    if main_models.exists() {
        fs::copy(&main_models, &new_models)
            .map_err(|e| format!("复制模型配置失败: {}", e))?;
    }

    // Write agent.json with system prompt if provided
    if let Some(prompt) = system_prompt {
        let agent_json = serde_json::json!({
            "systemPrompt": prompt
        });
        fs::write(
            agent_dir.join("agent.json"),
            serde_json::to_string_pretty(&agent_json).unwrap(),
        ).map_err(|e| format!("写入配置失败: {}", e))?;
    }

    // Write empty auth.json
    fs::write(agent_dir.join("auth.json"), "{}").ok();

    Ok(())
}

#[tauri::command]
pub fn update_agent(name: String, system_prompt: Option<String>) -> Result<(), String> {
    let dir = agents_dir()?;
    let agent_path = dir.join(&name);

    if !agent_path.exists() {
        return Err(format!("Agent '{}' 不存在", name));
    }

    let agent_dir = agent_path.join("agent");

    // Update agent.json with system prompt
    if let Some(prompt) = system_prompt {
        let agent_json_path = agent_dir.join("agent.json");
        let mut json: serde_json::Value = if agent_json_path.exists() {
            let content = fs::read_to_string(&agent_json_path)
                .map_err(|e| format!("读取配置失败: {}", e))?;
            serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
        } else {
            serde_json::json!({})
        };

        json["systemPrompt"] = serde_json::Value::String(prompt);
        fs::write(
            &agent_json_path,
            serde_json::to_string_pretty(&json).unwrap(),
        ).map_err(|e| format!("写入配置失败: {}", e))?;
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

    fs::remove_dir_all(&agent_path)
        .map_err(|e| format!("删除 Agent 失败: {}", e))?;

    Ok(())
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
        assert!(!re.is_match("a".repeat(33).as_str()));
    }
}
