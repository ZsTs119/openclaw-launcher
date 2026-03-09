// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/// OpenClaw setup orchestration.
///
/// Manages the full setup pipeline (download + install + config injection),
/// checks, config injection, preset skills, and reinstall.
/// This is the main entry point for `setup_openclaw` and `reinstall_environment` Tauri commands.

use tauri::Emitter;

use crate::environment;
use crate::paths;
use crate::download;
use crate::installer;

/// Check if OpenClaw source is already installed
#[tauri::command]
pub fn check_openclaw_exists() -> Result<bool, String> {
    let dir = paths::get_openclaw_dir()?;
    Ok(dir.join("package.json").exists())
}

/// Check if node_modules is fully installed
/// Requires both node_modules/.pnpm directory AND .install_complete marker
#[tauri::command]
pub fn check_node_modules_exists() -> Result<bool, String> {
    let dir = paths::get_openclaw_dir()?;
    let node_modules = dir.join("node_modules");
    let marker = node_modules.join(".install_complete");
    Ok(node_modules.exists() && node_modules.join(".pnpm").exists() && marker.exists())
}

/// Check if config has been injected
#[tauri::command]
pub fn check_config_exists() -> Result<bool, String> {
    let dir = paths::get_openclaw_dir()?;
    Ok(dir.join("openclaw.json").exists())
}

/// Inject default openclaw.json configuration with OpenRouter free models (non-destructive)
/// This enables "open and chat" without any API key setup
#[tauri::command]
pub fn inject_default_config(app: tauri::AppHandle) -> Result<String, String> {
    let openclaw_dir = paths::get_openclaw_dir()?;
    let config_path = openclaw_dir.join("openclaw.json");

    if config_path.exists() {
        // Migration: patch existing config to add dangerouslyDisableDeviceAuth if missing
        if let Ok(content) = std::fs::read_to_string(&config_path) {
            if !content.contains("dangerouslyDisableDeviceAuth") {
                let patched = if content.contains("\"controlUi\"") {
                    content.clone()
                } else if content.contains("\"gateway\"") {
                    let step1 = content.replace(
                        "\"auth\":",
                        "\"controlUi\": {\n      \"allowInsecureAuth\": true,\n      \"dangerouslyDisableDeviceAuth\": true\n    },\n    \"auth\":",
                    );
                    if !step1.contains("\"mode\": \"token\"") && step1.contains("\"token\": \"") {
                        step1.replace(
                            "\"auth\": {",
                            "\"auth\": {\n      \"mode\": \"token\",",
                        )
                    } else {
                        step1
                    }
                } else {
                    content.clone()
                };
                if patched != content {
                    let _ = std::fs::write(&config_path, &patched);
                    let _ = app.emit("setup-progress", serde_json::json!({
                        "stage": "config_migrate",
                        "message": "✅ 已自动修补配置：禁用设备签名校验",
                        "percent": 96
                    }));
                }
            }
        }
        return Ok("Config already exists (checked for migration)".to_string());
    }

    // Default workspace: ~/Documents/OpenClaw-Projects
    let workspace = dirs::document_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default().join("Documents"))
        .join("OpenClaw-Projects");

    let _ = std::fs::create_dir_all(&workspace);

    let config_content = format!(r#"{{
  // OpenClaw Launcher 自动生成的配置
  // 使用 OpenRouter 免费模型，开箱即用，无需 API Key
  "agents": {{
    "defaults": {{
      "models": [
        "openrouter/google/gemini-2.0-flash-exp:free",
        "openrouter/meta-llama/llama-4-maverick:free",
        "openrouter/microsoft/phi-4-reasoning:free",
        "openrouter/qwen/qwen3-235b-a22b:free"
      ]
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
  }},
  "sandbox": {{
    "paths": [
      "{}"
    ]
  }}
}}"#, workspace.to_string_lossy().replace('\\', "\\\\"));

    std::fs::write(&config_path, &config_content)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;

    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "config_inject",
        "message": format!("✅ 默认配置已生成，工作区: {}", workspace.display()),
        "percent": 96
    }));

    Ok(format!("Config created at: {}", config_path.display()))
}

/// Inject default models.json (kept for backwards compatibility, non-destructive)
#[tauri::command]
pub fn inject_default_models(app: tauri::AppHandle) -> Result<String, String> {
    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "models_inject",
        "message": "✅ 模型配置已就绪 (OpenRouter 免费模型，开箱即用！)",
        "percent": 97
    }));

    Ok("Models configured via openclaw.json".to_string())
}

