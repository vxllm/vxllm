use crate::process::ProcessManager;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show_hide = MenuItem::with_id(app, "show_hide", "Show/Hide Window", true, None::<&str>)?;
    let separator1 = PredefinedMenuItem::separator(app)?;
    let restart_server =
        MenuItem::with_id(app, "restart_server", "Restart Server", true, None::<&str>)?;
    let restart_voice =
        MenuItem::with_id(app, "restart_voice", "Restart Voice", true, None::<&str>)?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit VxLLM", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &show_hide,
            &separator1,
            &restart_server,
            &restart_voice,
            &separator2,
            &quit,
        ],
    )?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("VxLLM")
        .on_menu_event(move |app, event| {
            let id = event.id();
            if id == "show_hide" {
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            } else if id == "restart_server" {
                let pm = app.state::<ProcessManager>();
                let _ = pm.restart_server();
            } else if id == "restart_voice" {
                let pm = app.state::<ProcessManager>();
                let _ = pm.restart_voice();
            } else if id == "quit" {
                let pm = app.state::<ProcessManager>();
                pm.kill_all();
                app.exit(0);
            }
        })
        .build(app)?;

    Ok(())
}
