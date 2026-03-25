// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
use std::path::PathBuf;
use std::io::Write;
use futures_util::StreamExt;
use tauri::Emitter;

/// Get the sandbox base directory: AppData/Local/OpenClawLauncher (Win) or ~/Library/.../OpenClawLauncher (Mac) or ~/.local/share/OpenClawLauncher (Linux)
pub fn get_sandbox_dir() -> Result<PathBuf, String> {
    let base = dirs::data_local_dir().ok_or("Cannot determine AppData/Local directory")?;
    let sandbox = base.join("OpenClawLauncher");
    std::fs::create_dir_all(&sandbox).map_err(|e| format!("Failed to create sandbox dir: {}", e))?;
    Ok(sandbox)
}

/// Check if available disk space is sufficient (in MB)
pub fn check_disk_space(path: &PathBuf, required_mb: u64) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        use std::ffi::OsStr;
        // Use GetDiskFreeSpaceExW on Windows
        let wide_path: Vec<u16> = OsStr::new(path.to_string_lossy().as_ref())
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let mut free_bytes: u64 = 0;
        unsafe {
            // kernel32.dll GetDiskFreeSpaceExW
            #[link(name = "kernel32")]
            extern "system" {
                fn GetDiskFreeSpaceExW(
                    lpDirectoryName: *const u16,
                    lpFreeBytesAvailableToCaller: *mut u64,
                    lpTotalNumberOfBytes: *mut u64,
                    lpTotalNumberOfFreeBytes: *mut u64,
                ) -> i32;
            }
            let mut total: u64 = 0;
            let mut total_free: u64 = 0;
            let ret = GetDiskFreeSpaceExW(
                wide_path.as_ptr(),
                &mut free_bytes,
                &mut total,
                &mut total_free,
            );
            if ret == 0 {
                return Ok(true); // Can't determine, assume OK
            }
        }
        let free_mb = free_bytes / (1024 * 1024);
        Ok(free_mb >= required_mb)
    }
    #[cfg(not(target_os = "windows"))]
    {
        // Use `df` command instead of unsafe statvfs FFI
        // (raw Statvfs struct has ABI mismatches across glibc versions, causing segfaults on some Ubuntu systems)
        let path_str = path.to_string_lossy().to_string();
        match std::process::Command::new("df")
            .args(["--output=avail", "-BM", &path_str])
            .output()
        {
            Ok(output) if output.status.success() => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                // df output: "  Avail\n  12345M\n" — parse the number from the second line
                if let Some(line) = stdout.lines().nth(1) {
                    let cleaned = line.trim().trim_end_matches('M');
                    if let Ok(avail_mb) = cleaned.parse::<u64>() {
                        return Ok(avail_mb >= required_mb);
                    }
                }
                Ok(true) // Can't parse, assume OK
            }
            _ => Ok(true), // df failed or not available, assume OK
        }
    }
}

/// Check if sandbox path contains non-ASCII characters (e.g. Chinese username)
/// and warn the user. Returns a warning message if path has issues, None otherwise.
pub fn check_path_compatibility(path: &PathBuf) -> Option<String> {
    let path_str = path.to_string_lossy();
    
    // Check for non-ASCII characters (Chinese usernames etc.)
    if path_str.chars().any(|c| !c.is_ascii()) {
        return Some(format!(
            "⚠️ 安装路径包含非 ASCII 字符: {}\n\
             部分 npm 包可能不支持中文路径，如遇到问题请更改 Windows 用户名或设置 OPENCLAW_HOME 环境变量。",
            path_str
        ));
    }
    
    // Check for path length on Windows (260 char limit)
    #[cfg(target_os = "windows")]
    if path_str.len() > 200 {
        return Some(format!(
            "⚠️ 安装路径过长 ({} 字符)，可能超出 Windows 260 字符限制。\n\
             建议缩短路径或启用 Windows 长路径支持。",
            path_str.len()
        ));
    }
    
    None
}

/// Enable long path support on Windows via registry (best-effort)
#[cfg(target_os = "windows")]
pub fn enable_windows_long_paths() {
    use std::process::Command;
    // Try to enable LongPathsEnabled in registry (requires admin, best-effort)
    let _ = Command::new("reg")
        .args(["add", "HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem", 
               "/v", "LongPathsEnabled", "/t", "REG_DWORD", "/d", "1", "/f"])
        .output();
}

