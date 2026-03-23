// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
/**
 * FileTree Component
 *
 * Reusable collapsible file tree component.
 * Renders files and directories with expand/collapse, icons, and file sizes.
 */

import { useState, useMemo } from "react";
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown } from "lucide-react";
import type { SkillFile } from "../../types";

export interface TreeNode {
    name: string;
    path: string;         // full absolute path
    relativePath: string; // relative to skill root
    isDir: boolean;
    size: number;
    children: TreeNode[];
}

interface FileTreeProps {
    files: SkillFile[];
    skillPath: string;
    selectedFile: string | null;
    onFileSelect: (filePath: string) => void;
}

/** Convert flat SkillFile[] into nested TreeNode[] */
function buildTree(files: SkillFile[], skillPath: string): TreeNode[] {
    const root: TreeNode[] = [];
    const dirMap = new Map<string, TreeNode>();

    // Sort: dirs first, then alphabetical
    const sorted = [...files].sort((a, b) => {
        if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
        return a.relative_path.localeCompare(b.relative_path);
    });

    for (const f of sorted) {
        const parts = f.relative_path.split("/");
        const node: TreeNode = {
            name: f.name,
            path: `${skillPath}/${f.relative_path}`,
            relativePath: f.relative_path,
            isDir: f.is_dir,
            size: f.size,
            children: [],
        };

        if (f.is_dir) {
            dirMap.set(f.relative_path, node);
        }

        if (parts.length === 1) {
            root.push(node);
        } else {
            const parentPath = parts.slice(0, -1).join("/");
            const parent = dirMap.get(parentPath);
            if (parent) {
                parent.children.push(node);
            } else {
                root.push(node);
            }
        }
    }

    return root;
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
}

function TreeItem({ node, selectedFile, onFileSelect, depth }: {
    node: TreeNode;
    selectedFile: string | null;
    onFileSelect: (path: string) => void;
    depth: number;
}) {
    const [expanded, setExpanded] = useState(depth === 0); // auto-expand root dirs

    const handleClick = () => {
        if (node.isDir) {
            setExpanded(!expanded);
        } else {
            onFileSelect(node.path);
        }
    };

    const isSelected = selectedFile === node.path;

    return (
        <>
            <div
                className={`tree-item ${isSelected ? "selected" : ""} ${node.isDir ? "is-dir" : ""}`}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={handleClick}
            >
                {node.isDir ? (
                    <>
                        {expanded
                            ? <ChevronDown size={12} className="tree-chevron" />
                            : <ChevronRight size={12} className="tree-chevron" />}
                        {expanded
                            ? <FolderOpen size={14} className="tree-icon dir" />
                            : <Folder size={14} className="tree-icon dir" />}
                    </>
                ) : (
                    <>
                        <span className="tree-chevron-spacer" />
                        <FileText size={14} className="tree-icon" />
                    </>
                )}
                <span className="tree-name">{node.name}</span>
                {!node.isDir && <span className="tree-size">{formatSize(node.size)}</span>}
            </div>
            {node.isDir && expanded && node.children.map(child => (
                <TreeItem
                    key={child.relativePath}
                    node={child}
                    selectedFile={selectedFile}
                    onFileSelect={onFileSelect}
                    depth={depth + 1}
                />
            ))}
        </>
    );
}

export function FileTree({ files, skillPath, selectedFile, onFileSelect }: FileTreeProps) {
    const tree = useMemo(() => buildTree(files, skillPath), [files, skillPath]);

    if (tree.length === 0) {
        return <div className="tree-empty">无文件</div>;
    }

    return (
        <div className="file-tree">
            {tree.map(node => (
                <TreeItem
                    key={node.relativePath}
                    node={node}
                    selectedFile={selectedFile}
                    onFileSelect={onFileSelect}
                    depth={0}
                />
            ))}
        </div>
    );
}
