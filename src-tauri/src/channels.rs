// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// Phase 9: Platform Integration — WeChat + Feishu binding/unbinding

use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

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
    static ref BINDING_PROCESSES: Mutex<HashMap<String, Child>> = Mutex::new(HashMap::new());
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

    let output = Command::new(&node_cmd)
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

/// Start binding process: spawn npx, capture stdout, extract QR URL
#[tauri::command]
pub fn start_channel_binding(platform: String) -> Result<String, String> {
    let pdef = find_platform(&platform)?;

    if !pdef.available {
        return Err(format!("{} 暂不支持绑定", pdef.name));
    }

    // Check if already binding
    {
        let procs = BINDING_PROCESSES.lock().unwrap();
        if procs.contains_key(&platform) {
            return Err("绑定进程已在运行".to_string());
        }
    }

    let npx_cmd = if cfg!(target_os = "windows") {
        "npx.cmd"
    } else {
        "npx"
    };

    // Build args: npx -y @package install
    let mut args: Vec<&str> = vec!["-y"];
    for part in pdef.install_cmd.split_whitespace() {
        args.push(part);
    }

    let mut child = Command::new(npx_cmd)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动绑定进程失败: {}", e))?;

    // Read stdout in a blocking manner to find the QR URL
    // We'll read up to 60 lines or 15 seconds, whichever comes first
    let stdout = child.stdout.take().ok_or("无法读取进程输出")?;
    let reader = BufReader::new(stdout);
    let url_regex = regex_lite::Regex::new(r"https?://\S+").unwrap();

    let mut found_url: Option<String> = None;
    let mut line_count = 0;

    for line in reader.lines() {
        line_count += 1;
        if line_count > 200 {
            break;
        }
        match line {
            Ok(text) => {
                if let Some(mat) = url_regex.find(&text) {
                    found_url = Some(mat.as_str().to_string());
                    break;
                }
            }
            Err(_) => break,
        }
    }

    // Store process for later polling/cancelling
    {
        let mut procs = BINDING_PROCESSES.lock().unwrap();
        procs.insert(platform.clone(), child);
    }

    match found_url {
        Some(url) => {
            let mut urls = BINDING_QR_URLS.lock().unwrap();
            urls.insert(platform, url.clone());
            Ok(url)
        }
        None => Err("未能从 CLI 输出中提取二维码链接，请尝试在终端手动执行".to_string()),
    }
}

/// Poll binding result: check if process ended + config changed
#[tauri::command]
pub fn poll_binding_result(platform: String) -> Result<BindingProgress, String> {
    let pdef = find_platform(&platform)?;

    // Check config first
    let config = read_config()?;
    if is_channel_bound(&config, pdef.config_key) {
        // Clean up process
        cleanup_binding(&platform);
        return Ok(BindingProgress {
            status: "success".to_string(),
            qr_url: None,
            message: Some(format!("{} 绑定成功！", pdef.name)),
        });
    }

    // Check process status
    let mut procs = BINDING_PROCESSES.lock().unwrap();
    if let Some(child) = procs.get_mut(&platform) {
        match child.try_wait() {
            Ok(Some(exit_status)) => {
                procs.remove(&platform);
                if exit_status.success() {
                    // Re-check config after exit
                    drop(procs);
                    let config2 = read_config()?;
                    if is_channel_bound(&config2, pdef.config_key) {
                        return Ok(BindingProgress {
                            status: "success".to_string(),
                            qr_url: None,
                            message: Some(format!("{} 绑定成功！", pdef.name)),
                        });
                    }
                }
                Ok(BindingProgress {
                    status: "expired".to_string(),
                    qr_url: None,
                    message: Some("二维码已过期，请重新生成".to_string()),
                })
            }
            Ok(None) => {
                // Still running, waiting for scan
                let urls = BINDING_QR_URLS.lock().unwrap();
                Ok(BindingProgress {
                    status: "pending".to_string(),
                    qr_url: urls.get(&platform).cloned(),
                    message: Some("等待扫码...".to_string()),
                })
            }
            Err(e) => {
                procs.remove(&platform);
                Ok(BindingProgress {
                    status: "error".to_string(),
                    qr_url: None,
                    message: Some(format!("进程异常: {}", e)),
                })
            }
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

fn cleanup_binding(platform: &str) {
    let mut procs = BINDING_PROCESSES.lock().unwrap();
    if let Some(mut child) = procs.remove(platform) {
        let _ = child.kill();
        let _ = child.wait();
    }
    let mut urls = BINDING_QR_URLS.lock().unwrap();
    urls.remove(platform);
}