/// Install preset skills into OpenClaw's skills directory
#[tauri::command]
pub fn install_preset_skills(app: tauri::AppHandle) -> Result<String, String> {
    let openclaw_dir = paths::get_openclaw_dir()?;
    let skills_dir = openclaw_dir.join("skills");

    if skills_dir.join("skill-creator").join("SKILL.md").exists()
        && skills_dir.join("skill-finder").join("SKILL.md").exists()
    {
        return Ok("Preset skills already installed".to_string());
    }

    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "install_skills",
        "message": "📦 正在安装预置技能包...",
        "percent": 98
    }));

    // Embedded skill content (compiled into binary)
    let skill_creator_md = include_str!("../../docs/skills/skill-creator/SKILL.md");
    let skill_finder_md = include_str!("../../docs/skills/skill-finder/SKILL.md");

    let creator_dir = skills_dir.join("skill-creator");
    let finder_dir = skills_dir.join("skill-finder");
    std::fs::create_dir_all(&creator_dir)
        .map_err(|e| format!("创建 skill-creator 目录失败: {}", e))?;
    std::fs::create_dir_all(&finder_dir)
        .map_err(|e| format!("创建 skill-finder 目录失败: {}", e))?;

    std::fs::write(creator_dir.join("SKILL.md"), skill_creator_md)
        .map_err(|e| format!("写入 skill-creator 失败: {}", e))?;
    std::fs::write(finder_dir.join("SKILL.md"), skill_finder_md)
        .map_err(|e| format!("写入 skill-finder 失败: {}", e))?;

    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "skills_done",
        "message": "✅ 预置技能包安装完成 (skill-creator + skill-finder)",
        "percent": 99
    }));

    Ok(format!("Preset skills installed at: {}", skills_dir.display()))
}

/// Full setup pipeline: download source + install deps + inject config + bundle skills
#[tauri::command]
pub async fn setup_openclaw(app: tauri::AppHandle) -> Result<String, String> {
    // Pre-check: Disk space (require 500MB)
    let sandbox = environment::get_sandbox_dir()?;
    match environment::check_disk_space(&sandbox, 500) {
        Ok(false) => {
            return Err("❌ 磁盘空间不足！OpenClaw 需要至少 500MB 可用空间。请清理磁盘后重试。".to_string());
        }
        _ => {} // Ok(true) or Err (can't determine) - proceed
    }

    // Pre-check: Path compatibility (Chinese username, long paths)
    if let Some(warning) = environment::check_path_compatibility(&sandbox) {
        let _ = app.emit("setup-progress", serde_json::json!({
            "stage": "path_warning",
            "message": warning,
            "percent": 2
        }));
    }

    #[cfg(target_os = "windows")]
    environment::enable_windows_long_paths();

    // Step 1: Ensure Node.js is ready
    if !environment::check_node_exists()? {
        environment::download_and_install_node(app.clone()).await?;
    }

    // Step 2: Download OpenClaw source
    download::download_openclaw_source(app.clone()).await?;

    // Step 3: Install npm dependencies
    installer::run_npm_install(app.clone()).await?;

    // Step 4: Inject default configs (non-destructive)
    inject_default_config(app.clone())?;
    inject_default_models(app.clone())?;

    // Step 5: Install preset skills
    install_preset_skills(app.clone())?;

    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "all_done",
        "message": "🎉 OpenClaw 安装完成！可以点击启动了！",
        "percent": 100
    }));

    Ok("OpenClaw setup completed successfully".to_string())
}

/// Clean up node_modules and re-run the full setup pipeline.
/// Used as a manual recovery mechanism when the user's environment is corrupted.
#[tauri::command]
pub async fn reinstall_environment(app: tauri::AppHandle) -> Result<String, String> {
    let openclaw_dir = paths::get_openclaw_dir()?;
    let node_modules = openclaw_dir.join("node_modules");

    if node_modules.exists() {
        let _ = app.emit("setup-progress", serde_json::json!({
            "stage": "cleanup",
            "message": "正在清理旧的依赖目录...",
            "percent": 5
        }));
        std::fs::remove_dir_all(&node_modules)
            .map_err(|e| format!("清理 node_modules 失败: {}", e))?;
    }

    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "cleanup",
        "message": "清理完成，开始重新安装...",
        "percent": 10
    }));

    setup_openclaw(app).await
}
