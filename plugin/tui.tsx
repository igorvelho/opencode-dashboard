/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { spawn } from "child_process"
import type { ChildProcess } from "child_process"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SERVER_ENTRY = join(__dirname, "server/dist/index.js")

function DashboardButton(props: { api: Parameters<TuiPlugin>[0]; port: () => number }) {
  const handleClick = () => {
    const url = `http://localhost:${props.port()}`
    import("open").then(({ default: open }) => {
      open(url).catch((err) => console.error("Failed to open browser:", err))
    })
  }

  return (
    <button onClick={handleClick}>
      <text fg={props.api.theme.current.textMuted}>[ 📊 Dashboard ]</text>
    </button>
  )
}

const tui: TuiPlugin = async (api) => {
  let serverProcess: ChildProcess | null = null
  const port = () => 3001

  try {
    serverProcess = spawn("node", [SERVER_ENTRY], {
      stdio: "ignore",
      detached: false,
    })
  } catch (err) {
    console.error("Failed to start dashboard server:", err)
  }

  api.lifecycle.onDispose(() => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill("SIGTERM")
    }
  })

  api.slots.register({
    slots: {
      session_prompt_right(_ctx) {
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
