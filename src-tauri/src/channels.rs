// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// Phase 9: Platform Integration — WeChat + Feishu binding/unbinding

use serde::Serialize;
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Mutex;
use tauri::Emitter;

use crate::config::get_user_openclaw_dir;

// ──────────────────────────────── Types ────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct ChannelStatus {
    pub id: String,
    pub name: String,
    pub bound: bool,
    pub bind_mode: String,   // "qrcode" | "token" | "manual"
    pub available: bool,     // true for wechat/feishu, false for coming-soon
    pub bound_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BindingProgress {
    pub status: String,      // "pending" | "qr_ready" | "success" | "expired" | "error"
    pub qr_url: Option<String>,
    pub message: Option<String>,
}

// ──────────────────────────────── Global state ─────────────────────────

lazy_static::lazy_static! {
    static ref BINDING_PIDS: Mutex<HashMap<String, u32>> = Mutex::new(HashMap::new());
    static ref BINDING_QR_URLS: Mutex<HashMap<String, String>> = Mutex::new(HashMap::new());
}

// ──────────────────────────────── Platform registry ───────────────────

struct PlatformDef {
    id: &'static str,
    name: &'static str,
    install_cmd: &'static str,
    config_key: &'static str,
    plugin_id: &'static str,  // OpenClaw gateway plugin ID for plugins.allow
    bind_mode: &'static str,
    available: bool,
}

const PLATFORMS: &[PlatformDef] = &[
    PlatformDef {
        id: "wechat",
        name: "微信",
        install_cmd: "@tencent-weixin/openclaw-weixin-cli@latest install",
        config_key: "wechat",
        plugin_id: "openclaw-weixin",
        bind_mode: "qrcode",
        available: true,
    },
    PlatformDef {
        id: "feishu",
        name: "飞书",
        install_cmd: "@larksuite/openclaw-lark install",
        config_key: "feishu",
        plugin_id: "openclaw-lark",
        bind_mode: "qrcode",
        available: true,
    },
    PlatformDef {
        id: "telegram",
        name: "Telegram",
        install_cmd: "",
        config_key: "telegram",
        plugin_id: "",
        bind_mode: "token",
        available: false,
    },
    PlatformDef {
        id: "discord",
        name: "Discord",
        install_cmd: "",
        config_key: "discord",
        plugin_id: "",
        bind_mode: "token",
        available: false,
    },
    PlatformDef {
        id: "qq",
        name: "QQ",
        install_cmd: "",
        config_key: "qq",
        plugin_id: "",
        bind_mode: "manual",
        available: false,
    },
];

fn find_platform(id: &str) -> Result<&'static PlatformDef, String> {
    PLATFORMS
        .iter()
        .find(|p| p.id == id)
        .ok_or_else(|| format!("未知平台: {}", id))
}

// ──────────────────────────────── Config helpers ──────────────────────

fn read_config() -> Result<serde_json::Value, String> {
    let path = get_user_openclaw_dir()?.join("openclaw.json");
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取 openclaw.json 失败: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("解析 openclaw.json 失败: {}", e))
}

fn write_config(value: &serde_json::Value) -> Result<(), String> {
    let path = get_user_openclaw_dir()?.join("openclaw.json");
    let content = serde_json::to_string_pretty(value)
        .map_err(|e| format!("序列化失败: {}", e))?;
    std::fs::write(&path, content)
        .map_err(|e| format!("写入 openclaw.json 失败: {}", e))
}

fn is_channel_bound(config: &serde_json::Value, config_key: &str) -> bool {
    config
        .get("channels")
        .and_then(|c| c.get(config_key))
        .map(|v| !v.is_null() && v.as_object().map_or(false, |o| !o.is_empty()))
        .unwrap_or(false)
}

fn get_bound_at(config: &serde_json::Value, config_key: &str) -> Option<String> {
    config
        .get("channels")
        .and_then(|c| c.get(config_key))
        .and_then(|v| v.get("boundAt"))
        .and_then(|b| b.as_str())
        .map(|s| s.to_string())
}

// ──────────────────────────────── Commands ────────────────────────────

