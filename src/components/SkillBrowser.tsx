/**
 * SkillBrowser — 技能市场弹窗
 * Fetches skills from curated registry, shows search/filter.
 */

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Modal } from "./ui/Modal";
import { Download, Check, Loader2, Store } from "lucide-react";
import { CustomDropdown } from "./ui/CustomDropdown";
import "../styles/skill-browser.css";

interface RegistrySkill {
    slug: string;
    name: string;
    description: string;
    author: string;
    repo: string;
    path: string;
    category: string;
    tags: string[];
}

interface RegistryCategory {
    id: string;
    name: string;
}

interface SkillRegistry {
    version: number;
    updated: string;
    skills: RegistrySkill[];
    categories: RegistryCategory[];
}

interface MarketplaceSkillInfo {
    slug: string;
    has_skill_md: boolean;
}

interface SkillBrowserProps {
    show: boolean;
    onClose: () => void;
    onRefresh?: () => void;
}

export function SkillBrowser({ show, onClose, onRefresh }: SkillBrowserProps) {
    const [registry, setRegistry] = useState<SkillRegistry | null>(null);
    const [installed, setInstalled] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("all");
    const [downloading, setDownloading] = useState<Set<string>>(new Set());

    // Load registry + installed list
    const loadData = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [reg, list] = await Promise.all([
                invoke<SkillRegistry>("fetch_skill_registry"),
                invoke<MarketplaceSkillInfo[]>("list_marketplace_skills"),
            ]);
            setRegistry(reg);
            setInstalled(new Set(list.map(s => s.slug)));
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (show) {
            loadData();
        }
    }, [show, loadData]);

    // Download a skill
    const handleDownload = async (skill: RegistrySkill) => {
        setDownloading(prev => new Set(prev).add(skill.slug));
        try {
            await invoke("download_marketplace_skill", {
                slug: skill.slug,
                repo: skill.repo,
                path: skill.path,
            });
            setInstalled(prev => new Set(prev).add(skill.slug));
        } catch (err) {
            console.error("Download failed:", err);
        } finally {
            setDownloading(prev => {
                const next = new Set(prev);
                next.delete(skill.slug);
                return next;
            });
        }
    };

    // Uninstall a skill
    const handleUninstall = async (slug: string) => {
        try {
            await invoke("uninstall_marketplace_skill", { slug });
            setInstalled(prev => {
                const next = new Set(prev);
                next.delete(slug);
                return next;
            });
        } catch (err) {
            console.error("Uninstall failed:", err);
        }
    };

    // Filter skills
    const filtered = registry?.skills.filter(s => {
        const matchesSearch = search === "" ||
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.description.toLowerCase().includes(search.toLowerCase()) ||
            s.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
        const matchesCategory = category === "all" || s.category === category;
        return matchesSearch && matchesCategory;
    }) || [];

    const handleClose = () => {
        onClose();
        if (installed.size > 0) {
            onRefresh?.();
        }
    };

    return (
        <Modal show={show} onClose={handleClose} title="技能市场" maxWidth={600}>
            <div className="skill-browser-content">
                {/* Toolbar */}
                <div className="skill-browser-toolbar">
                    <input
                        className="skill-browser-search"
                        type="text"
                        placeholder="搜索技能..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {registry && (
                        <CustomDropdown
                            options={registry.categories.map(c => ({ value: c.id, label: c.name }))}
                            value={category}
                            onChange={(v) => setCategory(v)}
                            placeholder="全部"
                        />
                    )}
                </div>

                {/* Content */}
                {loading ? (
                    <div className="skill-browser-loading">
                        <Loader2 size={20} className="spin" /> 加载注册表中...
                    </div>
                ) : error ? (
                    <div className="skill-browser-error">{error}</div>
                ) : filtered.length === 0 ? (
                    <div className="skill-browser-empty">
                        {search || category !== "all" ? "无匹配技能" : "注册表为空"}
                    </div>
                ) : (
                    <div className="skill-browser-list">
                        {filtered.map(skill => {
                            const isInstalled = installed.has(skill.slug);
                            const isDownloading = downloading.has(skill.slug);

                            return (
                                <div key={skill.slug} className="skill-card">
                                    <div className="skill-card-info">
                                        <div className="skill-card-name">{skill.name}</div>
                                        <div className="skill-card-desc">{skill.description}</div>
                                        <div className="skill-card-meta">
                                            <span className="skill-card-author">by {skill.author}</span>
                                            {skill.tags.slice(0, 2).map(t => (
                                                <span key={t} className="skill-card-tag">{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="skill-card-action">
                                        {isInstalled ? (
                                            <button
                                                className="skill-download-btn installed"
                                                onClick={() => handleUninstall(skill.slug)}
                                                title="点击卸载"
                                            >
                                                <Check size={12} /> 已下载
                                            </button>
                                        ) : (
                                            <button
                                                className={`skill-download-btn ${isDownloading ? "downloading" : ""}`}
                                                onClick={() => handleDownload(skill)}
                                                disabled={isDownloading}
                                            >
                                                {isDownloading ? (
                                                    <><Loader2 size={12} className="spin" /> 下载中</>
                                                ) : (
                                                    <><Download size={12} /> 下载</>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Footer info */}
                {registry && !loading && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>
                        共 {registry.skills.length} 个技能 · 更新于 {registry.updated}
                    </div>
                )}
            </div>
        </Modal>
    );
}

/** Small button to open skill browser from AgentsTab */
export function SkillMarketButton({ onClick }: { onClick: () => void }) {
    return (
        <button className="skill-market-btn" onClick={onClick}>
            <Store size={13} /> 技能市场
        </button>
    );
}
