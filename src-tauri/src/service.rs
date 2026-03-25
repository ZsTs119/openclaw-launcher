// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::io::{BufRead, BufReader};
use std::net::TcpListener;
use tauri::Emitter;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use crate::environment;
use crate::paths;

/// Pre-build Control UI assets if missing.
///
/// On Windows, usernames with spaces (e.g., "C:\Users\chuhan zhou\...") cause
/// the engine's internal `pnpm ui:build` to fail because Node.js `spawn()` with
/// `shell: true` mishandles the CWD path. By running the build ourselves via
/// Rust's `Command` (which doesn't use shell), we bypass this issue.
///
/// This is a best-effort operation — if it fails, the gateway will attempt its
/// own build (which may also fail on space-path machines, but that's no worse
/// than the current behavior).
fn ensure_control_ui_built(app: &tauri::AppHandle) {
    let openclaw_dir = match paths::get_openclaw_dir() {
        Ok(d) => d,
        Err(_) => return,
    };

    let ui_index = openclaw_dir.join("dist").join("control-ui").join("index.html");
    if ui_index.exists() {
        return; // Already built — skip (most machines hit this path)
    }

    let ui_dir = openclaw_dir.join("ui");
    if !ui_dir.join("package.json").exists() {
        return; // No UI source available
    }

    let node_bin = match environment::get_node_binary() {
        Ok(b) => b,
        Err(_) => return,
    };

    let _ = app.emit("service-log", serde_json::json!({
        "level": "info",
        "message": "Control UI 缺失，正在预构建..."
    }));

    // Build PATH with sandboxed node
    let node_dir = node_bin.parent().unwrap().to_path_buf();
    let sandbox_path = if let Some(current_path) = std::env::var_os("PATH") {
        let mut paths_vec = std::env::split_paths(&current_path).collect::<Vec<_>>();
        paths_vec.insert(0, node_dir.clone());
        std::env::join_paths(paths_vec).unwrap_or_default()
    } else {
        std::ffi::OsString::from(&node_dir)
    };

    // Step 1: Install UI deps via npm (not pnpm — avoids the shell issue)
    let ui_node_modules = ui_dir.join("node_modules");
    if !ui_node_modules.join("vite").exists() {
        if let Ok(npm_bin) = environment::get_npm_binary() {
            let mut npm_cmd = std::process::Command::new(&node_bin);
            npm_cmd.arg(&npm_bin)
                .arg("install")
                .arg("--prefix")
                .arg(&ui_dir)
                .env("PATH", &sandbox_path)
                .stdout(Stdio::null())
                .stderr(Stdio::piped());

            #[cfg(target_os = "windows")]
            npm_cmd.creation_flags(0x08000000);

            match npm_cmd.output() {
                Ok(output) if output.status.success() => {
                    let _ = app.emit("service-log", serde_json::json!({
                        "level": "info",
                        "message": "Control UI 依赖安装完成"
                    }));
                }
                Ok(output) => {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    let _ = app.emit("service-log", serde_json::json!({
                        "level": "warn",
                        "message": format!("Control UI 依赖安装失败: {}", stderr.chars().take(200).collect::<String>())
                    }));
                    return;
                }
                Err(e) => {
                    let _ = app.emit("service-log", serde_json::json!({
                        "level": "warn",
                        "message": format!("Control UI 依赖安装异常: {}", e)
                    }));
                    return;
                }
            }
        } else {
            return; // No npm available
        }
    }

    // Step 2: Run vite build directly via node (no shell, no pnpm)
    // vite's entry point: ui/node_modules/vite/bin/vite.js
    let vite_js = ui_dir.join("node_modules").join("vite").join("bin").join("vite.js");
    if !vite_js.exists() {
        let _ = app.emit("service-log", serde_json::json!({
            "level": "warn",
            "message": "vite.js 未找到，跳过 Control UI 构建"
        }));
        return;
    }

    let mut build_cmd = std::process::Command::new(&node_bin);
    build_cmd.arg(&vite_js)
        .arg("build")
        .current_dir(&ui_dir)
        .env("PATH", &sandbox_path)
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    build_cmd.creation_flags(0x08000000);

    match build_cmd.output() {
        Ok(output) if output.status.success() => {
            let _ = app.emit("service-log", serde_json::json!({
                "level": "success",
                "message": "[OK] Control UI 预构建成功"
            }));
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let _ = app.emit("service-log", serde_json::json!({
                "level": "warn",
                "message": format!("Control UI 构建失败: {}", stderr.chars().take(200).collect::<String>())
            }));
        }
        Err(e) => {
            let _ = app.emit("service-log", serde_json::json!({
                "level": "warn",
                "message": format!("Control UI 构建异常: {}", e)
            }));
        }
    }
}