/// Convert a raw network error into a user-friendly Chinese message
pub fn humanize_network_error(err: &str) -> String {
    let err_lower = err.to_lowercase();
    if err_lower.contains("dns") || err_lower.contains("resolve") {
        "❌ DNS 解析失败：无法找到服务器。请检查网络连接和 DNS 设置。".to_string()
    } else if err_lower.contains("timeout") || err_lower.contains("timed out") {
        "❌ 连接超时：服务器响应太慢。请检查网络或稍后重试。".to_string()
    } else if err_lower.contains("connection refused") {
        "❌ 连接被拒绝：服务器未响应。可能是防火墙或代理设置问题。".to_string()
    } else if err_lower.contains("connection reset") || err_lower.contains("econnreset") {
        "❌ 连接被重置：网络不稳定。请检查 VPN/代理或稍后重试。".to_string()
    } else if err_lower.contains("ssl") || err_lower.contains("tls") || err_lower.contains("certificate") {
        "❌ SSL/TLS 证书错误：请检查系统时间是否正确，或代理是否干扰了 HTTPS。".to_string()
    } else if err_lower.contains("no such host") || err_lower.contains("not found") {
        "❌ 找不到服务器：请确认已连接到互联网。".to_string()
    } else if err_lower.contains("network") || err_lower.contains("socket") {
        format!("❌ 网络错误：{}\n请检查网络连接后重试。", err)
    } else {
        format!("❌ 下载失败：{}\n请检查网络连接后重试。", err)
    }
}

/// Get the path where Node.js portable should be extracted
pub fn get_node_dir() -> Result<PathBuf, String> {
    Ok(get_sandbox_dir()?.join("node"))
}

/// Get the node binary path
pub fn get_node_binary() -> Result<PathBuf, String> {
    let node_dir = get_node_dir()?;
    // On Windows it's node.exe, on Unix it's bin/node
    if cfg!(target_os = "windows") {
        // Node portable on Windows extracts to node-vXX.XX.X-win-x64/node.exe
        // We need to find the actual directory inside
        if let Ok(entries) = std::fs::read_dir(&node_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() && path.file_name().map_or(false, |n| n.to_string_lossy().starts_with("node-")) {
                    let exe = path.join("node.exe");
                    if exe.exists() {
                        return Ok(exe);
                    }
                }
            }
        }
        Err("Node.js binary not found in sandbox".to_string())
    } else {
        // Linux/Mac: node-vXX.XX.X-linux-x64/bin/node
        if let Ok(entries) = std::fs::read_dir(&node_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() && path.file_name().map_or(false, |n| n.to_string_lossy().starts_with("node-")) {
                    let exe = path.join("bin").join("node");
                    if exe.exists() {
                        return Ok(exe);
                    }
                }
            }
        }
        Err("Node.js binary not found in sandbox".to_string())
    }
}

/// Get the npm cli.js path (the actual JS file that node can execute)
/// On Windows, npm.cmd is a batch wrapper — we can't call `node npm.cmd`.
/// Instead we find the actual JS entry point: node_modules/npm/bin/npm-cli.js
pub fn get_npm_binary() -> Result<PathBuf, String> {
    let node_bin = get_node_binary()?;
    let node_root = if cfg!(target_os = "windows") {
        // Windows: node.exe is at node-vXX.XX.X-win-x64/node.exe
        node_bin.parent().unwrap().to_path_buf()
    } else {
        // Linux/Mac: node is at node-vXX.XX.X-linux-x64/bin/node → go up to the root
        node_bin.parent().unwrap().parent().unwrap().to_path_buf()
    };

    // Primary: the actual npm-cli.js embedded in Node's distribution
    let npm_cli = if cfg!(target_os = "windows") {
        node_root.join("node_modules").join("npm").join("bin").join("npm-cli.js")
    } else {
        node_root.join("lib").join("node_modules").join("npm").join("bin").join("npm-cli.js")
    };

    if npm_cli.exists() {
        return Ok(npm_cli);
    }

    // Fallback: try the direct npm script (Linux/Mac only)
    if !cfg!(target_os = "windows") {
        let npm_script = node_bin.parent().unwrap().join("npm");
        if npm_script.exists() {
            return Ok(npm_script);
        }
    }

    Err(format!("npm-cli.js not found. Searched: {}", npm_cli.display()))
}

