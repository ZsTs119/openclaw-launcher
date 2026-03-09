// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/**
 * useLogs Hook
 *
 * Manages application logs with auto-scroll, ANSI stripping,
 * and human-readable translation.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import type { LogEntry } from "../types";
import { humanizeLog } from "../utils/log-humanizer";
import { stripAnsi } from "../utils/ansi-strip";

export function useLogs() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [repairToast, setRepairToast] = useState(false);
    const logRef = useRef<HTMLDivElement>(null);

    const addLog = useCallback((level: string, message: string) => {
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
        const cleanMsg = stripAnsi(message);
        const humanized = humanizeLog(cleanMsg);
        setLogs((prev) => [...prev.slice(-300), { time, level, message: cleanMsg, humanized }]);

        // Auto-detect connection auth failures
        if (cleanMsg.includes("device signature invalid") || cleanMsg.includes("signature invalid")) {
            setRepairToast(true);
        }
    }, []);

    // Auto-scroll logs
    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [logs]);

    return {
        logs,
        repairToast,
        setRepairToast,
        logRef,
        addLog,
    };
}
