// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/// Diagnostics export module
///
/// Provides the `export_diagnostics_zip` Tauri command to collect
/// config, logs, and system info into a ZIP file for troubleshooting.

use std::io::Write;
use crate::environment;
use crate::paths;

/// Export diagnostics data as a ZIP file.
///
/// Collects: sanitized config, frontend logs, and system environment info.
/// The user chooses the save path via a file dialog on the frontend side.
#[tauri::command]
pub async fn export_diagnostics_zip(
    save_path: String,
    logs: Vec<String>,
) -> Result<String, String> {
    let file = std::fs::File::create(&save_path)
        .map_err(|e| format!("Failed to create ZIP file: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options: zip::write::FileOptions<()> = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // 1. Sanitized config (mask API keys)
    let openclaw_dir = paths::get_openclaw_dir()?;
    let config_path = openclaw_dir.join("openclaw.json");
    if config_path.exists() {
        let config_content = std::fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read config: {}", e))?;
        // Mask any API keys in the config
        let sanitized = mask_api_keys(&config_content);
        zip.start_file("openclaw_config.json", options)
            .map_err(|e| format!("ZIP error: {}", e))?;
        zip.write_all(sanitized.as_bytes())
            .map_err(|e| format!("ZIP write error: {}", e))?;
    }

    // 2. Frontend logs
    if !logs.is_empty() {
        zip.start_file("frontend_logs.txt", options)
            .map_err(|e| format!("ZIP error: {}", e))?;
        let log_content = logs.join("\n");
        zip.write_all(log_content.as_bytes())
            .map_err(|e| format!("ZIP write error: {}", e))?;
    }

    // 3. System info
    let sandbox_dir = environment::get_sandbox_dir()?;
    let sys_info = format!(
        "OS: {} {}\nArch: {}\nSandbox: {}\nOpenClaw Dir: {}\nTimestamp: {}",
        std::env::consts::OS,
        std::env::consts::ARCH,
        std::env::consts::ARCH,
        sandbox_dir.display(),
        openclaw_dir.display(),
        {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            format!("{}", now)
        },
    );
    zip.start_file("system_info.txt", options)
        .map_err(|e| format!("ZIP error: {}", e))?;
    zip.write_all(sys_info.as_bytes())
        .map_err(|e| format!("ZIP write error: {}", e))?;

    zip.finish()
        .map_err(|e| format!("Failed to finalize ZIP: {}", e))?;

    Ok(save_path)
}

/// Mask API key values in a JSON string for privacy.
fn mask_api_keys(content: &str) -> String {
    // Simple regex-free approach: find "api_key" or "apiKey" patterns and mask values
    let mut result = content.to_string();
    // Mask patterns like "api_key": "sk-xxxxx" -> "api_key": "sk-****"
    for key in &["api_key", "apiKey", "API_KEY"] {
        let search = format!("\"{}\"", key);
        if let Some(key_pos) = result.find(&search) {
            // Find the value after the colon
            if let Some(colon_pos) = result[key_pos..].find(':') {
                let after_colon = key_pos + colon_pos + 1;
                if let Some(quote_start) = result[after_colon..].find('"') {
                    let value_start = after_colon + quote_start + 1;
                    if let Some(quote_end) = result[value_start..].find('"') {
                        let value_end = value_start + quote_end;
                        let original_value = &result[value_start..value_end];
                        if original_value.len() > 6 {
                            let masked = format!("{}****", &original_value[..6]);
                            result = format!("{}{}{}", &result[..value_start], masked, &result[value_end..]);
                        }
                    }
                }
            }
        }
    }
    result
}