/// Check if Node.js is already available in the sandbox
#[tauri::command]
pub fn check_node_exists() -> Result<bool, String> {
    match get_node_binary() {
        Ok(path) => Ok(path.exists()),
        Err(_) => Ok(false),
    }
}

/// Get the download URL for Node.js portable based on OS & arch
fn get_node_download_url() -> Result<(String, String), String> {
    let version = "v22.17.0"; // LTS version matching user's system

    let (os, arch, ext) = if cfg!(target_os = "windows") {
        if cfg!(target_arch = "x86_64") {
            ("win", "x64", "zip")
        } else if cfg!(target_arch = "aarch64") {
            ("win", "arm64", "zip")
        } else {
            return Err("Unsupported Windows architecture".to_string());
        }
    } else if cfg!(target_os = "macos") {
        if cfg!(target_arch = "x86_64") {
            ("darwin", "x64", "tar.gz")
        } else if cfg!(target_arch = "aarch64") {
            ("darwin", "arm64", "tar.gz")
        } else {
            return Err("Unsupported macOS architecture".to_string());
        }
    } else {
        // Linux
        if cfg!(target_arch = "x86_64") {
            ("linux", "x64", "tar.gz")
        } else if cfg!(target_arch = "aarch64") {
            ("linux", "arm64", "tar.gz")
        } else {
            return Err("Unsupported Linux architecture".to_string());
        }
    };

    let filename = format!("node-{}-{}-{}.{}", version, os, arch, ext);
    // Primary: official Node.js, Fallback: npmmirror.com (China mirror)
    let primary = format!("https://nodejs.org/dist/{}/{}", version, filename);
    let fallback = format!("https://npmmirror.com/mirrors/node/{}/{}", version, filename);

    Ok((primary, fallback))
}

/// Download Node.js portable and extract to sandbox. Emits progress events to frontend.
#[tauri::command]
pub async fn download_and_install_node(app: tauri::AppHandle) -> Result<String, String> {
    // Step 1: Check if already installed
    if check_node_exists()? {
        return Ok("Node.js already installed in sandbox".to_string());
    }

    let node_dir = get_node_dir()?;
    std::fs::create_dir_all(&node_dir).map_err(|e| format!("Failed to create node dir: {}", e))?;

    // Step 2: Get download URL
    let (primary_url, fallback_url) = get_node_download_url()?;
    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "download_node",
        "message": "正在下载 Node.js 运行环境...",
        "percent": 10
    }));

    // Step 3: Try primary URL first, fallback if failed
    let download_url = match test_url_reachable(&primary_url).await {
        true => &primary_url,
        false => {
            let _ = app.emit("setup-progress", serde_json::json!({
                "stage": "download_node",
                "message": "官方源连接缓慢，已自动切换国内镜像...",
                "percent": 12
            }));
            &fallback_url
        }
    };

    // Step 4: Download the archive
    let response = reqwest::get(download_url)
        .await
        .map_err(|e| humanize_network_error(&e.to_string()))?;

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    let archive_ext = if download_url.ends_with(".zip") { "zip" } else { "tar.gz" };
    let archive_path = node_dir.join(format!("node_portable.{}", archive_ext));
    let mut file = std::fs::File::create(&archive_path)
        .map_err(|e| format!("Failed to create archive file: {}", e))?;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| humanize_network_error(&e.to_string()))?;
        file.write_all(&chunk).map_err(|e| format!("Write error: {}", e))?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let percent = 10 + (downloaded as f64 / total_size as f64 * 40.0) as u32;
            let _ = app.emit("setup-progress", serde_json::json!({
                "stage": "download_node",
                "message": format!("正在下载 Node.js... {:.1}MB / {:.1}MB", downloaded as f64 / 1_048_576.0, total_size as f64 / 1_048_576.0),
                "percent": percent.min(50)
            }));
        }
    }
    drop(file);

    // Step 5: Extract archive
    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "extract_node",
        "message": "正在解压 Node.js 运行环境...",
        "percent": 55
    }));

    if archive_ext == "zip" {
        extract_zip(&archive_path, &node_dir)?;
    } else {
        extract_tar_gz(&archive_path, &node_dir)?;
    }

    // Step 6: Cleanup archive to save space
    let _ = std::fs::remove_file(&archive_path);

    // Step 7: Verify binary exists
    let node_bin = get_node_binary()?;
    if !node_bin.exists() {
        return Err("Node.js extraction succeeded but binary not found".to_string());
    }

    // Make binary executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&node_bin, std::fs::Permissions::from_mode(0o755));
    }

    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "node_ready",
        "message": "✅ Node.js 运行环境就绪！",
        "percent": 60
    }));

    Ok(format!("Node.js installed at: {}", node_bin.display()))
}