/// Check Node.js version (>= 22 required).
/// Tries sandbox node first (consistent with service), then system PATH.
#[tauri::command]
pub fn check_node_version() -> Result<String, String> {
    // Prefer sandbox node (same as start_service uses)
    let node_cmd = crate::environment::get_node_binary()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| "node".to_string());

    let output = std::process::Command::new(&node_cmd)
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|_| "Node.js 未安装，请先安装 Node.js 22+".to_string())?;

    if !output.status.success() {
        return Err("Node.js 版本检测失败".to_string());
    }

    let version_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    // Parse "v22.x.x" → 22
    let major: u32 = version_str
        .trim_start_matches('v')
        .split('.')
        .next()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    if major < 22 {
        return Err(format!(
            "Node.js 版本 {} 过低，需要 22+",
            version_str
        ));
    }

    Ok(version_str)
}

/// Get binding status of all platforms
#[tauri::command]
pub fn get_channel_status() -> Result<Vec<ChannelStatus>, String> {
    let config = read_config()?;

    let statuses: Vec<ChannelStatus> = PLATFORMS
        .iter()
        .map(|p| {
            let bound = is_channel_bound(&config, p.config_key);
            ChannelStatus {
                id: p.id.to_string(),
                name: p.name.to_string(),
                bound,
                bind_mode: p.bind_mode.to_string(),
                available: p.available,
                bound_at: if bound {
                    get_bound_at(&config, p.config_key)
                } else {
                    None
                },
            }
        })
        .collect();

    Ok(statuses)
}

