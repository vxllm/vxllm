use crate::process::ProcessManager;

#[tauri::command]
pub fn get_server_status(state: tauri::State<ProcessManager>) -> serde_json::Value {
    serde_json::json!({
        "running": state.is_server_running(),
        "port": 11500
    })
}

#[tauri::command]
pub fn get_voice_status(state: tauri::State<ProcessManager>) -> serde_json::Value {
    serde_json::json!({
        "running": state.is_sidecar_running(),
        "port": 11501
    })
}

#[tauri::command]
pub fn restart_server_cmd(state: tauri::State<ProcessManager>) -> Result<(), String> {
    state.restart_server()
}

#[tauri::command]
pub fn restart_voice_cmd(state: tauri::State<ProcessManager>) -> Result<(), String> {
    state.restart_sidecar()
}
