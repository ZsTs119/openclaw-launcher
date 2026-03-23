// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
/**
 * SkillDetailModal Component
 *
 * Shows skill detail with split layout:
 * - Top: title, description, path
 * - Bottom-left: collapsible file tree
 * - Bottom-right: file content preview (read-only)
 */

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Modal } from "./ui/Modal";
import { FileTree } from "./ui/FileTree";
import type { SkillInfo, SkillFile } from "../types";
import "../styles/skill-detail.css";

interface SkillDetailModalProps {
    show: boolean;
    skill: SkillInfo | null;
    onClose: () => void;
}

export function SkillDetailModal({ show, skill, onClose }: SkillDetailModalProps) {
    const [files, setFiles] = useState<SkillFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string>("");
    const [loadingContent, setLoadingContent] = useState(false);

    // Load file tree when modal opens
    useEffect(() => {
        if (!show || !skill) {
            setFiles([]);
            setSelectedFile(null);
            setFileContent("");
            return;
        }

        (async () => {
            try {
                const result = await invoke<SkillFile[]>("get_skill_detail", { skillPath: skill.path });
                setFiles(result);

                // Auto-select first readable file (prefer SKILL.md)
                const skillMd = result.find(f => !f.is_dir && f.name === "SKILL.md");
                const firstFile = skillMd || result.find(f => !f.is_dir);
                if (firstFile) {
                    const fullPath = `${skill.path}/${firstFile.relative_path}`;
                    setSelectedFile(fullPath);
                }
            } catch {
                setFiles([]);
            }
        })();
    }, [show, skill]);

    // Read file content when selected file changes
    const handleFileSelect = useCallback((filePath: string) => {
        setSelectedFile(filePath);
    }, []);

    useEffect(() => {
        if (!selectedFile) {
            setFileContent("");
            return;
        }

        let cancelled = false;
        setLoadingContent(true);

        (async () => {
            try {
                const content = await invoke<string>("read_skill_file", { filePath: selectedFile });
                if (!cancelled) setFileContent(content);
            } catch (e) {
                if (!cancelled) setFileContent(`无法读取文件: ${e}`);
            } finally {
                if (!cancelled) setLoadingContent(false);
            }
        })();

        return () => { cancelled = true; };
    }, [selectedFile]);

    const selectedFileName = selectedFile?.split("/").pop() || "";

    return (
        <Modal show={show} onClose={onClose} title={skill?.name || "技能详情"} maxWidth={800}>
            {skill && (
                <div className="skill-detail-v2">
                    {/* Top: info */}
                    <div className="sd-info">
                        <div className="sd-description">{skill.description || "无描述"}</div>
                        <div className="sd-path">
                            <code>{skill.path}</code>
                        </div>
                    </div>

                    {/* Bottom: split layout */}
                    <div className="sd-split">
                        {/* Left: file tree */}
                        <div className="sd-tree-panel">
                            <div className="sd-panel-title">文件目录</div>
                            <FileTree
                                files={files}
                                skillPath={skill.path}
                                selectedFile={selectedFile}
                                onFileSelect={handleFileSelect}
                            />
                        </div>

                        {/* Right: file preview */}
                        <div className="sd-preview-panel">
                            <div className="sd-panel-title">
                                {selectedFileName || "选择文件预览"}
                            </div>
                            <div className="sd-preview-content">
                                {loadingContent ? (
                                    <div className="sd-preview-loading">加载中...</div>
                                ) : fileContent ? (
                                    <pre className="sd-preview-code">{fileContent}</pre>
                                ) : (
                                    <div className="sd-preview-empty">点击左侧文件查看内容</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
}
