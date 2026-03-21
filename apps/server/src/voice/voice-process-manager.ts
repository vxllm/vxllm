import path from "node:path";
import { env } from "@vxllm/env/server";
import type { Subprocess } from "bun";

export class VoiceProcessManager {
  private process: Subprocess | null = null;
  private port: number;
  private healthFailures = 0;
  private healthInterval: ReturnType<typeof setInterval> | null = null;
  private killTimeout: ReturnType<typeof setTimeout> | null = null;
  private restarting = false;

  constructor() {
    this.port = env.VOICE_PORT;
  }

  get url(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  get running(): boolean {
    return this.process !== null && !this.process.killed;
  }

  async spawn(): Promise<void> {
    if (this.running) return;

    // Check port is free
    try {
      const check = await fetch(`http://127.0.0.1:${this.port}/health`, {
        signal: AbortSignal.timeout(500),
      });
      if (check.ok) {
        throw new Error(
          `Port ${this.port} is already in use. Set VOICE_PORT to use a different port.`,
        );
      }
    } catch (err: any) {
      if (err.message?.includes("already in use")) throw err;
    }

    const voicePath = path.resolve(
      import.meta.dirname, "..", "..", "..", "..", "apps", "voice",
    );

    this.process = Bun.spawn(
      [
        "uv", "run", "python", "-m", "uvicorn", "app.main:app",
        "--port", String(this.port), "--host", "127.0.0.1", "--no-access-log",
      ],
      {
        cwd: voicePath,
        stdout: "inherit",
        stderr: "inherit",
        env: {
          ...process.env,
          VOICE_PORT: String(this.port),
          MODELS_DIR: env.MODELS_DIR,
        },
      },
    );

    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${this.url}/health`, {
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
          console.log(`[voice] Voice service ready on port ${this.port}`);
          this.startHealthPolling();
          return;
        }
      } catch {
        // Not ready yet
      }
      await Bun.sleep(500);
    }

    this.process.kill();
    this.process = null;
    throw new Error(
      "Voice service failed to start within 30 seconds. " +
      "Check that Python 3.11+ and voice dependencies are installed: cd apps/voice && uv sync",
    );
  }

  async kill(): Promise<void> {
    this.stopHealthPolling();
    if (this.killTimeout) {
      clearTimeout(this.killTimeout);
      this.killTimeout = null;
    }

    if (!this.process || this.process.killed) {
      this.process = null;
      return;
    }

    this.process.kill("SIGTERM");
    const proc = this.process;
    setTimeout(() => {
      if (!proc.killed) proc.kill("SIGKILL");
    }, 5000);

    this.process = null;
    console.log("[voice] Voice service stopped");
  }

  async ensureRunning(): Promise<void> {
    if (this.running) return;
    await this.spawn();
  }

  scheduleDelayedKill(): void {
    if (this.killTimeout) return;
    this.killTimeout = setTimeout(() => {
      this.killTimeout = null;
      this.kill().catch((err) => {
        console.error("[voice] Failed to kill voice service:", err);
      });
    }, 10_000);
  }

  cancelDelayedKill(): void {
    if (this.killTimeout) {
      clearTimeout(this.killTimeout);
      this.killTimeout = null;
    }
  }

  async getStatus(): Promise<Record<string, any> | null> {
    if (!this.running) return null;
    try {
      const res = await fetch(`${this.url}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return (await res.json()) as Record<string, any>;
    } catch {
      // Not reachable
    }
    return null;
  }

  async request(
    path: string,
    method: "GET" | "POST" = "GET",
    body?: Record<string, unknown>,
  ): Promise<any | null> {
    if (!this.running) return null;
    try {
      const res = await fetch(`${this.url}${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  private startHealthPolling(): void {
    this.healthFailures = 0;
    this.healthInterval = setInterval(async () => {
      if (!this.running) {
        this.stopHealthPolling();
        return;
      }
      const status = await this.getStatus();
      if (status) {
        this.healthFailures = 0;
      } else {
        this.healthFailures++;
        if (this.healthFailures >= 3 && !this.restarting) {
          console.error("[voice] Voice service unresponsive (3 failed health checks)");
          this.restarting = true;
          console.log("[voice] Attempting automatic restart...");
          await this.kill();
          try {
            await this.spawn();
            console.log("[voice] Automatic restart succeeded");
          } catch {
            console.error("[voice] Automatic restart failed. Voice features disabled.");
          }
          this.restarting = false;
        }
      }
    }, 30_000);
  }

  private stopHealthPolling(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }
}