/// Upgrade Node.js in sandbox: delete old version, download latest v22.
/// Unlike download_and_install_node, this always re-downloads even if node exists.
#[tauri::command]
pub async fn upgrade_node(app: tauri::AppHandle) -> Result<String, String> {
    let node_dir = get_node_dir()?;

    // Step 1: Remove existing sandbox node
    if node_dir.exists() {
        let _ = app.emit("setup-progress", serde_json::json!({
            "stage": "upgrade_node",
            "message": "正在清理旧版 Node.js...",
            "percent": 5
        }));
        std::fs::remove_dir_all(&node_dir)
            .map_err(|e| format!("删除旧版 Node.js 失败: {}", e))?;
    }

    // Step 2: Re-download using existing logic
    // download_and_install_node will now proceed since check_node_exists() returns false
    download_and_install_node(app).await
}

/// Get the directory where channel CLI packages are cached
pub fn get_channel_cli_dir() -> Result<PathBuf, String> {
    let dir = get_sandbox_dir()?.join("channel-cli");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create channel-cli dir: {}", e))?;
    Ok(dir)
}

/// Check if a channel CLI is already installed in sandbox
pub fn is_channel_cli_installed(pkg_name: &str) -> bool {
    if let Ok(cli_dir) = get_channel_cli_dir() {
        cli_dir.join("node_modules").join(pkg_name).exists()
    } else {
        false
    }
}

/// Pre-download channel CLI packages to sandbox so binding is instant.
/// Called when entering the Channels tab.
#[tauri::command]
pub async fn ensure_channel_cli(app: tauri::AppHandle) -> Result<String, String> {
    let cli_dir = get_channel_cli_dir()?;
    let node_bin = get_node_binary()?;
    let npm_cli = get_npm_binary()?;

    // Packages to ensure
    let packages = [
        "@tencent-weixin/openclaw-weixin-cli@latest",
        "@larksuite/openclaw-lark@latest",
    ];

    // Check which packages need installing
    let mut to_install: Vec<&str> = Vec::new();
    for pkg in &packages {
        let pkg_name = pkg.split('@').next().unwrap_or(pkg);
        // Handle scoped packages: @scope/name
        let dir_name = if pkg.starts_with('@') {
            // e.g. "@tencent-weixin/openclaw-weixin-cli@latest" → "@tencent-weixin/openclaw-weixin-cli"
            let without_version = pkg.rsplit_once('@').map(|(name, _)| name).unwrap_or(pkg);
            without_version
        } else {
            pkg_name
        };
        if !cli_dir.join("node_modules").join(dir_name).exists() {
            to_install.push(pkg);
        }
    }

    if to_install.is_empty() {
        return Ok("CLI 工具已就绪".to_string());
    }

    let _ = app.emit("channel-cli-progress", serde_json::json!({
        "status": "downloading",
        "message": format!("正在下载平台 CLI 工具 ({}/{})...", packages.len() - to_install.len(), packages.len()),
    }));

    // Create a minimal package.json if not exists
    let pkg_json = cli_dir.join("package.json");
    if !pkg_json.exists() {
        std::fs::write(&pkg_json, r#"{"name":"channel-cli","private":true}"#)
            .map_err(|e| format!("创建 package.json 失败: {}", e))?;
    }

    // Build npm install command: node npm-cli.js install pkg1 pkg2 --registry=...
    let mut args = vec![
        npm_cli.to_string_lossy().to_string(),
        "install".to_string(),
    ];
    for pkg in &to_install {
        args.push(pkg.to_string());
    }
    // Try China mirror first for faster downloads
    args.push("--registry=https://registry.npmmirror.com".to_string());

    let output = tokio::process::Command::new(&node_bin)
        .args(&args)
        .current_dir(&cli_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("npm install 失败: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Retry with official registry
        let mut retry_args = vec![
            npm_cli.to_string_lossy().to_string(),
            "install".to_string(),
        ];
        for pkg in &to_install {
            retry_args.push(pkg.to_string());
        }

        let retry_output = tokio::process::Command::new(&node_bin)
            .args(&retry_args)
            .current_dir(&cli_dir)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .output()
            .await
            .map_err(|e| format!("npm install (retry) 失败: {}", e))?;

        if !retry_output.status.success() {
            let retry_stderr = String::from_utf8_lossy(&retry_output.stderr);
            return Err(format!("CLI 工具下载失败: {}\n{}", stderr, retry_stderr));
        }
    }

    let _ = app.emit("channel-cli-progress", serde_json::json!({
        "status": "ready",
        "message": "CLI 工具已就绪",
    }));

    Ok("CLI 工具下载完成".to_string())
}

/// Extract a ZIP file
fn extract_zip(archive_path: &PathBuf, dest: &PathBuf) -> Result<(), String> {
    let file = std::fs::File::open(archive_path)
        .map_err(|e| format!("Failed to open zip: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read zip: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read zip entry {}: {}", i, e))?;

        let out_path = dest.join(file.mangled_name());

        if file.is_dir() {
            std::fs::create_dir_all(&out_path)
                .map_err(|e| format!("Failed to create dir: {}", e))?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent dir: {}", e))?;
            }
            let mut outfile = std::fs::File::create(&out_path)
                .map_err(|e| format!("Failed to create file: {}", e))?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract file: {}", e))?;
        }
    }

    Ok(())
}

