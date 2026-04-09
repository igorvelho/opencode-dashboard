# OpenCode Dashboard Installation Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a new, AI-driven installation method for the OpenCode Dashboard plugin.

**Architecture:** Create an `.opencode/INSTALL.md` file containing instructions for the OpenCode AI agent to modify the user's `opencode.json` config. Update the main `README.md` to feature this AI-based installation prominently, while preserving the manual JSON edit instructions in a sub-section.

**Tech Stack:** Markdown.

---

### Task 1: Create `.opencode/INSTALL.md`

**Files:**
- Create: `.opencode/INSTALL.md`

- [ ] **Step 1: Create the `.opencode/INSTALL.md` file with the AI agent instructions.**

Write the following content to `.opencode/INSTALL.md`:

# Installing OpenCode Dashboard

## Prerequisites
- [OpenCode.ai](https://opencode.ai) installed

## Installation

Add the dashboard plugin to your `opencode.json` (global or project-level):

```json
{
  "plugin": ["github:igorvelho/opencode-dashboard#release"]
}
```

Restart OpenCode. The dashboard will automatically start on port 11337 and open in your default browser.

Verify by checking the dashboard loads and displays the current version.

## Updating

OpenCode caches plugins after first install. To update to the latest release, clear the plugin cache and restart OpenCode:

```bash
rm -rf ~/.cache/opencode/packages/github:igorvelho*
```

Then restart OpenCode.

## Troubleshooting

### Plugin not loading
1. Check logs: `opencode run --print-logs "hello" 2>&1 | grep -i dashboard`
2. Verify the plugin line in your `opencode.json`
3. Ensure you are running OpenCode 1.4.0 or newer.

## Getting Help
- Report issues: https://github.com/igorvelho/opencode-dashboard/issues
- Full documentation: https://github.com/igorvelho/opencode-dashboard#readme


- [ ] **Step 2: Commit the new file**

Run the following command:
`git add .opencode/INSTALL.md && git commit -m "feat: add AI-friendly installation instructions"`

---

### Task 2: Update `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the current `Installation` section.**
Find the `## Installation` section in `README.md` and replace it with the following:

## Installation

Tell OpenCode:

```text
Fetch and follow instructions from https://raw.githubusercontent.com/igorvelho/opencode-dashboard/refs/heads/master/.opencode/INSTALL.md
```

That's it. Start OpenCode and the dashboard opens automatically at **http://localhost:11337**.

**Requirements:** OpenCode `1.4.0` or newer.

### Manual Installation

If you prefer, you can manually add the plugin to your OpenCode config at `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["github:igorvelho/opencode-dashboard#release"]
}
```

- [ ] **Step 2: Commit the README.md update**

Run the following command:
`git add README.md && git commit -m "docs: update README to feature AI installation method"`
