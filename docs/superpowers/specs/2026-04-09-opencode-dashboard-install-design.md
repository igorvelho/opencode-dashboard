# OpenCode Dashboard AI Installation Design

## Purpose
Introduce a modern, AI-driven installation process for the `opencode-dashboard` plugin. This allows users to simply prompt their OpenCode agent to perform the installation automatically, replacing the need to manually edit JSON configuration files while still providing the manual instructions as a fallback.

## Components

### 1. `.opencode/INSTALL.md`
A dedicated markdown file that acts as an instruction set for the OpenCode AI agent. 

**Instructions for the Agent:**
- **Locate Config:** Tell the agent to look for the OpenCode configuration file (typically `~/.config/opencode/opencode.json` but could be overridden by `OPENCODE_CONFIG_DIR`).
- **Parse and Validate:** Instruct the agent to read the JSON file safely and preserve formatting.
- **Inject Plugin:** Look for the `plugin` array. If the array does not exist, create it. Append `"github:igorvelho/opencode-dashboard#release"` to the array if it isn't already present.
- **Save and Notify:** Write the modified JSON back to disk and notify the user to restart OpenCode to apply the changes.
- **Update instructions (optional):** Include steps on how to clean up the cache if updating: `rm -rf ~/.cache/opencode/packages/github:igorvelho*`.

### 2. `README.md` Updates
The main repository README needs to be updated to present the AI-first installation approach.

- **Primary Installation Section:** Replace the current snippet with the new AI prompt:
  ```text
  Fetch and follow instructions from https://raw.githubusercontent.com/igorvelho/opencode-dashboard/refs/heads/master/.opencode/INSTALL.md
  ```
- **Manual Installation Subsection:** Move the existing manual JSON editing instructions to a new subsection titled `### Manual Installation`.
- **Updates Section:** Keep the update notes mostly intact, but mention that the plugin cache clearing can be done by asking the agent to handle it, or manually running the bash command.

## Error Handling
- The `INSTALL.md` should explicitly tell the agent to abort and notify the user if the `opencode.json` file is malformed or inaccessible.
- It should instruct the agent to avoid creating duplicate entries in the `plugin` array.

## Testing Strategy
- The primary testing involves creating the `.opencode/INSTALL.md` file and running the resulting prompt on a local, standard OpenCode environment to ensure the agent correctly identifies and modifies the `opencode.json` without breaking its structure.
