---
name: setup
description: Checks that Claude can reach the user's local Kumo library folder and explains what the plugin can do. Use when the user says "检查 Kumo 连接", "连接 Kumo", "set up Kumo", or when the library cannot be found. No installation, Node.js or command is required.
---

# Check the Kumo connection

This version is Skills only. There is nothing to install or run; Claude works on the folder the Kumo browser extension saves into.

1. Decide the session path with `../kumo-library/references/environments.md`.
2. Resolve the root as in `../kumo-library/references/skill-mode.md`: `~/.kumo/config.json`, then `~/.kumo/bridge-config.json` (written by the extension), then a project `KUMO.md`, else ask the user once. In a cloud session, request access to exactly that folder if it is not connected; the user only approves.
3. Confirm it is a Kumo library (`inbox/`, `annotations/`, `tags.json`). If not, ask the user to save one page with the browser extension; never create a substitute library.
4. Report in plain words: the folder, number of saved sources, number of visible tags, whether compiled knowledge exists (`wiki/readable/` from the Kumo compiler, `wiki/claude/` from this plugin), and whether Claude can write there.
5. Finish with one test: ask the user to name any saved clip, find it, and show its title and first lines. Then mention the `find` and `organize` skills.

Capabilities in one line each: retrieval and reading originals; classification and knowledge compilation after a 整理 request; images are read directly; video frames only when `ffmpeg` is available, otherwise marked as a gap; audio is never sent anywhere without explicit permission.
