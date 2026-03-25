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
    bind_mode: &'static str,
    available: bool,
}

const PLATFORMS: &[PlatformDef] = &[
    PlatformDef {
        id: "wechat",
        name: "微信",
        install_cmd: "@tencent-weixin/openclaw-weixin-cli@latest install",
        config_key: "wechat",
        bind_mode: "qrcode",
        available: true,
    },
    PlatformDef {
        id: "feishu",
        name: "飞书",
        install_cmd: "@larksuite/openclaw-lark install",
        config_key: "feishu",
        bind_mode: "qrcode",
        available: true,
    },
    PlatformDef {
        id: "telegram",
        name: "Telegram",
        install_cmd: "",
        config_key: "telegram",
        bind_mode: "token",
        available: false,
    },
    PlatformDef {
        id: "discord",
        name: "Discord",
        install_cmd: "",
        config_key: "discord",
        bind_mode: "token",
        available: false,
    },
    PlatformDef {
        id: "qq",
        name: "QQ",
        install_cmd: "",
        config_key: "qq",
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
    let cli_bin_path = cli_dir.as_ref().and_then(|dir| {
        let bin_name = match platform.as_str() {
            "wechat" => "weixin-installer",
            "feishu" => "openclaw-lark",
            _ => return None,
        };
        let bin_path = dir.join("node_modules").join(".bin").join(bin_name);
        if bin_path.exists() { Some(bin_path) } else { None }
    });

    // Spawn CLI process (triggers QR generation in the gateway)
    let child = if let Some(bin_path) = cli_bin_path {
        let _ = app.emit("binding-progress", serde_json::json!({
            "platform": platform,
            "stage": "starting",
            "message": "正在启动绑定...",
        }));
        tokio::process::Command::new(&node_bin)
            .arg(bin_path.to_string_lossy().to_string())
            .arg("install")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
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
        tokio::process::Command::new(npx_cmd)
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
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

    // Keep CLI child alive in background — it handles QR polling internally
    {
        let platform_clone = platform.clone();
        let app_clone = app.clone();
        tokio::spawn(async move {
            let _ = child.wait_with_output().await;
            let _ = app_clone.emit("binding-progress", serde_json::json!({
                "platform": platform_clone,
                "stage": "process_ended",
                "message": "CLI 进程已结束",
            }));
        });
    }

    // ── Extract QR URL from `openclaw logs --json` ──
    // The CLI triggers QR generation in the gateway. The QR URL is logged as:
    //   "二维码链接: https://liteapp.weixin.qq.com/q/..."
    // We tail the openclaw log stream to capture it.
    let openclaw_bin = which_openclaw()?;
    let mut log_child = tokio::process::Command::new(&openclaw_bin)
        .args(["logs", "--json"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动 openclaw logs 失败: {}", e))?;

    let log_stdout = log_child.stdout.take().ok_or("无法读取日志输出")?;
    let qr_url_regex = regex_lite::Regex::new(r"二维码链接:\s*(https?://\S+)").unwrap();

    let read_log_future = async {
        use tokio::io::{AsyncBufReadExt, BufReader};
        let reader = BufReader::new(log_stdout);
        let mut lines = reader.lines();
        let mut line_count = 0u32;

        while let Ok(Some(line)) = lines.next_line().await {
            line_count += 1;
            if line_count > 2000 { break; }
            if let Some(caps) = qr_url_regex.captures(&line) {
                if let Some(url_match) = caps.get(1) {
                    return Some(url_match.as_str().to_string());
                }
            }
        }
        None
    };

    // 120s timeout — feishu plugin install takes 60s+
    let found_url: Option<String> = tokio::time::timeout(
        std::time::Duration::from_secs(120),
        read_log_future,
    ).await
    .unwrap_or(None);

    // Kill the log tail process
    let _ = log_child.kill().await;

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
            Err(format!("未能提取二维码链接（超时）。请在终端执行：{}", cmd_hint))
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

// ──────────────────────────────── Internal helpers ────────────────────

/// Find the `openclaw` binary on the system.
/// Looks in: nvm node_modules, sandbox node, system PATH.
fn which_openclaw() -> Result<String, String> {
    // Try nvm global modules first (most common on dev machines)
    if let Ok(home) = std::env::var("HOME") {
        let nvm_bin = std::path::PathBuf::from(&home)
            .join(".nvm/versions/node")
            .read_dir()
            .ok()
            .and_then(|mut entries| {
                entries.find_map(|e| {
                    let path = e.ok()?.path().join("bin/openclaw");
                    if path.exists() { Some(path) } else { None }
                })
            });
        if let Some(bin) = nvm_bin {
            return Ok(bin.to_string_lossy().to_string());
        }
    }

    // Try system PATH
    if let Ok(output) = std::process::Command::new("which")
        .arg("openclaw")
        .output()
    {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Ok(path);
            }
        }
    }

    Err("未找到 openclaw 命令。请确保 OpenClaw 已安装。".to_string())
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
