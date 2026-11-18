---
name: note
description: Saves what was learned from using Kumo clips — a replication, experiment, design decision or discussion — as a note in the library's notes/ folder, linked element by element to the posts it used, so the next compile folds it into the domain and topic knowledge. Use when the user says "记下来", "存成笔记", "做个笔记", "把这次实践/讨论存进 Kumo", "save this as a note", or at the end of an authorized task that applied saved sources.
---

# Save a Kumo note

Follow `../kumo-library/references/notes.md` for the folder layout, frontmatter, ids and compile rules, and `../kumo-library/references/skill-mode.md` for file access.

1. Resolve the library root. If it cannot be written, show the note text and say it was not saved.
2. Decide whether this continues an existing note (same task or discussion): grep `notes/*/source.md` titles and `source_ids`. Update that note instead of creating a second one.
3. Collect only what the conversation actually contains: the user's exact words for goals and judgments, the sources really read (card ids), what was done, measured results, artifacts and links, gaps and open questions. Tag every conclusion 实测 / 用户原话 / AI推导 / 作者说法.
4. For each source used, name the element it contributed. Fill the `可复用元素` table for practice notes; for discussions write `我的看法` and `留给用户的问题`, and leave `用户的回答` for their reply.
5. Write `source.md` and `metadata.json` (new `updated_at` and `content_hash` on every edit). Put code, screenshots and exports under the note's `assets/`.
6. Tell the user in one or two sentences where the note is and that the next 整理 will compile it into the topics it touches. Do not compile here unless the user also asked to organize.

Never store secrets, credentials or content the user asked to keep out of the library. A note is not a transcript: leave out routine chat and searches that changed nothing.
