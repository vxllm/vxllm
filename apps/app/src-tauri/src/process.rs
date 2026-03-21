use std::process::{Child, Command};
use std::sync::Mutex;

pub struct ProcessManager {
    server: Mutex<Option<Child>>,
    voice: Mutex<Option<Child>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        ProcessManager {
            server: Mutex::new(None),
            voice: Mutex::new(None),
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

    pub fn spawn_voice(&self) -> Result<(), String> {
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
            .current_dir("apps/voice")
            .spawn()
            .map_err(|e| format!("Failed to start voice service: {}", e))?;
        *self.voice.lock().unwrap() = Some(child);
        Ok(())
    }

    pub fn kill_all(&self) {
        if let Some(mut child) = self.server.lock().unwrap().take() {
            let _ = child.kill();
        }
        if let Some(mut child) = self.voice.lock().unwrap().take() {
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

    pub fn is_voice_running(&self) -> bool {
        self.voice
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

    pub fn restart_voice(&self) -> Result<(), String> {
        self.kill_voice();
        self.spawn_voice()
    }

    fn kill_server(&self) {
        if let Some(mut child) = self.server.lock().unwrap().take() {
            let _ = child.kill();
        }
    }

    fn kill_voice(&self) {
        if let Some(mut child) = self.voice.lock().unwrap().take() {
            let _ = child.kill();
        }
    }
}
