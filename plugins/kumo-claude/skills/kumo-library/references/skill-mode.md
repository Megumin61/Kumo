# Skill mode: every Kumo operation as file work

This plugin has no MCP server, no Node runtime and no background process. The method references (compilation.md, summary-writing.md, media-compilation.md, reference-application.md, library-schema.md) come from the Codex plugin and still name its tools. Whenever they name a tool, do the equivalent below. The method, quality bar and safety rules stay exactly the same.

## File access in each session

- **Local session** (Claude Code or desktop with file tools on the library's computer): use Read, Grep, Glob, Write, Edit directly on the library root.
- **Cloud session linked to the computer**: use the device tools. `device_list_dir` to list, `device_stage_files` to copy the few files a step needs into the workspace (then Read/Grep them there), `device_commit_files` to write results back. When `device_bash` works, prefer it for grep and small edits on the computer itself. If the library root is not yet a connected folder, call `device_request_folder_access` once for exactly that root, with a one-line reason; the user only approves.
- **No computer linked**: say the library lives on the user's computer and ask them to open the chat in the desktop app or link it. Never claim the library is empty.

## Find the library root (no manual setup)

Check in order and stop at the first that exists:

1. `~/.kumo/config.json` → `libraryRoot` (also `allowOrganize`).
2. `~/.kumo/bridge-config.json` → `libraryRoot` (written by the Kumo browser extension itself).
3. A project `KUMO.md` naming `library_root`.
4. Ask the user once which folder the browser extension saves into.

A valid root contains `inbox/`, `annotations/`, `tags.json` and normally `KUMO.md`, `LIBRARY.md`. Never search unrelated personal folders, and never create a substitute empty library.

## Tool → file equivalents

| Codex tool | Do this instead |
|---|---|
| `connection_status` | Resolve the root as above; report root, whether it is writable, counts of `inbox/` + `archive/` source folders. |
| `wiki_map`, `read_wiki`, `route_wiki` | Read `LIBRARY.md`, then the linked `wiki/readable/<rev>/domain-*.md` and topic pages; then `wiki/claude/INDEX.md` and its domain pages if present. |
| `search` | Grep across `inbox/*/source.md`, `archive/*/source.md`, `notes/*/source.md`, `wiki/readable/`, `wiki/claude/`, and the `tasks/` compile proposals that are still pending. Use 2–3 phrasings of the concept. In cloud sessions first narrow by folder names (they contain date + title), then stage only the candidates' `source.md`. |
| `read_source`, `fetch` | Read `<source dir>/source.md` (frontmatter, body, author supplements, comment snapshot, interaction stats). User notes and tags: `annotations/<id>.json`. |
| `read_image` | Open the file under `<source dir>/assets/` with Read (images render). Record the exact resource name you viewed. |
| `prepare_media` | Images: read them directly, splitting long images by viewing parts if needed. Video: only if a shell with `ffmpeg` is available, extract a few frames into the workspace (never into the library) and view them; otherwise record "video not inspected" as a gap. |
| `list_collections` | Read `tags.json` (skip tags with `deletedAt`). |
| `compilation_queue` | Sources come from `inbox/`, `archive/` and `notes/`. A source is pending when its folder id is not referenced by a fresh card in `wiki/readable/<rev>/sources.md` or `wiki/claude/cards/`, or when its `content_hash` differs from the hash recorded on that card. |
| `compilation_context` | Grep existing cards and domain pages for the batch's key concepts; read the closest few in full before deciding relations. |
| `preview_classification` → `save_classification` | Show the plan. After approval, append one event to `annotations/<id>.json` (format below). |
| `preview_wiki_batch` → `save_wiki_batch` | Show a short preview (cards, topics, domains, relations). After approval, write the Skill-mode wiki and the batch proposal (below). |
| `audit_wiki` | Recount sources, cards, pending, stale (hash mismatch), index-only, media gaps; check every card path and source link resolves. |
| `write_note` (no Codex equivalent yet) | Create or update `notes/<date>--<title>--<hash8>/source.md` + `metadata.json` exactly as [notes.md](notes.md) specifies; recompute `content_hash` on every edit. |
| `reference_brief` | Do the `find` workflow with the task's goal and constraints. |

## Annotation id and classification event

`id` = first 24 hex characters of SHA-256 of the source folder's relative path with forward slashes (for example `inbox/2026-11-13--标题--a56edeae`). Compute it with any available hashing (shell `sha256sum`, Python, or Node if present). If the file exists, append to `events`; otherwise create:

```json
{"schema":"kumo-annotations-v1","relativePath":"inbox/<folder>","events":[]}
```

Event to append for an AI classification:

```json
{"id":"<new uuid>","capturedAt":"<ISO time>","kind":"collection","note":"","userTags":[{"id":"<tag id from tags.json>","label":"<label>","hidden":false}],"origin":"ai-classification","reason":"按已读取的正文、用户笔记及必要图像归类；已有人工标签保持不变。"}
```

Only classify sources whose events contain no tags yet. Never edit or delete existing events, notes or tags. A new visible tag is added to `tags.json` with a new UUID and `"hidden": false`, only after the user agrees (at most two per pass).

## Notes

Notes are sources (see [notes.md](notes.md)). They are compiled in the same batches as clips, their cards carry `contentType: note-<kind>`, their relations to clips use `practices` / `discusses`, and the topics they touch gain `knowledge.elements` and `knowledge.practice`. The official compiler accepts these once it includes `notes/` in its source scan; until then they travel in the `tasks/` proposal like everything else.

## Where compiled knowledge goes

Never edit `wiki/kumo/state.json` or anything under `wiki/readable/`: those belong to Kumo's validated compiler. Skill-mode compilation writes its own readable layer plus a proposal the official compiler can publish later.

1. `wiki/claude/cards/<source-id>.md` — one source card per source:
   ```markdown
   ---
   schema: kumo-skill-card-v1
   source_id: 2026-11-13-a56edeae
   source_path: inbox/<folder>
   content_hash: a56edeae
   domain_ids: [product-experience]
   topic_ids: [motion-continuity]
   keywords: [连续性, 共享元素, 展开过渡]
   evidence_status: limited
   inspected: [body, author_supplements, assets/image-01.webp]
   compiled_at: <ISO time>
   ---
   <summary written by summary-writing.md: one or two concrete sentences, then a short supporting paragraph only if needed>

   ## Reuse when / avoid when
   ## Evidence
   - body: "<exact short quote>"
   ## Limits
   ## Source
   [本地原文](../../../inbox/<folder>/source.md) · [原帖](<source_url>)
   ```
2. `wiki/claude/domains/<domain-id>.md` — the domain overview and topics with `knowledge` (takeaways, steps, checks, open questions), each claim pointing to card ids and quotes, as compilation.md requires. Reuse domain ids and names from `wiki/readable` when the domain already exists there.
3. `wiki/claude/INDEX.md` — short map: domains → topics → card count, last compiled time, pending count. Keep it small, like LIBRARY.md.
4. `tasks/<date>-compile-<scope>.md` — schema `kumo-task-v1`, containing the same batch as JSON (domains, topics, cards with `id`, `fingerprint` = content_hash, `summary`, `evidence`, `inspectedImages`, relations). State in its first line that it is a pending proposal for the official compiler. When Kumo's compiler later runs (Codex plugin or its CLI), it can publish this into `wiki/kumo/state.json`.

Retrieval reads `wiki/readable` and `wiki/claude` together. If both describe the same domain, prefer the fresher compile time and say which one you used.

## Writing safely

- Write new files or append only; never rewrite `source.md`, `metadata.json`, media, annotations history or `tags.json` entries.
- Before writing, show the preview once; a scoped 整理 request is the authorization for its scope, so do not ask twice.
- In cloud sessions write through `device_commit_files` (or `device_bash` when available). If a write is refused, report what was not saved.
- Keep compiled files UTF-8 and links relative with forward slashes; encode `#` and `%` in link targets.