/// Extract a tar.gz file (used on Linux/Mac)
fn extract_tar_gz(archive_path: &PathBuf, dest: &PathBuf) -> Result<(), String> {
    let output = std::process::Command::new("tar")
        .args(["-xzf", &archive_path.to_string_lossy(), "-C", &dest.to_string_lossy()])
        .output()
        .map_err(|e| format!("Failed to run tar: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("tar extraction failed: {}", stderr));
    }

    Ok(())
}

/// Quick test if a URL is reachable (3 second timeout)
async fn test_url_reachable(url: &str) -> bool {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .unwrap_or_default();

    client.head(url).send().await.is_ok()
}

/// Return sandbox info for frontend display
#[tauri::command]
pub fn get_environment_info() -> Result<serde_json::Value, String> {
    let sandbox = get_sandbox_dir()?;
    let node_installed = check_node_exists().unwrap_or(false);
    let node_path = get_node_binary().ok();

    Ok(serde_json::json!({
        "sandbox_dir": sandbox.to_string_lossy(),
        "node_installed": node_installed,
        "node_path": node_path.map(|p| p.to_string_lossy().to_string()),
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sandbox_dir_is_deterministic() {
        let dir1 = get_sandbox_dir().unwrap();
        let dir2 = get_sandbox_dir().unwrap();
        assert_eq!(dir1, dir2);
        assert!(dir1.ends_with("OpenClawLauncher"));
    }

    #[test]
    fn test_sandbox_dir_exists_after_creation() {
        let dir = get_sandbox_dir().unwrap();
        assert!(dir.exists());
        assert!(dir.is_dir());
    }

    #[test]
    fn test_node_dir_is_under_sandbox() {
        let sandbox = get_sandbox_dir().unwrap();
        let node_dir = get_node_dir().unwrap();
        assert!(node_dir.starts_with(&sandbox));
        assert!(node_dir.ends_with("node"));
    }

    #[test]
    fn test_node_binary_error_when_not_installed() {
        // In CI/test environments where node isn't installed in sandbox,
        // this should return an error gracefully (not panic)
        let result = get_node_binary();
        // It's OK if it returns an error — we just want it not to panic
        if let Err(e) = &result {
            assert!(!e.is_empty());
        }
    }
}
