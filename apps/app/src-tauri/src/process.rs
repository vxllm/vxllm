use std::process::{Child, Command};
use std::sync::Mutex;

pub struct ProcessManager {
    server: Mutex<Option<Child>>,
    sidecar: Mutex<Option<Child>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        ProcessManager {
            server: Mutex::new(None),
            sidecar: Mutex::new(None),
        }
    }

    pub fn spawn_server(&self) -> Result<(), String> {
        let child = Command::new("bun")
            .args(["run", "apps/server/src/index.ts"])
            .env("PORT", "11500")
            .env("HOST", "127.0.0.1")
            .spawn()
            .map_err(|e| format!("Failed to start server: {}", e))?;
        *self.server.lock().unwrap() = Some(child);
        Ok(())
    }

    pub fn spawn_sidecar(&self) -> Result<(), String> {
        let child = Command::new("uv")
            .args([
                "run",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                "11501",
            ])
            .current_dir("sidecar/voice")
            .spawn()
            .map_err(|e| format!("Failed to start voice sidecar: {}", e))?;
        *self.sidecar.lock().unwrap() = Some(child);
        Ok(())
    }

    pub fn kill_all(&self) {
        if let Some(mut child) = self.server.lock().unwrap().take() {
            let _ = child.kill();
        }
        if let Some(mut child) = self.sidecar.lock().unwrap().take() {
            let _ = child.kill();
        }
    }

    pub fn is_server_running(&self) -> bool {
        self.server
            .lock()
            .unwrap()
            .as_mut()
            .map(|c| c.try_wait().ok().flatten().is_none())
            .unwrap_or(false)
    }

    pub fn is_sidecar_running(&self) -> bool {
        self.sidecar
            .lock()
            .unwrap()
            .as_mut()
            .map(|c| c.try_wait().ok().flatten().is_none())
            .unwrap_or(false)
    }

    pub fn restart_server(&self) -> Result<(), String> {
        self.kill_server();
        self.spawn_server()
    }

    pub fn restart_sidecar(&self) -> Result<(), String> {
        self.kill_sidecar();
        self.spawn_sidecar()
    }

    fn kill_server(&self) {
        if let Some(mut child) = self.server.lock().unwrap().take() {
            let _ = child.kill();
        }
    }

    fn kill_sidecar(&self) {
        if let Some(mut child) = self.sidecar.lock().unwrap().take() {
            let _ = child.kill();
        }
    }
}
