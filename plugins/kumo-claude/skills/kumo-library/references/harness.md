# File-first task harness

Kumo's browser extension saves sources into the library folder. This plugin is the AI side: Skills that read, apply and compile that folder through ordinary file tools (see [skill-mode.md](skill-mode.md)). No server or runtime is required.

## Connected task

1. Resolve the authorized root (skill-mode.md). Read KUMO.md and LIBRARY.md, then relevant domain/topic pages in `wiki/readable/` and `wiki/claude/`; search raw/pending sources too. Inside a topic read its `elements` and `practice` first, then the linked notes in `notes/` for adopted decisions, measurements and explicit feedback, then the clips. Notes are compiled knowledge with stated claim types, not automatically true for a different task. Start with a few candidates and expand across branches if evidence is weak. Do not dump every source into the prompt.
2. Select by task constraints, explicit user notes, actual contribution and limitations. Inspect relevant original text and media before adopting a claim or visual decision. A resource directory, cover frame or model-generated summary does not establish the underlying example.
3. Keep a concise application record: actual resource read → observation → decision → implementation → check. Allow rejection and zero suitable references. User opt-out and current constraints override past taste.
4. Record useful task results as a note in `notes/` ([notes.md](notes.md)) only within the user's authorized scope; `tasks/` keeps compile proposals, audits and tag-cleanup logs. Keep user words, source claims, AI interpretation and measured outcomes separate. Co-use is task history, not a support relation.
5. Deepen compilation when new evidence, repeated relevant use, contradiction, outcome checks or explicit feedback justify it: source → conditional topic → domain synthesis, then refresh affected pages and `wiki/claude/INDEX.md`. Do not recompile unchanged material just because it was searched.

## Storage compatibility

`wiki/kumo/state.json` and `wiki/readable/` belong to Kumo's validated compiler; never edit them. Skill-mode results live in `wiki/claude/` and are mirrored as a `tasks/` compile proposal so the official compiler can publish them later. Say clearly which layer an answer used.

## Compilation and routing checks

- When generic words swamp ranking, use the task context to choose a domain, then read its topic and source cards directly. Keep the initial miss distinct from the successful route.
- A resource list identifies where to look, not proof that an example was previewed or a tool tested.
- Carry forward earlier observations only when the source's `content_hash` and media files are unchanged; record retained evidence separately from newly inspected media.
- Audit pending cards, index-only material, limited evidence, media gaps, stale syntheses and relationships separately. Same-task co-use never becomes a support relation.
- Encode `#` and `%` in relative link targets before writing.
