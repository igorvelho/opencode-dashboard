/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"

const PORT = 11337
const LABEL = ` 󰖟 localhost:${PORT}`

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    slots: {
      session_prompt_right(_ctx) {
        return (
          <text fg={api.theme.current.textMuted}>{LABEL}</text>
        )
      },
      home_prompt_right(_ctx) {
        return (
          <text fg={api.theme.current.textMuted}>{LABEL}</text>
        )
      },
      home_footer(_ctx) {
        return (
          <text fg={api.theme.current.textMuted}>{LABEL}</text>
        )
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: "opencode-dashboard-tui",
  tui,
}

export default plugin
