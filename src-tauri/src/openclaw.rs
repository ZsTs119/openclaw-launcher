use std::path::PathBuf;
use std::io::Write;
use std::process::Stdio;
use futures_util::StreamExt;
use tauri::Emitter;

use crate::environment;

const OPENCLAW_REPO: &str = "openclaw/openclaw";
const OPENCLAW_DIR_NAME: &str = "openclaw-engine";

/// Get path to the local OpenClaw source directory in sandbox
pub fn get_openclaw_dir() -> Result<PathBuf, String> {
    Ok(environment::get_sandbox_dir()?.join(OPENCLAW_DIR_NAME))
}

/// Check if OpenClaw source is already installed
#[tauri::command]
pub fn check_openclaw_exists() -> Result<bool, String> {
    let dir = get_openclaw_dir()?;
    // Check for package.json as indicator of valid source
    Ok(dir.join("package.json").exists())
}

/// Check if node_modules is installed
#[tauri::command]
pub fn check_node_modules_exists() -> Result<bool, String> {
    let dir = get_openclaw_dir()?;
    Ok(dir.join("node_modules").exists())
}

/// Download OpenClaw source code as ZIP and extract.
/// Uses GitHub mirror fallback for China users.
#[tauri::command]
pub async fn download_openclaw_source(app: tauri::AppHandle) -> Result<String, String> {
    if check_openclaw_exists()? {
        return Ok("OpenClaw source already exists".to_string());
    }

    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "download_openclaw",
        "message": "正在获取 OpenClaw 最新源码...",
        "percent": 62
    }));

    // Primary: GitHub, Fallback: GitHub mirror services
    let primary_url = format!(
        "https://github.com/{}/archive/refs/heads/main.zip",
        OPENCLAW_REPO
    );
    let fallback_urls = vec![
        format!(
            "https://ghfast.top/https://github.com/{}/archive/refs/heads/main.zip",
            OPENCLAW_REPO
        ),
        format!(
            "https://mirror.ghproxy.com/https://github.com/{}/archive/refs/heads/main.zip",
            OPENCLAW_REPO
        ),
    ];

    // Try primary first
    let download_url = if test_url_reachable(&primary_url).await {
        primary_url.clone()
    } else {
        let _ = app.emit("setup-progress", serde_json::json!({
            "stage": "download_openclaw",
            "message": "GitHub 连接缓慢，切换加速镜像...",
            "percent": 63
        }));
        // Try fallback URLs
        let mut found_url = None;
        for fallback in &fallback_urls {
            if test_url_reachable(fallback).await {
                found_url = Some(fallback.clone());
                break;
            }
        }
        found_url.unwrap_or(primary_url)
    };

    // Download ZIP
    let response = reqwest::get(&download_url)
        .await
        .map_err(|e| format!("下载 OpenClaw 源码失败: {}。请检查网络连接。", e))?;

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    let sandbox = environment::get_sandbox_dir()?;
    let zip_path = sandbox.join("openclaw-source.zip");
    let mut file = std::fs::File::create(&zip_path)
        .map_err(|e| format!("创建临时文件失败: {}", e))?;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("下载数据流错误: {}", e))?;
        file.write_all(&chunk).map_err(|e| format!("写入错误: {}", e))?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let percent = 65 + (downloaded as f64 / total_size as f64 * 15.0) as u32;
            let _ = app.emit("setup-progress", serde_json::json!({
                "stage": "download_openclaw",
                "message": format!("正在下载 OpenClaw 源码... {:.1}MB / {:.1}MB",
                    downloaded as f64 / 1_048_576.0,
                    total_size as f64 / 1_048_576.0),
                "percent": percent.min(80)
            }));
        }
    }
    drop(file);

    // Extract ZIP
    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "extract_openclaw",
        "message": "正在解压 OpenClaw 源码...",
        "percent": 82
    }));

    // Extract to a temp location first, then rename
    let temp_extract = sandbox.join("_openclaw_temp");
    if temp_extract.exists() {
        let _ = std::fs::remove_dir_all(&temp_extract);
    }
    std::fs::create_dir_all(&temp_extract)
        .map_err(|e| format!("创建临时目录失败: {}", e))?;

    extract_zip(&zip_path, &temp_extract)?;

    // GitHub ZIPs extract to repo-name-branch/ (e.g., openclaw-main/)
    // Find the extracted directory and rename it
    let openclaw_dir = get_openclaw_dir()?;
    if openclaw_dir.exists() {
        let _ = std::fs::remove_dir_all(&openclaw_dir);
    }

    let mut found = false;
    if let Ok(entries) = std::fs::read_dir(&temp_extract) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                // This should be the single extracted directory like "openclaw-main"
                std::fs::rename(&path, &openclaw_dir)
                    .map_err(|e| format!("移动源码目录失败: {}", e))?;
                found = true;
                break;
            }
        }
    }

    if !found {
        return Err("解压后未找到源码目录".to_string());
    }

    // Cleanup
    let _ = std::fs::remove_file(&zip_path);
    let _ = std::fs::remove_dir_all(&temp_extract);

    // Verify package.json exists
    if !openclaw_dir.join("package.json").exists() {
        return Err("解压成功但未找到 package.json，源码可能不完整".to_string());
    }

    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "openclaw_ready",
        "message": "✅ OpenClaw 源码获取完成！",
        "percent": 85
    }));

    Ok(format!("OpenClaw source at: {}", openclaw_dir.display()))
}