/// Start binding process: spawn CLI, then tail `openclaw logs --json` for the QR URL.
///
/// The CLI tools output ASCII art QR codes to stdout (not parseable URLs).
/// The actual QR URL is logged via OpenClaw's logger as `二维码链接: <url>`.
/// We read it from `openclaw logs --json` which streams structured log entries.
#[tauri::command]
pub async fn start_channel_binding(app: tauri::AppHandle, platform: String) -> Result<String, String> {
    let pdef = find_platform(&platform)?;

    if !pdef.available {
        return Err(format!("{} 暂不支持绑定", pdef.name));
    }

    // Check if already binding
    {
        let pids = BINDING_PIDS.lock().unwrap();
        if pids.contains_key(&platform) {
            return Err("绑定进程已在运行".to_string());
        }
    }

    // Fallback: ensure plugins.allow is set even if gateway was started externally.
    // If config was just modified, the running gateway won't pick it up until restart,
    // but we still inject it so the CLI tool can register with the gateway.
    let plugins_just_injected = ensure_plugins_allowed();
    if plugins_just_injected {
        let _ = app.emit("binding-progress", serde_json::json!({
            "platform": platform,
            "stage": "plugins_injected",
            "message": "已自动配置插件权限",
        }));
    }

    let _ = app.emit("binding-progress", serde_json::json!({
        "platform": platform,
        "stage": "preparing",
        "message": "正在准备 CLI 工具...",
    }));

    // Try sandbox cached CLI first, fallback to npx
    let node_bin = crate::environment::get_node_binary()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| "node".to_string());

    let cli_dir = crate::environment::get_channel_cli_dir().ok();

    // Resolve the actual JS entry point (not .cmd/.sh wrappers — those break in Tauri sandbox)
    let cli_js_entry = cli_dir.as_ref().and_then(|dir| {
        let (pkg_name, bin_key) = match platform.as_str() {
            "wechat" => ("weixin-installer", "weixin-installer"),
            "feishu" => ("@larksuite/openclaw-lark", "openclaw-lark"),
            _ => return None,
        };
        // Read the package's package.json to find the real JS file
        let pkg_dir = if pkg_name.starts_with('@') {
            // Scoped package: @scope/name -> node_modules/@scope/name
            let parts: Vec<&str> = pkg_name.splitn(2, '/').collect();
            dir.join("node_modules").join(parts[0]).join(parts[1])
        } else {
            dir.join("node_modules").join(pkg_name)
        };
        let pkg_json_path = pkg_dir.join("package.json");
        if !pkg_json_path.exists() { return None; }

        let pkg_json: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(&pkg_json_path).ok()?
        ).ok()?;

        // Get the bin entry: "bin": { "name": "./path/to/file.js" } or "bin": "./path.js"
        let bin_file = match pkg_json.get("bin") {
            Some(serde_json::Value::Object(map)) => {
                map.get(bin_key)?.as_str().map(|s| s.to_string())
            }
            Some(serde_json::Value::String(s)) => Some(s.clone()),
            _ => None,
        }?;

        let js_path = pkg_dir.join(&bin_file);
        if js_path.exists() { Some(js_path) } else { None }
    });

    // Build PATH that includes:
    // 1. Sandboxed node directory
    // 2. channel-cli's .bin directory
    // 3. Directory containing the `openclaw` binary (CLI tools need it for gateway discovery)
    // 4. System PATH
    let sandbox_path = {
        let mut paths = vec![];
        // Add sandboxed node directory
        if let Ok(node_bin) = crate::environment::get_node_binary() {
            if let Some(node_dir) = node_bin.parent() {
                paths.push(node_dir.to_path_buf());
            }
        }
        // Add channel-cli's .bin directory
        if let Some(ref dir) = cli_dir {
            paths.push(dir.join("node_modules").join(".bin"));
        }
        // Find and add the directory containing the `openclaw` binary
        if let Some(oc_dir) = find_openclaw_bin_dir() {
            paths.push(oc_dir);
        }
        // Append system PATH
        if let Some(current) = std::env::var_os("PATH") {
            paths.extend(std::env::split_paths(&current));
        }
        std::env::join_paths(paths).unwrap_or_default()
    };

    // Read the actual gateway port (may not be 18789 if port was in use)
    let gateway_port = crate::service::GATEWAY_PORT.load(std::sync::atomic::Ordering::SeqCst);

    // Spawn CLI process (triggers QR generation in the gateway)
    let child = if let Some(js_path) = cli_js_entry {
        let _ = app.emit("binding-progress", serde_json::json!({
            "platform": platform,
            "stage": "starting",
            "message": "正在启动绑定...",
        }));
        // Run the JS entry directly with sandboxed node (bypasses .cmd/.sh wrappers)
        let mut cmd = tokio::process::Command::new(&node_bin);
        cmd.arg(js_path.to_string_lossy().to_string())
            .arg("install")
            .env("PATH", &sandbox_path)
            .env("OPENCLAW_PORT", gateway_port.to_string())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(target_os = "windows")]
        {
            #[allow(unused_imports)]
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }
        cmd.spawn()
            .map_err(|e| format!("启动 CLI 失败: {}", e))?
    } else {
        let _ = app.emit("binding-progress", serde_json::json!({
            "platform": platform,
            "stage": "downloading",
            "message": "正在下载 CLI 工具（首次使用）...",
        }));
        let npx_cmd = if cfg!(target_os = "windows") { "npx.cmd" } else { "npx" };
        let mut args: Vec<&str> = vec!["-y"];
        for part in pdef.install_cmd.split_whitespace() {
            args.push(part);
        }
        let mut cmd = tokio::process::Command::new(npx_cmd);
        cmd.args(&args)
            .env("PATH", &sandbox_path)
            .env("OPENCLAW_PORT", gateway_port.to_string())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }
        cmd.spawn()
            .map_err(|e| format!("启动 npx 失败: {}", e))?
    };

    let _ = app.emit("binding-progress", serde_json::json!({
        "platform": platform,
        "stage": "waiting_qr",
        "message": "正在生成二维码...",
    }));

    // Track child PID
    let child_id = child.id();
    if let Some(pid) = child_id {
        let mut procs = BINDING_PIDS.lock().unwrap();
        procs.insert(platform.clone(), pid);
    }

    // ── Strategy: try TWO sources for the QR URL ──
    // Source 1: CLI process output (stdout + stderr) — some CLIs print the URL directly
    // Source 2: Gateway log file — the gateway always logs "二维码链接: <url>"
    //
    // We race both sources. Also capture CLI stderr for error reporting.

    let qr_url_regex = regex_lite::Regex::new(r"二维码链接:\s*(https?://\S+)").unwrap();
    let url_regex = regex_lite::Regex::new(r"https?://\S+").unwrap();

    // Source 1: Wait for CLI process and scan its output
    let cli_regex = qr_url_regex.clone();
    let cli_url_regex = url_regex.clone();
    let cli_platform = platform.clone();
    let cli_app = app.clone();
    let cli_handle = tokio::spawn(async move {
        let output = child.wait_with_output().await;
        match output {
            Ok(out) => {
                let stdout_str = String::from_utf8_lossy(&out.stdout);
                let stderr_str = String::from_utf8_lossy(&out.stderr);
                let combined = format!("{}\n{}", stdout_str, stderr_str);

                // Emit stderr for diagnostics
                if !stderr_str.is_empty() {
                    let snippet: String = stderr_str.chars().take(300).collect();
                    let _ = cli_app.emit("binding-progress", serde_json::json!({
                        "platform": cli_platform,
                        "stage": "cli_output",
                        "message": format!("CLI: {}", snippet),
                    }));
                }

                // Search for QR URL in CLI output
                if let Some(caps) = cli_regex.captures(&combined) {
                    if let Some(url_match) = caps.get(1) {
                        return (Some(url_match.as_str().to_string()), None);
                    }
                }
                // Fallback: any URL in output
                if let Some(mat) = cli_url_regex.find(&combined) {
                    let url = mat.as_str().to_string();
                    if url.contains("weixin.qq.com") || url.contains("feishu") || url.contains("lark") {
                        return (Some(url), None);
                    }
                }

                // CLI exited without QR URL — report error
                let exit_code = out.status.code().unwrap_or(-1);
                if !out.status.success() {
                    let err_msg: String = stderr_str.chars().take(200).collect();
                    return (None, Some(format!("CLI 退出码 {} : {}", exit_code, err_msg)));
                }
                (None, None)
            }
            Err(e) => (None, Some(format!("CLI 进程异常: {}", e))),
        }
    });

    // Source 2: Tail the gateway log file for QR URL
    let today = {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let days = (now / 86400) as i64;
        let (year, month, day) = civil_from_days(days);
        format!("{:04}-{:02}-{:02}", year, month, day)
    };
    let log_filename = format!("openclaw-{}.log", today);
    let log_path = get_openclaw_log_dir().join(&log_filename);

    let initial_size = std::fs::metadata(&log_path)
        .map(|m| m.len())
        .unwrap_or(0);

    let log_regex = qr_url_regex.clone();
    let log_path_clone = log_path.clone();
    let log_handle = tokio::spawn(async move {
        if !log_path_clone.exists() {
            // Wait a few seconds for log file to be created
            tokio::time::sleep(std::time::Duration::from_secs(3)).await;
            if !log_path_clone.exists() {
                return None;
            }
        }
        let mut last_pos = initial_size;
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            let current_size = tokio::fs::metadata(&log_path_clone).await
                .map(|m| m.len())
                .unwrap_or(0);
            if current_size <= last_pos {
                continue;
            }
            let mut file = match tokio::fs::File::open(&log_path_clone).await {
                Ok(f) => f,
                Err(_) => continue,
            };
            use tokio::io::{AsyncReadExt, AsyncSeekExt};
            if file.seek(std::io::SeekFrom::Start(last_pos)).await.is_err() {
                continue;
            }
            let mut buf = vec![0u8; (current_size - last_pos) as usize];
            if file.read_exact(&mut buf).await.is_err() {
                continue;
            }
            last_pos = current_size;
            let text = String::from_utf8_lossy(&buf);
            for line in text.lines() {
                if let Some(caps) = log_regex.captures(line) {
                    if let Some(url_match) = caps.get(1) {
                        return Some(url_match.as_str().to_string());
                    }
                }
            }
        }
    });

    // Race: wait for either source to find the QR URL, with 120s overall timeout
    let found_url: Option<String> = tokio::time::timeout(
        std::time::Duration::from_secs(120),
        async {
            // Wait for CLI process first (it usually finishes faster)
            let cli_result = cli_handle.await;
            match cli_result {
                Ok((Some(url), _)) => return Some(url),
                Ok((None, Some(err))) => {
                    // CLI failed with error — emit for diagnostics
                    let _ = app.emit("binding-progress", serde_json::json!({
                        "platform": platform,
                        "stage": "cli_output",
                        "message": err,
                    }));
                }
                _ => {}
            }
            // CLI didn't find URL — wait for log file (30s extra)
            match tokio::time::timeout(
                std::time::Duration::from_secs(30),
                log_handle,
            ).await {
                Ok(Ok(Some(url))) => Some(url),
                _ => None,
            }
        },
    ).await
    .unwrap_or(None);

    match found_url {
        Some(url) => {
            let _ = app.emit("binding-progress", serde_json::json!({
                "platform": platform,
                "stage": "qr_ready",
                "message": "二维码已生成，请扫码",
            }));
            let mut urls = BINDING_QR_URLS.lock().unwrap();
            urls.insert(platform.clone(), url.clone());
            Ok(url)
        }
        None => {
            let cmd_hint = format!("npx -y {} ", pdef.install_cmd);
            Err(format!("未能提取二维码链接。请在终端执行：{}", cmd_hint))
        }
    }
}

