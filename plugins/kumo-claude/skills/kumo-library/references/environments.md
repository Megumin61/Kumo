# Where Kumo runs

The Kumo library is a folder on the user's computer, chosen in the Kumo browser extension. This plugin is Skills only: it needs no Node.js, no MCP server and no configuration command. It reads and writes that folder with the file tools the session already has. All mechanics are in [skill-mode.md](skill-mode.md).

Pick exactly one path before the first read:

## A. Local session

The session has file tools on the computer that holds the library (Claude Code, or the desktop app working in local folders). Resolve the root (skill-mode.md) and use Read, Grep, Glob, Write and Edit directly.

## B. Cloud session linked to the computer

The session runs in a cloud workspace and has device tools for the user's computer.

1. Resolve the root from `~/.kumo/config.json` or `~/.kumo/bridge-config.json`. If `~/.kumo` is not reachable, ask the user for the folder once.
2. If the root is not a connected folder, call `device_request_folder_access` for exactly that folder with a one-line reason. The user only clicks approve.
3. List with `device_list_dir`, stage only the files a step needs, write back with `device_commit_files`. Use `device_bash` for grep and appends when it is available.

## C. No computer reachable

Say plainly that the library is on the user's computer and this session is not linked. Offer: open the chat in the Claude desktop app on that computer, or attach a few exported files for a one-off read. Never claim the library is empty and never fabricate saved content.

## Media

Images are read directly. Video frames need `ffmpeg` in a shell that can reach the file; without it, keep "video not inspected" as an explicit gap. Audio transcription is never done without the user's explicit permission to send audio to an external service.
