use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::io::{BufRead, BufReader};
use std::net::TcpListener;
use tauri::Emitter;

use crate::environment;
use crate::openclaw;

/// Check if a port is available by trying to bind to it
fn is_port_available(port: u16) -> bool {
    TcpListener::bind(("127.0.0.1", port)).is_ok()
}

/// Check if port 3000 is available (exposed to frontend)
#[tauri::command]
pub fn check_port_available() -> Result<bool, String> {
    Ok(is_port_available(3000))
}

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

    // Check port 3000 availability
    if !is_port_available(3000) {
        let _ = app.emit("service-log", serde_json::json!({
            "level": "warn",
            "message": "⚠️ 端口 3000 已被占用，可能有其他服务在运行"
        }));
        return Err("端口 3000 已被占用。请关闭占用该端口的程序后重试，或检查是否已有 OpenClaw 实例在运行。".to_string());
    }

    let _ = app.emit("service-log", serde_json::json!({
        "level": "info",
        "message": "🚀 正在启动 OpenClaw 服务..."
    }));

    // Build the start command — use OpenClaw's native entry point directly
    // instead of `npm start` which triggers pnpm internally
    let node_dir = node_bin.parent().unwrap().to_path_buf();
    let run_script = openclaw_dir.join("scripts").join("run-node.mjs");

    let mut cmd = Command::new(&node_bin);
    cmd.arg(&run_script)
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
            let mut browser_opened = false;
            for line in reader.lines() {
                if let Ok(line) = line {
                    let level = classify_log_level(&line);

                    // Auto-open browser when service is ready
                    if !browser_opened && is_service_ready_signal(&line) {
                        browser_opened = true;
                        let app_browser = app_out.clone();
                        std::thread::spawn(move || {
                            std::thread::sleep(std::time::Duration::from_secs(2));
                            let _ = app_browser.emit("service-log", serde_json::json!({
                                "level": "success",
                                "message": "🌐 正在打开浏览器..."
                            }));
                            let _ = open::that("http://localhost:3000");
                        });
                    }

                    let _ = app_out.emit("service-log", serde_json::json!({
                        "level": level,
                        "message": line
                    }));
                }
            }
        });
    }

    // Spawn a thread to detect service crash (process exit)
    {
        let app_crash = app.clone();
        let state_inner = state.inner().child.lock().unwrap().is_some();
        if state_inner {
            // Get the process ID to monitor
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(3));
                    // We can't access state from this thread, so just emit a heartbeat check
                    // The frontend will call is_service_running to verify
                    let _ = app_crash.emit("service-heartbeat", serde_json::json!({}));
                }
            });
        }
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
    if lower.contains("error") || lower.contains("fatal") || lower.contains("panic") || lower.trim_start().starts_with("err_") {
        "error"
    } else if lower.contains("warn") {
        "warn"
    } else if is_service_ready_signal(line) {
        "success"
    } else {
        "info"
    }
}

/// Detect if a log line indicates the service is ready to accept connections
fn is_service_ready_signal(line: &str) -> bool {
    let lower = line.to_lowercase();
    lower.contains("listening") || lower.contains("started on") || lower.contains("ready on")
        || lower.contains("server is running") || lower.contains("server started")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_port_available_after_release() {
        // Let OS pick a free port, release it, then verify it's available
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        drop(listener);
        assert!(is_port_available(port));
    }

    #[test]
    fn test_port_occupied_detection() {
        // Bind a port, then check it's no longer available
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        assert!(!is_port_available(port));
        drop(listener);
        assert!(is_port_available(port));
    }

    #[test]
    fn test_classify_log_level() {
        assert_eq!(classify_log_level("npm warn deprecated"), "warn");
        assert_eq!(classify_log_level("npm error code ENOENT"), "error");
        assert_eq!(classify_log_level("  ERR_PNPM something failed"), "error");
        assert_eq!(classify_log_level("added 150 packages"), "info");
        assert_eq!(classify_log_level("Server started on port 3000"), "success");
        assert_eq!(classify_log_level("some normal output"), "info");
    }

    #[test]
    fn test_service_ready_signal() {
        assert!(is_service_ready_signal("Server started on port 3000"));
        assert!(is_service_ready_signal("Listening on http://localhost:3000"));
        assert!(is_service_ready_signal("Gateway ready on 0.0.0.0:3000"));
        assert!(is_service_ready_signal("server is running at port 3000"));
        assert!(!is_service_ready_signal("compiling TypeScript..."));
        assert!(!is_service_ready_signal("installing dependencies"));
    }
}
