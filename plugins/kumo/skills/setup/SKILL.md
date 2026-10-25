---
name: setup
description: Set up or reconnect a local Kumo library after the Kumo plugin is installed, including locating KUMO.md, validating the folder layout, and connecting the browser clipper through the local bridge.
---

# Set up Kumo

Help the user connect this plugin to a local Kumo library without taking ownership of unrelated folders.

If connection_status is available, call it first. An unconfigured server deliberately exposes only this read-only tool; do not describe that state as an empty library. If connected, call wiki_map(limit: 1) to verify coverage without listing private sources unnecessarily. Older versions may provide wiki_map without connection_status. Explain whether save_wiki_batch and save_classification are available. An empty Wiki is expected for a new library: offer compilation, do not start it without authorization. Classification requires a same-library bridge advertising ai_classification; Wiki compilation does not require the bridge. Do not change connections or expose the library to the public internet. A cloud ChatGPT installation requires its own supported authenticated connection; the packaged local stdio configuration is not a cloud installation.

The folder is the user's content library, not an AI app installation directory. For a fresh local installation, after the user explicitly authorizes connecting the selected library, `mcp/configure-library.mjs --library <absolute folder>` validates the structure and writes a persistent per-user `.kumo/config.json`. It defaults to read-only. Add `--organize` only when the user authorizes derived organization writes. It refuses to replace an existing config; inspect that existing connection before proposing a scoped change. Restart the MCP connection or open a new chat afterward. Never edit the plugin cache as the persistent configuration mechanism. Missing Node.js must be reported as a runtime prerequisite, not a missing library.

1. Look for `KUMO.md` in the current project. If it exists, read `library_root` and verify that the target contains or can contain `inbox/`, `archive/`, `domains/`, and `LIBRARY.md`.
2. If this repository already contains `projects/kumo/knowledge/`, recommend it and create a root `KUMO.md` pointing there only when absent.
3. Otherwise ask the user which folder should own the library. Do not search broad personal directories to guess.
4. When the user authorizes setup, create only the minimal structure and never overwrite existing files. Keep raw directories stable in `inbox/` or existing `archive/`; derived material belongs in `domains/` and its status in `organization.json`.
5. If `projects/kumo/local-bridge/configure-and-start.ps1` exists on Windows, offer to configure it with the resolved absolute library root and start it. Ask for authorization immediately before writing the per-machine config or launching the local process. Never commit `local-config.json`.
6. Verify `http://127.0.0.1:43789/status` reports the intended library. Explain that the bridge exists because a browser extension cannot discover the active Codex project or write arbitrary disk paths by itself. When the bridge is unavailable, the browser directory picker remains a fallback.
7. Finish with one concrete test: reload the browser extension, save the same page twice, confirm the second attempt reports “already exists”, then ask Kumo to organize the inbox.

Do not auto-publish or install MCP connections, hooks, login auto-start, or vector storage during setup. Those require user authorization and an actual connection configuration.
