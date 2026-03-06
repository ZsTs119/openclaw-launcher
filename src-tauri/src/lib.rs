mod environment;
mod openclaw;
mod service;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(service::ServiceState::default())
        .invoke_handler(tauri::generate_handler![
            // Environment
            environment::check_node_exists,
            environment::download_and_install_node,
            environment::get_environment_info,
            // OpenClaw source & deps
            openclaw::check_openclaw_exists,
            openclaw::check_node_modules_exists,
            openclaw::download_openclaw_source,
            openclaw::run_npm_install,
            openclaw::setup_openclaw,
            // Service lifecycle
            service::is_service_running,
            service::start_service,
            service::stop_service,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
