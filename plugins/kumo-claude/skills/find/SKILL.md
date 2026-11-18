---
name: find
description: Finds references in the user's Kumo collection for a concrete task, reads the originals and explains what to reuse. Use when the user says "在收藏里找", "找几篇参考", "我存过的…", "对比我收藏的…", or asks which saved post fits a task. Read-only; works directly on the library folder, no setup needed.
---

# Find references in Kumo

Use the `kumo-library` skill's rules and its skill-mode file operations. Take the user's request as the task; if it names a source, platform, tag or domain, keep that scope.

1. Decide the session path with `../kumo-library/references/environments.md` and resolve the library root (`../kumo-library/references/skill-mode.md`).
2. Route: read `LIBRARY.md`, the relevant domain pages in `wiki/readable/` and `wiki/claude/`, and inside the matching topic its `elements` and `practice` (what has already been tried and measured) and the notes they link in `notes/`; then grep `inbox/`, `archive/` and `notes/` `source.md` files with 2–3 phrasings of the task's key concepts. In cloud sessions narrow by folder names first and stage only candidates. Start small; never read the whole library.
3. Read the originals before concluding: body, the user's own notes (`annotations/`), author supplements, saved comments, and the actual images when visual detail matters. Keep author claims, comments, the user's notes and AI synthesis apart.
4. Return 1–3 results, putting anything already practised first (say what was measured and where the code or artifact is) but also naming a fitting source nobody has tried yet when there is one. For each: what it is, which part fits this task, what can be reused directly, what evidence is missing, and the original link. If nothing fits, say so instead of forcing a citation.

Do not write, tag or compile anything here. If the user wants the result kept, hand over to `organize`.
