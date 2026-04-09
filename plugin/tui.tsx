/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { spawn, ChildProcess } from "child_process"
import { createSignal, onCleanup } from "solid-js"
import { join } from "path"
import { fileURLToPath } from "url"
import { dirname } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SERVER_ENTRY = join(__dirname, "../server/dist/index.js")

function DashboardButton(props: { api: Parameters<TuiPlugin>[0]; port: () => number }) {
  const handleClick = () => {
    const url = `http://localhost:${props.port()}`
    import("open").then(({ default: open }) => {
      open(url).catch((err) => console.error("Failed to open browser:", err))
    })
  }

  return (
    <button onClick={handleClick}>
      <text fg={props.api.theme.current.textHighlight}>[ 📊 Dashboard ]</text>
    </button>
  )
}

const tui: TuiPlugin = async (api) => {
  let serverProcess: ChildProcess | null = null
  const [port, setPort] = createSignal(3001) // Default port, we can parse stdout later to dynamically find port if it randomizes

  // Start the background process
  try {
    serverProcess = spawn("node", [SERVER_ENTRY], {
      stdio: "ignore", // Prevent console spam in OpenCode TUI, or capture stdout to find port
      detached: false,
    })
  } catch (err) {
    console.error("Failed to start dashboard server:", err)
  }

  // Register cleanup when OpenCode closes
  api.lifecycle.onDispose(() => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill("SIGTERM")
    }
  })

  // Register the TUI Button in the top right slot
  api.slots.register({
    slots: {
      header_right(_ctx) {
        return <DashboardButton api={api} port={port} />
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: "opencode-dashboard",
  tui,
}

export default plugin