/// Poll binding result: check if config changed (process tracked via events now)
#[tauri::command]
pub fn poll_binding_result(platform: String) -> Result<BindingProgress, String> {
    let pdef = find_platform(&platform)?;

    // Check config for successful binding
    let config = read_config()?;
    if is_channel_bound(&config, pdef.config_key) {
        cleanup_binding(&platform);
        return Ok(BindingProgress {
            status: "success".to_string(),
            qr_url: None,
            message: Some(format!("{} 绑定成功！", pdef.name)),
        });
    }

    // Check if process is still alive via pid
    let pids = BINDING_PIDS.lock().unwrap();
    if let Some(&pid) = pids.get(&platform) {
        // Check if process is still running
        let still_running = is_pid_alive(pid);
        if still_running {
            let urls = BINDING_QR_URLS.lock().unwrap();
            Ok(BindingProgress {
                status: "pending".to_string(),
                qr_url: urls.get(&platform).cloned(),
                message: Some("等待扫码...".to_string()),
            })
        } else {
            drop(pids);
            // Process ended, re-check config
            let config2 = read_config()?;
            if is_channel_bound(&config2, pdef.config_key) {
                cleanup_binding(&platform);
                return Ok(BindingProgress {
                    status: "success".to_string(),
                    qr_url: None,
                    message: Some(format!("{} 绑定成功！", pdef.name)),
                });
            }
            cleanup_binding(&platform);
            Ok(BindingProgress {
                status: "expired".to_string(),
                qr_url: None,
                message: Some("二维码已过期，请重新生成".to_string()),
            })
        }
    } else {
        Ok(BindingProgress {
            status: "expired".to_string(),
            qr_url: None,
            message: Some("绑定进程未运行".to_string()),
        })
    }
}

