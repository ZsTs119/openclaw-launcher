// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
import { Modal, ModalFooter } from "./ui/Modal";
import React from "react";

interface ConfirmModalProps {
    show: boolean;
    title: string;
    onCancel: () => void;
    onConfirm: () => void;
    confirmLabel?: string;
    children: React.ReactNode;
}

export function ConfirmModal({
    show, title, onCancel, onConfirm, confirmLabel = "确认", children,
}: ConfirmModalProps) {
    return (
        <Modal show={show} title={title} maxWidth={420}>
            <div className="modal-desc" style={{ textAlign: "left" }}>
                {children}
            </div>
            <ModalFooter>
                <button className="btn-secondary" onClick={onCancel}>取消</button>
                <button className="btn-danger" onClick={onConfirm}>{confirmLabel}</button>
            </ModalFooter>
        </Modal>
    );
}
