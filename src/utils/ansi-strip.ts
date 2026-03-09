// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/**
 * ANSI escape code stripper
 *
 * Removes terminal color/formatting codes from raw process output
 * so log messages display cleanly in the UI.
 */

/**
 * Strip ANSI escape codes from terminal output.
 * Handles both standard ESC[ sequences and bare bracket sequences.
 */
export function stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, "").replace(/\[[\d;]*m/g, "");
}
