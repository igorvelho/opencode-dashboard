# Installing OpenCode Dashboard

## Prerequisites
- [OpenCode.ai](https://opencode.ai) installed

## Installation

Add the dashboard plugin to your `opencode.json` (global or project-level):

```json
{
  "plugin": ["https://github.com/igorvelho/opencode-dashboard/archive/refs/heads/release.tar.gz"]
}
```

Why this URL: OpenCode can install `github:` plugins through an npm flow that may call `git clone`. On some SSL-inspecting corporate proxies, that clone can hang indefinitely. The tarball URL installs over HTTPS directly and avoids that path.

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
