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

/// Get the npm binary path (relative to node)
pub fn get_npm_binary() -> Result<PathBuf, String> {
    let node_bin = get_node_binary()?;
    let npm = if cfg!(target_os = "windows") {
        node_bin.parent().unwrap().join("npm.cmd")
    } else {
        node_bin.parent().unwrap().join("npm")
    };
    if npm.exists() {
        Ok(npm)
    } else {
        Err("npm binary not found".to_string())
    }
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
        .map_err(|e| format!("Download failed: {}. Please check your network.", e))?;

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    let archive_ext = if download_url.ends_with(".zip") { "zip" } else { "tar.gz" };
    let archive_path = node_dir.join(format!("node_portable.{}", archive_ext));
    let mut file = std::fs::File::create(&archive_path)
        .map_err(|e| format!("Failed to create archive file: {}", e))?;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download stream error: {}", e))?;
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
