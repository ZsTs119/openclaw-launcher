// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
import { Modal, ModalFooter } from "./ui/Modal";
import React, { useState, useEffect } from "react";

interface ConfirmModalProps {
    show: boolean;
    title: string;
    onCancel: () => void;
    onConfirm: () => void;
    confirmLabel?: string;
    /** Countdown in seconds before confirm button becomes clickable */
    countdown?: number;
    children: React.ReactNode;
}

export function ConfirmModal({
    show, title, onCancel, onConfirm, confirmLabel = "确认", countdown, children,
}: ConfirmModalProps) {
    const [remaining, setRemaining] = useState(0);

    useEffect(() => {
        if (show && countdown && countdown > 0) {
            setRemaining(countdown);
            const timer = setInterval(() => {
                setRemaining((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        } else {
            setRemaining(0);
        }
    }, [show, countdown]);

    const disabled = remaining > 0;
    const label = disabled ? `${confirmLabel} (${remaining}s)` : confirmLabel;

    return (
        <Modal show={show} title={title} maxWidth={420}>
            <div className="modal-desc" style={{ textAlign: "left" }}>
                {children}
            </div>
            <ModalFooter>
                <button className="btn-secondary" onClick={onCancel}>取消</button>
                <button
                    className="btn-danger"
                    onClick={onConfirm}
                    disabled={disabled}
                    style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                >
                    {label}
                </button>
            </ModalFooter>
        </Modal>
    );
}
