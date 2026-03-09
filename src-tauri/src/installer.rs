// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/// OpenClaw dependency installation via pnpm.
///
/// Installs pnpm via npm, then runs `pnpm install` in the OpenClaw engine directory.
/// Automatically detects and uses Taobao registry mirror when npmjs.org is slow.

use std::path::PathBuf;
use std::process::Stdio;
use tauri::Emitter;

use crate::environment;
use crate::paths;
use crate::download;

/// On Windows, hide the CMD window when spawning child processes
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Run `pnpm install` using sandboxed Node.js
/// First installs pnpm via npm, then uses pnpm for proper workspace dependency resolution
/// Automatically sets Taobao registry mirror if main registry is slow
#[tauri::command]
pub async fn run_npm_install(app: tauri::AppHandle) -> Result<String, String> {
    let openclaw_dir = paths::get_openclaw_dir()?;
    if !openclaw_dir.join("package.json").exists() {
        return Err("OpenClaw 源码未找到，请先下载源码".to_string());
    }

    let node_modules = openclaw_dir.join("node_modules");
    let install_marker = node_modules.join(".install_complete");

    if node_modules.exists() {
        if node_modules.join(".pnpm").exists() && install_marker.exists() {
            return Ok("node_modules already installed (pnpm)".to_string());
        }
        let _ = app.emit("setup-progress", serde_json::json!({
            "stage": "npm_install",
            "message": "检测到不完整的依赖，正在自动清理后重新安装...",
            "percent": 86
        }));
        let _ = std::fs::remove_dir_all(&node_modules);
    }

    let node_bin = environment::get_node_binary()?;
    let npm_bin = environment::get_npm_binary()?;
    let node_dir = node_bin.parent().unwrap().to_path_buf();

    // Build PATH that includes sandboxed node directory
    let sandbox_path = if let Some(current_path) = std::env::var_os("PATH") {
        let mut paths = std::env::split_paths(&current_path).collect::<Vec<_>>();
        paths.insert(0, node_dir.clone());
        std::env::join_paths(paths).unwrap_or_default()
    } else {
        std::ffi::OsString::from(&node_dir)
    };

    // Test if default npm registry is reachable
    let use_mirror = !download::test_url_reachable("https://registry.npmjs.org/").await;

    // ===== Step 1: Install pnpm globally via npm =====
    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "npm_install",
        "message": "正在安装 pnpm 包管理器...",
        "percent": 87
    }));

    let mut pnpm_cmd = std::process::Command::new(&node_bin);
    pnpm_cmd.arg(&npm_bin)
        .arg("install")
        .arg("-g")
        .arg("pnpm")
        .current_dir(&openclaw_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("PATH", &sandbox_path);

    #[cfg(target_os = "windows")]
    pnpm_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    if use_mirror {
        pnpm_cmd.arg("--registry=https://registry.npmmirror.com");
    }

    let pnpm_output = pnpm_cmd.output()
        .map_err(|e| format!("安装 pnpm 失败: {}", e))?;

    if !pnpm_output.status.success() {
        let stderr = String::from_utf8_lossy(&pnpm_output.stderr);
        return Err(format!("安装 pnpm 失败:\n{}", stderr));
    }

    // ===== Step 2: Run pnpm install =====
    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "npm_install",
        "message": "正在安装 OpenClaw 依赖包 (这可能需要几分钟)...",
        "percent": 90
    }));

    // Find pnpm binary — first try `npm root -g`, then fall back to static paths
    let mut pnpm_cli: Option<PathBuf> = None;

    // Phase 1: Dynamic discovery via `npm root -g`
    {
        let mut root_cmd = std::process::Command::new(&node_bin);
        root_cmd.arg(&npm_bin).arg("root").arg("-g")
            .env("PATH", &sandbox_path);
        #[cfg(target_os = "windows")]
        root_cmd.creation_flags(0x08000000);

        if let Ok(output) = root_cmd.output() {
            if output.status.success() {
                let global_root = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let root_path = PathBuf::from(&global_root);
                let candidates = vec![
                    root_path.join("pnpm").join("bin").join("pnpm.cjs"),
                    root_path.join("pnpm").join("dist").join("pnpm.cjs"),
                ];
                pnpm_cli = candidates.into_iter().find(|p| p.exists());
            }
        }
    }

    // Phase 2: Static fallback paths
    if pnpm_cli.is_none() {
        let pnpm_candidates: Vec<PathBuf> = if cfg!(target_os = "windows") {
            vec![
                node_dir.join("node_modules").join("pnpm").join("bin").join("pnpm.cjs"),
                node_dir.join("node_modules").join("pnpm").join("dist").join("pnpm.cjs"),
                node_dir.join("lib").join("node_modules").join("pnpm").join("bin").join("pnpm.cjs"),
                node_dir.join("lib").join("node_modules").join("pnpm").join("dist").join("pnpm.cjs"),
                node_dir.join("pnpm.cmd"),
                node_dir.join("pnpm"),
            ]
        } else {
            vec![
                node_dir.join("..").join("lib").join("node_modules").join("pnpm").join("bin").join("pnpm.cjs"),
                node_dir.join("..").join("lib").join("node_modules").join("pnpm").join("dist").join("pnpm.cjs"),
                node_dir.join("pnpm"),
            ]
        };

        pnpm_cli = pnpm_candidates.iter().find(|p| p.exists()).cloned();
        if pnpm_cli.is_none() {
            let searched = pnpm_candidates.iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect::<Vec<_>>()
                .join("\n  ");
            return Err(format!("pnpm 安装成功但找不到 pnpm.cjs，已搜索:\n  {}", searched));
        }
    }

    let pnpm_cli = pnpm_cli.unwrap();

    let mut install_cmd = std::process::Command::new(&node_bin);
    install_cmd.arg(&pnpm_cli)
        .arg("install")
        .current_dir(&openclaw_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("PATH", &sandbox_path);

    #[cfg(target_os = "windows")]
    install_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    if use_mirror {
        let _ = app.emit("setup-progress", serde_json::json!({
            "stage": "npm_install",
            "message": "NPM 官方源连接慢，已切换淘宝镜像加速...",
            "percent": 91
        }));
        install_cmd.env("npm_config_registry", "https://registry.npmmirror.com");
    }

    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "npm_install",
        "message": "正在执行 pnpm install (请耐心等待)...",
        "percent": 92
    }));

    let output = install_cmd.output()
        .map_err(|e| format!("执行 pnpm install 失败: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);

        // ===== Auto-retry: clean node_modules and try once more =====
        let _ = app.emit("setup-progress", serde_json::json!({
            "stage": "npm_install",
            "message": "⚠️ 安装遇到问题，正在清理环境并重试...",
            "percent": 93
        }));

        let node_modules_retry = openclaw_dir.join("node_modules");
        let _ = std::fs::remove_dir_all(&node_modules_retry);

        let mut retry_cmd = std::process::Command::new(&node_bin);
        retry_cmd.arg(&pnpm_cli)
            .arg("install")
            .current_dir(&openclaw_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("PATH", &sandbox_path);

        #[cfg(target_os = "windows")]
        retry_cmd.creation_flags(0x08000000);

        if use_mirror {
            retry_cmd.env("npm_config_registry", "https://registry.npmmirror.com");
        }

        let retry_output = retry_cmd.output()
            .map_err(|e| format!("重试 pnpm install 失败: {}", e))?;

        if !retry_output.status.success() {
            let retry_stderr = String::from_utf8_lossy(&retry_output.stderr);
            return Err(format!(
                "pnpm install 失败 (已重试一次):\nstdout: {}\nstderr: {}\n\n重试 stderr: {}",
                stdout, stderr, retry_stderr
            ));
        }
    }

    // Verify node_modules was created
    if !openclaw_dir.join("node_modules").exists() {
        return Err("pnpm install 执行完毕但 node_modules 目录未创建".to_string());
    }

    // Write .install_complete marker
    let marker_path = openclaw_dir.join("node_modules").join(".install_complete");
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "unknown".to_string());
    let _ = std::fs::write(&marker_path, format!(
        "installed_at={}\npnpm=true\n",
        timestamp
    ));

    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "npm_done",
        "message": "✅ 所有依赖安装完成！",
        "percent": 98
    }));

    Ok("npm install completed successfully".to_string())
}
