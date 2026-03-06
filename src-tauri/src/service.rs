use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::io::{BufRead, BufReader};
use tauri::Emitter;

use crate::environment;
use crate::openclaw;

/// Global state to hold the running OpenClaw child process
pub struct ServiceState {
    pub child: Mutex<Option<Child>>,
}

impl Default for ServiceState {
    fn default() -> Self {
        Self {
            child: Mutex::new(None),
        }
    }
}

/// Check if the OpenClaw service is currently running
#[tauri::command]
pub fn is_service_running(state: tauri::State<ServiceState>) -> bool {
    let mut guard = state.child.lock().unwrap();
    if let Some(child) = guard.as_mut() {
        // Check if process is still alive
        match child.try_wait() {
            Ok(Some(_)) => {
                // Process has exited
                *guard = None;
                false
            }
            Ok(None) => true, // Still running
            Err(_) => {
                *guard = None;
                false
            }
        }
    } else {
        false
    }
}

/// Start the OpenClaw service using sandboxed Node.js
#[tauri::command]
pub async fn start_service(
    app: tauri::AppHandle,
    state: tauri::State<'_, ServiceState>,
) -> Result<String, String> {
    // Check if already running
    {
        let mut guard = state.child.lock().unwrap();
        if let Some(child) = guard.as_mut() {
            if child.try_wait().ok().flatten().is_none() {
                return Ok("Service is already running".to_string());
            }
        }
    }

    // Get paths
    let node_bin = environment::get_node_binary()?;
    let openclaw_dir = openclaw::get_openclaw_dir()?;

    if !openclaw_dir.join("package.json").exists() {
        return Err("OpenClaw 未安装，请先完成初始化".to_string());
    }

    let _ = app.emit("service-log", serde_json::json!({
        "level": "info",
        "message": "🚀 正在启动 OpenClaw 服务..."
    }));

    // Build the start command
    let npm_bin = environment::get_npm_binary()?;
    let node_dir = node_bin.parent().unwrap().to_path_buf();

    let mut cmd = Command::new(&node_bin);
    cmd.arg(&npm_bin)
        .arg("start")
        .current_dir(&openclaw_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Set PATH to include sandboxed node
    if let Some(current_path) = std::env::var_os("PATH") {
        let mut paths = std::env::split_paths(&current_path).collect::<Vec<_>>();
        paths.insert(0, node_dir);
        let new_path = std::env::join_paths(paths).unwrap_or_default();
        cmd.env("PATH", new_path);
    }

    let mut child = cmd.spawn()
        .map_err(|e| format!("启动 OpenClaw 失败: {}", e))?;

    // Spawn a thread to stream stdout logs to frontend
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let app_clone = app.clone();

    if let Some(stdout) = stdout {
        let app_out = app_clone.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let level = classify_log_level(&line);
                    let _ = app_out.emit("service-log", serde_json::json!({
                        "level": level,
                        "message": line
                    }));
                }
            }
        });
    }

    if let Some(stderr) = stderr {
        let app_err = app_clone;
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let _ = app_err.emit("service-log", serde_json::json!({
                        "level": "error",
                        "message": line
                    }));
                }
            }
        });
    }

    let _ = app.emit("service-log", serde_json::json!({
        "level": "info",
        "message": "✅ OpenClaw 服务已启动！正在监听端口..."
    }));

    // Store the child process
    {
        let mut guard = state.child.lock().unwrap();
        *guard = Some(child);
    }

    Ok("Service started".to_string())
}

/// Stop the OpenClaw service
#[tauri::command]
pub fn stop_service(
    app: tauri::AppHandle,
    state: tauri::State<ServiceState>,
) -> Result<String, String> {
    let mut guard = state.child.lock().unwrap();
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
        let _ = app.emit("service-log", serde_json::json!({
            "level": "info",
            "message": "⏹️ OpenClaw 服务已停止"
        }));
        Ok("Service stopped".to_string())
    } else {
        Ok("Service was not running".to_string())
    }
}

/// Classify log line into a severity level for frontend display
fn classify_log_level(line: &str) -> &'static str {
    let lower = line.to_lowercase();
    if lower.contains("error") || lower.contains("fatal") || lower.contains("panic") {
        "error"
    } else if lower.contains("warn") {
        "warn"
    } else if lower.contains("listening") || lower.contains("started") || lower.contains("ready") || lower.contains("success") {
        "success"
    } else {
        "info"
    }
}