/// Cancel binding process
#[tauri::command]
pub fn cancel_channel_binding(platform: String) -> Result<(), String> {
    cleanup_binding(&platform);
    Ok(())
}

/// Unbind a channel: remove from openclaw.json
#[tauri::command]
pub fn unbind_channel(platform: String) -> Result<(), String> {
    let pdef = find_platform(&platform)?;
    let mut config = read_config()?;

    if let Some(channels) = config.get_mut("channels") {
        if let Some(obj) = channels.as_object_mut() {
            obj.remove(pdef.config_key);
        }
    }

    write_config(&config)?;
    Ok(())
}

// ──────────────────────────────── Plugin allow-list ───────────────────

/// Pre-inject `plugins.allow` into openclaw.json so the gateway accepts
/// non-bundled channel plugins (openclaw-lark, openclaw-weixin).
///
/// IMPORTANT: Only adds plugins that are actually installed in
/// `~/.openclaw/extensions/<plugin_id>/`. The gateway validates the config
/// and rejects plugin IDs that don't have installed extensions.
///
/// Called from:
/// 1. `service::start_service()` Stage ③ — before gateway spawn (ideal, zero-restart)
/// 2. `start_channel_binding()` — fallback if gateway was started externally
///
/// Returns true if config was modified (caller may need to restart gateway).
pub fn ensure_plugins_allowed() -> bool {
    let openclaw_dir = match get_user_openclaw_dir() {
        Ok(dir) => dir,
        Err(e) => {
            eprintln!("[plugins-allow] get_user_openclaw_dir failed: {}", e);
            return false;
        }
    };
    let config_path = openclaw_dir.join("openclaw.json");
    let extensions_dir = openclaw_dir.join("extensions");

    eprintln!("[plugins-allow] config: {:?}", config_path);
    eprintln!("[plugins-allow] extensions: {:?}", extensions_dir);

    if !config_path.exists() {
        eprintln!("[plugins-allow] config file does not exist, skipping");
        return false;
    }

    let raw = match std::fs::read_to_string(&config_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[plugins-allow] read failed: {}", e);
            return false;
        }
    };

    let mut config: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("[plugins-allow] parse failed: {}", e);
            return false;
        }
    };

    // Check which plugins are actually installed
    let installed: Vec<&str> = PLATFORMS
        .iter()
        .filter(|p| p.available && !p.plugin_id.is_empty())
        .filter(|p| extensions_dir.join(p.plugin_id).exists())
        .map(|p| p.plugin_id)
        .collect();
    eprintln!("[plugins-allow] installed extensions: {:?}", installed);

    // Check current plugins.allow
    let current_allow = config.get("plugins")
        .and_then(|p| p.get("allow"));
    eprintln!("[plugins-allow] current plugins.allow: {:?}", current_allow);

    // Wildcard — skip
    if current_allow.and_then(|a| a.as_str()) == Some("*") {
        eprintln!("[plugins-allow] wildcard '*', skipping");
        return false;
    }

    // No plugins.allow and nothing to add — skip
    let has_allow = current_allow.and_then(|a| a.as_array()).is_some();
    if !has_allow && installed.is_empty() {
        eprintln!("[plugins-allow] no allow array and nothing to install, skipping");
        return false;
    }

    // Ensure plugins.allow is an array we can work with
    if config.get("plugins").is_none() {
        config["plugins"] = serde_json::json!({});
    }
    if !config["plugins"].get("allow").and_then(|a| a.as_array()).is_some() {
        config["plugins"]["allow"] = serde_json::json!([]);
    }

    let allow_arr = config["plugins"]["allow"].as_array_mut().unwrap();
    let before: Vec<String> = allow_arr.iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect();

    // CLEAN: remove plugin IDs whose extensions don't exist
    allow_arr.retain(|v| {
        if let Some(id) = v.as_str() {
            let is_ours = PLATFORMS.iter().any(|p| p.plugin_id == id);
            if is_ours {
                let exists = extensions_dir.join(id).exists();
                if !exists {
                    eprintln!("[plugins-allow] removing stale: {}", id);
                }
                exists
            } else {
                true
            }
        } else {
            true
        }
    });

    // ADD: install missing plugin IDs
    let mut changed = allow_arr.len() != before.len();
    for id in &installed {
        if !allow_arr.iter().any(|v| v.as_str() == Some(id)) {
            eprintln!("[plugins-allow] adding: {}", id);
            allow_arr.push(serde_json::json!(id));
            changed = true;
        }
    }

    // If empty, remove the key entirely
    if allow_arr.is_empty() {
        if let Some(plugins) = config.get_mut("plugins") {
            if let Some(obj) = plugins.as_object_mut() {
                obj.remove("allow");
            }
        }
        if config.get("plugins").and_then(|p| p.as_object()).map_or(false, |o| o.is_empty()) {
            config.as_object_mut().map(|o| o.remove("plugins"));
        }
        changed = !before.is_empty();
    }

    let after: Option<Vec<String>> = config.get("plugins")
        .and_then(|p| p.get("allow"))
        .and_then(|a| a.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect());

    eprintln!("[plugins-allow] before: {:?} -> after: {:?}, changed: {}", before, after, changed);

    if changed {
        match serde_json::to_string_pretty(&config) {
            Ok(output) => {
                // Retry write up to 3 times (file might be locked on Windows)
                let mut written = false;
                for attempt in 1..=3 {
                    match std::fs::write(&config_path, &output) {
                        Ok(_) => {
                            eprintln!("[plugins-allow] config written successfully (attempt {})", attempt);
                            written = true;
                            break;
                        }
                        Err(e) => {
                            eprintln!("[plugins-allow] write failed (attempt {}): {}", attempt, e);
                            std::thread::sleep(std::time::Duration::from_millis(200));
                        }
                    }
                }
                if !written {
                    eprintln!("[plugins-allow] FAILED to write config after 3 attempts!");
                }
            }
            Err(e) => {
                eprintln!("[plugins-allow] serialize failed: {}", e);
            }
        }
    }

    changed
}

