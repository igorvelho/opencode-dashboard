import type { Plugin } from "@opencode-ai/plugin"
import { spawn } from "child_process"
import type { ChildProcess } from "child_process"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
// Compiled output mirrors rootDir ".." so entry is at server/dist/server/src/index.js
const SERVER_ENTRY = join(__dirname, "server/dist/server/src/index.js")
const PORT = 11337

let serverProcess: ChildProcess | null = null

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

export const DashboardPlugin: Plugin = async ({ client }) => {
  startServer()

  // Give the server a moment to start, then show a toast with the URL
  setTimeout(async () => {
    await client.app.log({
      body: {
        service: "opencode-dashboard",
        level: "info",
        message: `Dashboard running at http://localhost:${PORT}`,
      },
    })
  }, 1500)

  return {
    "session.created": async () => {
      // Show a TUI toast when a session starts so the user knows the dashboard is available
      // @ts-ignore — tui.toast.show may not be typed yet in current SDK
      await client.event.publish({ type: "tui.toast.show", properties: { message: `📊 Dashboard: http://localhost:${PORT}` } }).catch(() => {})
    },
  }
}

// Ensure server is killed when the process exits
process.on("exit", stopServer)
process.on("SIGINT", () => { stopServer(); process.exit() })
process.on("SIGTERM", () => { stopServer(); process.exit() })

export default DashboardPlugin