/// Check if a port is truly available by:
/// 1. Trying to bind to it (standard OS check)
/// 2. Trying to connect to it (catches WSL2 port forwarding — WSL binds 0.0.0.0
///    which gets forwarded to Windows localhost, but Windows bind("127.0.0.1") still succeeds)
fn is_port_available(port: u16) -> bool {
    // Layer 1: Can we bind to it?
    if TcpListener::bind(("127.0.0.1", port)).is_err() {
        return false;
    }
    // Layer 2: Is anything already responding on this port?
    // This catches WSL2 forwarded ports that pass the bind check
    use std::net::TcpStream;
    match TcpStream::connect_timeout(
        &std::net::SocketAddr::from(([127, 0, 0, 1], port)),
        std::time::Duration::from_millis(200),
    ) {
        Ok(_) => false,  // Something is listening — port is NOT available
        Err(_) => true,   // Nothing responded — port is truly free
    }
}

/// Check if OpenClaw gateway port is available (exposed to frontend)
#[tauri::command]
pub fn check_port_available() -> Result<bool, String> {
    Ok(is_port_available(18789))
}

/// Global state to hold the running OpenClaw child process
pub struct ServiceState {
    pub child: Mutex<Option<Child>>,
    pub port: Mutex<u16>,
}

impl Default for ServiceState {
    fn default() -> Self {
        Self {
            child: Mutex::new(None),
            port: Mutex::new(18789),
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
    // Pre-build Control UI if missing (fixes Windows space-in-path issue)
    ensure_control_ui_built(&app);

    // Check if already running (managed by this Launcher instance)
    {
        let mut guard = state.child.lock().unwrap();
        if let Some(child) = guard.as_mut() {
            if child.try_wait().ok().flatten().is_none() {
                return Ok("Service is already running".to_string());
            }
        }
    }

    // Clean up any pre-existing gateway processes and stale locks
    cleanup_stale_gateway(&app);

    // Get paths
    let node_bin = environment::get_node_binary()?;
    let openclaw_dir = paths::get_openclaw_dir()?;

    if !openclaw_dir.join("package.json").exists() {
        return Err("OpenClaw 未安装，请先完成初始化".to_string());
    }
    // Find an available port starting from 18789 (OpenClaw gateway default)
    let mut chosen_port: u16 = 18789;
    let mut found = false;
    for port in 18789..=18899 {
        if is_port_available(port) {
            chosen_port = port;
            found = true;
            break;
        }
    }
    if !found {
        return Err("端口 18789-18899 全部被占用。请关闭其他 OpenClaw 实例后重试。".to_string());
    }

    if chosen_port != 18789 {
        let _ = app.emit("service-log", serde_json::json!({
            "level": "warn",
            "message": format!("⚠️ 默认端口 18789 已占用，自动切换到端口 {}", chosen_port)
        }));
    }

    // Emit actual port to frontend for display
    let _ = app.emit("service-port", serde_json::json!({ "port": chosen_port }));

    let _ = app.emit("service-log", serde_json::json!({
        "level": "info",
        "message": format!("🚀 正在启动 OpenClaw 服务 (端口 {})...", chosen_port)
    }));

    // Build the start command — use OpenClaw's native entry point directly
    let node_dir = node_bin.parent().unwrap().to_path_buf();
    let run_script = openclaw_dir.join("scripts").join("run-node.mjs");

    // Auth token for web UI — injected via env var (also set in openclaw.json)
    let token = "openclaw-launcher-local";

    let mut cmd = Command::new(&node_bin);
    cmd.arg(&run_script)
        .arg("gateway")
        .arg("--allow-unconfigured")
        .arg("--port")
        .arg(chosen_port.to_string())
        .current_dir(&openclaw_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("OPENCLAW_GATEWAY_AUTH_TOKEN", token);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

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
        let open_port = chosen_port;  // Copy for thread
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            let mut browser_opened = false;
            for line in reader.lines() {
                if let Ok(line) = line {
                    let level = classify_log_level(&line);

                    // Detect service ready — just emit a log, frontend handles browser opening
                    if !browser_opened && is_service_ready_signal(&line) {
                        browser_opened = true;
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

    // Store the child process and port
    {
        let mut guard = state.child.lock().unwrap();
        *guard = Some(child);
        let mut port_guard = state.port.lock().unwrap();
        *port_guard = chosen_port;
    }

    // Ensure built-in resources for existing users who upgrade
    crate::agents::ensure_builtin_resources();

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

/// Kill any pre-existing gateway processes and remove stale lock files.
///
/// This prevents the "gateway already running; lock timeout after 5000ms" error
/// that occurs when a gateway from a previous session (manual start, watchdog,
/// or crashed Launcher) is still running.
fn cleanup_stale_gateway(app: &tauri::AppHandle) {
    let uid = unsafe { libc::getuid() };
    let lock_dir = std::path::PathBuf::from(format!("/tmp/openclaw-{}", uid));

    if !lock_dir.exists() {
        return;
    }

    // Read all .lock files in the directory
    let entries = match std::fs::read_dir(&lock_dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.extension().map_or(false, |ext| ext == "lock") {
            continue;
        }

        // Parse the lock file JSON to get the PID
        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => {
                // Can't read — just remove it
                let _ = std::fs::remove_file(&path);
                continue;
            }
        };

        let pid: Option<u32> = serde_json::from_str::<serde_json::Value>(&content)
            .ok()
            .and_then(|v| v.get("pid")?.as_u64())
            .map(|p| p as u32);

        if let Some(pid) = pid {
            // Check if this PID is alive
            let alive = unsafe { libc::kill(pid as i32, 0) == 0 };

            if alive {
                let _ = app.emit("service-log", serde_json::json!({
                    "level": "info",
                    "message": format!("检测到已有 Gateway 进程 (pid {}), 正在关闭...", pid)
                }));

                // SIGTERM first (graceful)
                unsafe { libc::kill(pid as i32, libc::SIGTERM); }
                std::thread::sleep(std::time::Duration::from_secs(2));

                // Check again — if still alive, SIGKILL
                if unsafe { libc::kill(pid as i32, 0) == 0 } {
                    unsafe { libc::kill(pid as i32, libc::SIGKILL); }
                    std::thread::sleep(std::time::Duration::from_millis(500));
                }
            }
        }

        // Remove the lock file regardless
        let _ = std::fs::remove_file(&path);
    }

    // Also kill gateway-watchdog.sh if running (it auto-restarts the gateway)
    #[cfg(unix)]
    {
        if let Ok(output) = std::process::Command::new("pkill")
            .args(["-f", "gateway-watchdog"])
            .output()
        {
            if output.status.success() {
                let _ = app.emit("service-log", serde_json::json!({
                    "level": "info",
                    "message": "已关闭 gateway-watchdog 守护进程"
                }));
            }
        }
    }

    // Brief pause for ports to be fully released by the OS
    std::thread::sleep(std::time::Duration::from_millis(500));
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
