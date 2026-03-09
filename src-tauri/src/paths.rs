// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
/// Unified path management for the OpenClaw Launcher.
///
/// All sandbox, engine, and config directory paths are defined here.
/// Other modules should use `crate::paths::xxx()` instead of computing paths directly.

use std::path::PathBuf;
use crate::environment;

const OPENCLAW_DIR_NAME: &str = "openclaw-engine";

/// Get path to the local OpenClaw engine directory inside the sandbox.
/// This is where the source code is downloaded and `npm install` runs.
pub fn get_openclaw_dir() -> Result<PathBuf, String> {
    Ok(environment::get_sandbox_dir()?.join(OPENCLAW_DIR_NAME))
}
