// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
mod agents;
mod config;
mod diagnostics;
mod download;
mod environment;
mod installer;
mod paths;
mod provider_mgr;
mod providers;
mod service;
mod setup;

use tauri::{Emitter, Manager};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(service::ServiceState::default())
        .setup(|app| {
            // ===== System Tray =====
            let show_i = MenuItem::with_id(app, "show", "打开面板", true, None::<&str>)?;
            let browser_i = MenuItem::with_id(app, "browser", "打开浏览器", true, None::<&str>)?;
            let separator1 = PredefinedMenuItem::separator(app)?;
            let restart_i = MenuItem::with_id(app, "restart", "重启服务", true, None::<&str>)?;
            let separator2 = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[&show_i, &browser_i, &separator1, &restart_i, &separator2, &quit_i],
            )?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("OpenClaw Launcher")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "browser" => {
                            // Open the gateway in default browser using actual service port
                            let state = app.state::<service::ServiceState>();
                            let port = *state.port.lock().unwrap();
                            let _ = open::that(format!("http://localhost:{}?token=openclaw-launcher-local", port));
                        }
                        "restart" => {
                            // Show the window first so user sees the restart progress
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                            // Emit restart event to frontend — it has the hooks to stop+start
                            let _ = app.emit("tray-restart-service", ());
                        }
                        "quit" => {
                            // Stop the service before exiting
                            let state = app.state::<service::ServiceState>();
                            let mut guard = state.child.lock().unwrap();
                            if let Some(mut child) = guard.take() {
                                let _ = child.kill();
                                let _ = child.wait();
                            }
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // Left-click opens the panel
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Intercept close → hide to tray instead of quitting
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            // Environment
            environment::check_node_exists,
            environment::download_and_install_node,
            environment::get_environment_info,
            // Download
            download::download_openclaw_source,
            // Installer
            installer::run_npm_install,
            // Setup orchestration
            setup::check_openclaw_exists,
            setup::check_node_modules_exists,
            setup::check_config_exists,
            setup::inject_default_config,
            setup::inject_default_models,
            setup::install_preset_skills,
            setup::setup_openclaw,
            setup::reinstall_environment,
            // Service lifecycle
            service::check_port_available,
            service::is_service_running,
            service::start_service,
            service::stop_service,
            // Provider catalog & URL
            providers::get_providers,
            providers::open_provider_register,
            providers::open_url,
            // Config & API Key management
            config::get_current_config,
            config::migrate_gateway_config,
            config::save_api_config,
            config::set_default_model,
            config::reset_config,
            // Diagnostics
            diagnostics::export_diagnostics_zip,
            // Agent management
            agents::list_agents,
            agents::get_agent_detail,
            agents::create_agent,
            agents::update_agent,
            agents::delete_agent,
            agents::list_skills,
            agents::list_available_models,
            // Provider management
            provider_mgr::list_saved_providers,
            provider_mgr::list_all_models,
            provider_mgr::delete_provider,
            provider_mgr::remove_model_from_provider,
            provider_mgr::add_model_to_provider,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
