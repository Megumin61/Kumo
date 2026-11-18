---
name: organize
description: Organizes new Kumo clips — classifies unclassified items, compiles domain and topic knowledge, and updates evidenced links while keeping originals and manual tags — by writing directly to the library folder, no server needed. Use when the user says "整理", "整理新收藏", "编译知识", "organize my Kumo", or names a scope such as a tag or platform; honors "只分类", "只编译", "只预览".
---

# Organize the Kumo library

A request here authorizes classification and derived compilation within its scope. Follow the full workflow in `../kumo-library/references/compilation.md` and the media and summary rules referenced by the `kumo-library` skill, carrying out each tool step with its file equivalent from `../kumo-library/references/skill-mode.md`.

1. Decide the session path (`environments.md`) and resolve the root. If no write access to the folder is possible, build the proposal and say clearly that nothing was saved.
2. Scope: if the user named none, process new, stale and previously incomplete sources from `inbox/`, `archive/` and `notes/` (pending = no fresh card in `wiki/readable` or `wiki/claude/cards`, or a changed `content_hash`). Work in batches of up to six sources for comparison.
3. For each batch: read bodies, notes, author supplements, comments and the actual images → keep existing manual tags, classify only unclassified items by appending annotation events → grep and read related existing cards → write source cards → topic and domain synthesis with evidence quotes → relations only where both originals support them. Notes compile with the clips they used: `practices` / `discusses` relations, and their reusable elements merged into the topic's `knowledge.elements` (see `../kumo-library/references/notes.md`).
4. Before the first write, show one short plan: tags reused or added (at most two new visible tags unless the user agrees), domains and topics touched, number of cards. Do not ask again for the same authorization.
5. Write `wiki/claude/cards/`, `wiki/claude/domains/`, `wiki/claude/INDEX.md` and the `tasks/<date>-compile-<scope>.md` proposal exactly as skill-mode.md specifies. Never touch `wiki/kumo/state.json` or `wiki/readable/`.
6. If this session itself produced practice or a discussion worth keeping (see notes.md), write or update its note before the audit so it is counted.
7. Finish with an audit and report: new tags, processed / skipped / stale / index-only counts (clips and notes separately), the useful domain conclusions, and remaining media gaps.

Never delete or move original sources, never rewrite existing manual classifications or user notes, and never turn thin evidence into a method.
