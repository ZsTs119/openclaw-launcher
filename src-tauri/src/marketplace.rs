// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// Skill Marketplace: fetch registry, download/uninstall/list marketplace skills

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// A single skill entry from the registry
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RegistrySkill {
    pub slug: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub repo: String,
    pub path: String,
    pub category: String,
    pub tags: Vec<String>,
}

/// Category definition
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RegistryCategory {
    pub id: String,
    pub name: String,
}

/// Full registry response
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SkillRegistry {
    pub version: u32,
    pub updated: String,
    pub skills: Vec<RegistrySkill>,
    pub categories: Vec<RegistryCategory>,
}

/// Info about a locally downloaded marketplace skill
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MarketplaceSkillInfo {
    pub slug: String,
    pub has_skill_md: bool,
}

/// Central storage: ~/.openclaw/marketplace-skills/
fn marketplace_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("无法获取 home 目录")?;
    let dir = home.join(".openclaw").join("marketplace-skills");
    Ok(dir)
}

// ─── Registry URL ───────────────────────────────
const REGISTRY_URL: &str = "https://raw.githubusercontent.com/ZsTs119/openclaw-launcher/v3-dev/docs/skills-registry.json";

/// Fetch the skill registry JSON from GitHub
#[tauri::command]
pub async fn fetch_skill_registry() -> Result<SkillRegistry, String> {
    let resp = reqwest::get(REGISTRY_URL)
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("注册表请求失败: HTTP {}", resp.status()));
    }

    let registry: SkillRegistry = resp
        .json()
        .await
        .map_err(|e| format!("解析注册表失败: {}", e))?;

    Ok(registry)
}

/// Download a skill from GitHub to marketplace-skills/{slug}/
#[tauri::command]
pub async fn download_marketplace_skill(
    slug: String,
    repo: String,
    path: String,
) -> Result<(), String> {
    let dir = marketplace_dir()?;
    let skill_dir = dir.join(&slug);

    // Already installed?
    if skill_dir.join("SKILL.md").exists() {
        return Err(format!("技能 '{}' 已下载", slug));
    }

    fs::create_dir_all(&skill_dir)
        .map_err(|e| format!("创建目录失败: {}", e))?;

    // Parse repo URL → raw content base
    // https://github.com/user/repo → https://raw.githubusercontent.com/user/repo/main/
    let raw_base = repo_to_raw_base(&repo, &path)?;

    // Always download SKILL.md first
    let skill_md_url = if path.is_empty() {
        format!("{}/SKILL.md", raw_base)
    } else {
        format!("{}/{}/SKILL.md", raw_base, path)
    };

    let content = fetch_file_content(&skill_md_url).await?;
    fs::write(skill_dir.join("SKILL.md"), &content)
        .map_err(|e| format!("写入 SKILL.md 失败: {}", e))?;

    // Try to discover and download additional files via GitHub API
    let api_url = repo_to_api_url(&repo, &path)?;
    if let Ok(files) = list_github_dir(&api_url).await {
        for file in files {
            if file == "SKILL.md" {
                continue; // Already downloaded
            }
            let file_url = if path.is_empty() {
                format!("{}/{}", raw_base, file)
            } else {
                format!("{}/{}/{}", raw_base, path, file)
            };

            if let Ok(file_content) = fetch_file_content(&file_url).await {
                // Create subdirectories if needed (e.g., scripts/foo.sh)
                let target = skill_dir.join(&file);
                if let Some(parent) = target.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                let _ = fs::write(&target, &file_content);
            }
        }
    }

    // Verify SKILL.md exists
    if !skill_dir.join("SKILL.md").exists() {
        // Cleanup on failure
        let _ = fs::remove_dir_all(&skill_dir);
        return Err("下载失败: SKILL.md 不存在".to_string());
    }

    Ok(())
}

/// Uninstall a marketplace skill
#[tauri::command]
pub fn uninstall_marketplace_skill(slug: String) -> Result<(), String> {
    let dir = marketplace_dir()?;
    let skill_dir = dir.join(&slug);

    if !skill_dir.exists() {
        return Err(format!("技能 '{}' 未安装", slug));
    }

    fs::remove_dir_all(&skill_dir)
        .map_err(|e| format!("删除失败: {}", e))?;

    // Cascade cleanup: remove this slug from all agents' skills config
    crate::agents::remove_skill_from_all_agents(&slug)?;

    Ok(())
}

/// List all downloaded marketplace skills
#[tauri::command]
pub fn list_marketplace_skills() -> Result<Vec<MarketplaceSkillInfo>, String> {
    let dir = marketplace_dir()?;

    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut skills = Vec::new();
    let entries = fs::read_dir(&dir)
        .map_err(|e| format!("读取市场目录失败: {}", e))?;

    for entry in entries.flatten() {
        if entry.path().is_dir() {
            let slug = entry.file_name().to_string_lossy().to_string();
            let has_skill_md = entry.path().join("SKILL.md").exists();
            skills.push(MarketplaceSkillInfo { slug, has_skill_md });
        }
    }

    Ok(skills)
}

// ─── Helper functions ───────────────────────────

/// Convert GitHub repo URL to raw.githubusercontent.com base
fn repo_to_raw_base(repo: &str, _path: &str) -> Result<String, String> {
    // https://github.com/user/repo → https://raw.githubusercontent.com/user/repo/main
    let trimmed = repo.trim_end_matches('/');
    if let Some(suffix) = trimmed.strip_prefix("https://github.com/") {
        Ok(format!("https://raw.githubusercontent.com/{}/main", suffix))
    } else {
        Err(format!("不支持的仓库 URL 格式: {}", repo))
    }
}

/// Convert GitHub repo URL to API URL for directory listing
fn repo_to_api_url(repo: &str, path: &str) -> Result<String, String> {
    let trimmed = repo.trim_end_matches('/');
    if let Some(suffix) = trimmed.strip_prefix("https://github.com/") {
        if path.is_empty() {
            Ok(format!("https://api.github.com/repos/{}/contents", suffix))
        } else {
            Ok(format!("https://api.github.com/repos/{}/contents/{}", suffix, path))
        }
    } else {
        Err(format!("不支持的仓库 URL 格式: {}", repo))
    }
}

/// Fetch raw file content from URL
async fn fetch_file_content(url: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get(url)
        .header("User-Agent", "OpenClaw-Launcher")
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}: {}", resp.status(), url));
    }

    resp.text()
        .await
        .map_err(|e| format!("读取内容失败: {}", e))
}

/// GitHub Contents API item
#[derive(Deserialize)]
struct GithubContentItem {
    name: String,
    #[serde(rename = "type")]
    item_type: String,
    path: Option<String>,
}

/// List files in a GitHub directory via Contents API
async fn list_github_dir(api_url: &str) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get(api_url)
        .header("User-Agent", "OpenClaw-Launcher")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("GitHub API 请求失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API 返回 {}", resp.status()));
    }

    let items: Vec<GithubContentItem> = resp
        .json()
        .await
        .map_err(|e| format!("解析 GitHub API 响应失败: {}", e))?;

    // Collect file names (flatten directories one level)
    let mut files = Vec::new();
    for item in &items {
        if item.item_type == "file" {
            files.push(item.name.clone());
        }
    }

    Ok(files)
}
