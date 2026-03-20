mod commands;
mod process;
mod tray;

use process::ProcessManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Spawn child processes
            let pm = ProcessManager::new();
            let _ = pm.spawn_server();
            let _ = pm.spawn_sidecar();
            app.manage(pm);

            // Setup system tray
            tray::setup_tray(app.handle())?;

            // Log plugin (debug only)
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_server_status,
            commands::get_voice_status,
            commands::restart_server_cmd,
            commands::restart_voice_cmd,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
