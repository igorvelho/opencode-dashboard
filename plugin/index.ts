import type { Plugin } from "@opencode-ai/plugin"
import { exec, spawn } from "child_process"
import type { ChildProcess } from "child_process"
import { createConnection } from "net"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { platform, release } from "os"
import { existsSync } from "fs"

const __dirname = dirname(fileURLToPath(import.meta.url))
// Compiled output mirrors rootDir ".." so entry is at server/dist/server/src/index.js
const SERVER_ENTRY = join(__dirname, "server/dist/server/src/index.js")
const PORT = 11337
const URL = `http://localhost:${PORT}`

let serverProcess: ChildProcess | null = null

function isWSL(): boolean {
  if (platform() !== "linux") return false
  try {
    return release().toLowerCase().includes("microsoft")
      || existsSync("/proc/sys/fs/binfmt_misc/WSLInterop")
  } catch {
    return false
  }
}

function openBrowser(url: string) {
  if (isWSL()) {
    // WSL: use cmd.exe to open in the Windows default browser
    exec(`cmd.exe /c start "" "${url}"`, () => {})
  } else if (platform() === "darwin") {
    exec(`open "${url}"`, () => {})
  } else if (platform() === "win32") {
    exec(`cmd /c start "" "${url}"`, () => {})
  } else {
    exec(`xdg-open "${url}"`, () => {})
  }
}

function startServer() {
  if (serverProcess && !serverProcess.killed) return

  serverProcess = spawn("node", [SERVER_ENTRY], {
    env: { ...process.env, PORT: String(PORT), NODE_ENV: "production" },
    stdio: "ignore",
    detached: false,
  })

  serverProcess.on("error", (err) => {
    console.error("[opencode-dashboard] Failed to start server:", err.message)
  })
}

function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM")
    serverProcess = null
  }
}

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" })
    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.once("error", () => {
      socket.destroy()
      resolve(false)
    })
    socket.setTimeout(1000, () => {
      socket.destroy()
      resolve(false)
    })
  })
}

export const DashboardPlugin: Plugin = async ({ client }) => {
  const alreadyRunning = await isPortInUse(PORT)

  if (alreadyRunning) {
    await client.app.log({
      body: {
        service: "opencode-dashboard",
        level: "info",
        message: `Dashboard already running at ${URL} — skipping`,
      },
    })
    return {}
  }

  startServer()

  // Give the server a moment to start, then open the browser and log the URL
  setTimeout(async () => {
    openBrowser(URL)
    await client.app.log({
      body: {
        service: "opencode-dashboard",
        level: "info",
        message: `Dashboard running at ${URL}`,
      },
    })
  }, 2000)

  return {}
}

// Ensure server is killed when the process exits
process.on("exit", stopServer)
process.on("SIGINT", () => { stopServer(); process.exit() })
process.on("SIGTERM", () => { stopServer(); process.exit() })

export default DashboardPlugin