// ──────────────────────────────── Internal helpers ────────────────────

/// Convert days since Unix epoch to (year, month, day).
/// Based on Howard Hinnant's algorithm (public domain).
fn civil_from_days(days: i64) -> (i32, u32, u32) {
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m, d)
}

/// Get the openclaw log directory (platform-specific).
/// Linux:   /tmp/openclaw/
/// Windows: C:\tmp\openclaw\ (gateway's default log location)
fn get_openclaw_log_dir() -> std::path::PathBuf {
    #[cfg(unix)]
    {
        std::path::PathBuf::from("/tmp/openclaw")
    }
    #[cfg(windows)]
    {
        // Gateway logs to \tmp\openclaw\ (at drive root, not %TEMP%)
        // Try the drive where openclaw is installed first
        let candidates = [
            std::path::PathBuf::from(r"C:\tmp\openclaw"),
            std::path::PathBuf::from(r"\tmp\openclaw"),
        ];
        for dir in &candidates {
            if dir.exists() {
                return dir.clone();
            }
        }
        // Fallback to %TEMP%
        let temp = std::env::var("TEMP").unwrap_or_else(|_| r"C:\tmp".to_string());
        std::path::PathBuf::from(temp).join("openclaw")
    }
}

/// Find the directory containing the `openclaw` binary.
/// CLI tools (weixin-installer, openclaw-lark) need this to discover the gateway.
/// Returns the parent directory of the binary (to be added to PATH).
fn find_openclaw_bin_dir() -> Option<std::path::PathBuf> {
    #[cfg(unix)]
    {
        // First check: sandboxed node's bin dir (might have openclaw installed there)
        if let Ok(node_bin) = crate::environment::get_node_binary() {
            if let Some(bin_dir) = node_bin.parent() {
                if bin_dir.join("openclaw").exists() {
                    return Some(bin_dir.to_path_buf());
                }
            }
        }
        // Second: scan all nvm versions
        if let Ok(home) = std::env::var("HOME") {
            let nvm_dir = std::path::PathBuf::from(&home).join(".nvm/versions/node");
            if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
                for entry in entries.flatten() {
                    let oc = entry.path().join("bin/openclaw");
                    if oc.exists() {
                        return Some(entry.path().join("bin"));
                    }
                }
            }
        }
    }
    #[cfg(windows)]
    {
        // Check sandboxed node's directory
        if let Ok(node_bin) = crate::environment::get_node_binary() {
            if let Some(bin_dir) = node_bin.parent() {
                if bin_dir.join("openclaw.cmd").exists() || bin_dir.join("openclaw").exists() {
                    return Some(bin_dir.to_path_buf());
                }
            }
        }
        // Check common global npm paths on Windows
        if let Ok(appdata) = std::env::var("APPDATA") {
            let npm_dir = std::path::PathBuf::from(&appdata).join("npm");
            if npm_dir.join("openclaw.cmd").exists() {
                return Some(npm_dir);
            }
        }
    }
    None
}

fn cleanup_binding(platform: &str) {
    let mut pids = BINDING_PIDS.lock().unwrap();
    if let Some(pid) = pids.remove(platform) {
        kill_pid(pid);
    }
    let mut urls = BINDING_QR_URLS.lock().unwrap();
    urls.remove(platform);
}

/// Check if a process with given PID is still alive
fn is_pid_alive(pid: u32) -> bool {
    #[cfg(unix)]
    {
        // kill(pid, 0) checks if process exists without sending a signal
        unsafe { libc::kill(pid as i32, 0) == 0 }
    }
    #[cfg(windows)]
    {
        use std::process::Command;
        Command::new("tasklist")
            .args(["/FI", &format!("PID eq {}", pid), "/NH"])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).contains(&pid.to_string()))
            .unwrap_or(false)
    }
}

/// Kill a process by PID
fn kill_pid(pid: u32) {
    #[cfg(unix)]
    {
        unsafe { libc::kill(pid as i32, libc::SIGTERM); }
    }
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .output();
    }
}