/// Run `npm install --omit=dev` using sandboxed Node.js
/// Automatically sets Taobao registry mirror if main registry is slow
#[tauri::command]
pub async fn run_npm_install(app: tauri::AppHandle) -> Result<String, String> {
    let openclaw_dir = get_openclaw_dir()?;
    if !openclaw_dir.join("package.json").exists() {
        return Err("OpenClaw 源码未找到，请先下载源码".to_string());
    }

    if check_node_modules_exists()? {
        return Ok("node_modules already installed".to_string());
    }

    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "npm_install",
        "message": "正在安装 OpenClaw 依赖包 (这可能需要几分钟)...",
        "percent": 87
    }));

    // Get sandboxed Node/NPM paths
    let node_bin = environment::get_node_binary()?;
    let npm_bin = environment::get_npm_binary()?;

    // Test if default npm registry is reachable
    let use_mirror = !test_url_reachable("https://registry.npmjs.org/").await;

    // Build npm install command
    let mut cmd = std::process::Command::new(&node_bin);
    cmd.arg(&npm_bin)
        .arg("install")
        .arg("--omit=dev")
        .current_dir(&openclaw_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Add PATH so npm can find node
    let node_dir = node_bin.parent().unwrap().to_path_buf();
    if let Some(current_path) = std::env::var_os("PATH") {
        let mut paths = std::env::split_paths(&current_path).collect::<Vec<_>>();
        paths.insert(0, node_dir.clone());
        let new_path = std::env::join_paths(paths).unwrap_or_default();
        cmd.env("PATH", new_path);
    } else {
        cmd.env("PATH", &node_dir);
    }

    // Use Taobao mirror if default registry is slow
    if use_mirror {
        let _ = app.emit("setup-progress", serde_json::json!({
            "stage": "npm_install",
            "message": "NPM 官方源连接慢，已切换淘宝镜像加速...",
            "percent": 88
        }));
        cmd.arg("--registry=https://registry.npmmirror.com");
    }

    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "npm_install",
        "message": "正在执行 npm install (请耐心等待)...",
        "percent": 90
    }));

    // Execute npm install
    let output = cmd.output()
        .map_err(|e| format!("执行 npm install 失败: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);

        // If first attempt failed, try with mirror
        if !use_mirror {
            let _ = app.emit("setup-progress", serde_json::json!({
                "stage": "npm_install",
                "message": "安装失败，正在使用淘宝镜像重试...",
                "percent": 91
            }));

            let mut retry_cmd = std::process::Command::new(&node_bin);
            retry_cmd.arg(&npm_bin)
                .arg("install")
                .arg("--omit=dev")
                .arg("--registry=https://registry.npmmirror.com")
                .current_dir(&openclaw_dir)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());

            let retry_node_dir = node_bin.parent().unwrap().to_path_buf();
            if let Some(current_path) = std::env::var_os("PATH") {
                let mut paths = std::env::split_paths(&current_path).collect::<Vec<_>>();
                paths.insert(0, retry_node_dir);
                let new_path = std::env::join_paths(paths).unwrap_or_default();
                retry_cmd.env("PATH", new_path);
            }

            let retry_output = retry_cmd.output()
                .map_err(|e| format!("NPM 重试失败: {}", e))?;

            if !retry_output.status.success() {
                let retry_stderr = String::from_utf8_lossy(&retry_output.stderr);
                return Err(format!("npm install 失败:\n{}", retry_stderr));
            }
        } else {
            return Err(format!(
                "npm install 失败:\nstdout: {}\nstderr: {}",
                stdout, stderr
            ));
        }
    }

    // Verify node_modules was created
    if !openclaw_dir.join("node_modules").exists() {
        return Err("npm install 执行完毕但 node_modules 目录未创建".to_string());
    }

    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "npm_done",
        "message": "✅ 所有依赖安装完成！",
        "percent": 98
    }));

    Ok("npm install completed successfully".to_string())
}

/// Extract a ZIP file (shared utility)
fn extract_zip(archive_path: &PathBuf, dest: &PathBuf) -> Result<(), String> {
    let file = std::fs::File::open(archive_path)
        .map_err(|e| format!("打开压缩包失败: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("读取压缩包失败: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("读取压缩包条目 {} 失败: {}", i, e))?;

        let out_path = dest.join(file.mangled_name());

        if file.is_dir() {
            std::fs::create_dir_all(&out_path)
                .map_err(|e| format!("创建目录失败: {}", e))?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("创建父目录失败: {}", e))?;
            }
            let mut outfile = std::fs::File::create(&out_path)
                .map_err(|e| format!("创建文件失败: {}", e))?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("解压文件失败: {}", e))?;
        }
    }

    Ok(())
}

/// Quick URL reachability test (3 second timeout)
async fn test_url_reachable(url: &str) -> bool {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .unwrap_or_default();

    client.head(url).send().await.is_ok()
}

/// Full setup pipeline: download source + install deps
#[tauri::command]
pub async fn setup_openclaw(app: tauri::AppHandle) -> Result<String, String> {
    // Step 1: Ensure Node.js is ready
    if !environment::check_node_exists()? {
        environment::download_and_install_node(app.clone()).await?;
    }

    // Step 2: Download OpenClaw source
    download_openclaw_source(app.clone()).await?;

    // Step 3: Install npm dependencies
    run_npm_install(app.clone()).await?;

    let _ = app.emit("setup-progress", serde_json::json!({
        "stage": "all_done",
        "message": "🎉 OpenClaw 安装完成！可以点击启动了！",
        "percent": 100
    }));

    Ok("OpenClaw setup completed successfully".to_string())
}
