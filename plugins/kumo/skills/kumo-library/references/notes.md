# Notes: chewed knowledge inside the same Wiki

A note records what the user and the AI **did or thought with** saved sources: a replication, an experiment, a design decision, a discussion. A source card says what a post contains; a note says what was learned by using it. Notes are not a separate module. They are **sources of a second kind** that go through the same pipeline as clips: pending detection → card → topic/domain synthesis → evidenced relations → retrieval.

## Where notes live

```
notes/<YYYY-MM-DD>--<short title>--<hash8>/
  source.md        # the note itself (frontmatter below)
  metadata.json    # same shape as a clip, kind: "note"
  assets/          # optional: code, screenshots, exported media
```

- `hash8` = first 8 hex characters of SHA-256 of the note body at first write. It never changes afterwards, even when the note is updated; the folder path is the note's identity.
- Card / annotation id = first 24 hex characters of SHA-256 of `notes/<folder>` (same rule as `inbox/` and `archive/`).
- `notes/` sits next to `inbox/` and `archive/`. Search, pending detection and retrieval treat the three areas the same way.

`metadata.json`:

```json
{"id":"2026-11-18-<hash8>","kind":"note","noteKind":"practice","title":"…","capturedAt":"<ISO>","updatedAt":"<ISO>","contentHash":"<sha256 of source.md, first 8 hex>","sourceIds":["<24-hex card id>"],"domainIds":["…"],"topicIds":["…"],"files":{"artifacts":["assets/…"]}}
```

`contentHash` is recomputed on every edit, so an updated note becomes stale and is recompiled like any changed clip.

## source.md frontmatter and body

```markdown
---
schema: kumo-note-v2
id: "2026-11-18-<hash8>"
kind: note
note_kind: practice            # practice | discussion | analysis | decision
title: "…"
status: done                   # done | open (discussion waiting for the user) | superseded
captured_at: "<ISO>"
updated_at: "<ISO>"
content_hash: "<8 hex>"
source_ids: ["<24-hex>", …]
domain_ids: […]
topic_ids: […]
artifact: "<optional link>"
---

# Title

## 目标与约束            ← include the user's exact words for this task
## 可复用元素            ← table: 元素 | 用在哪 | 关键参数 | 状态(实测/仅看过) | 来源
## 读过 → 观察 → 决定 → 实现 → 检查   ← one block per case / source
## 结论                  ← each claim tagged 实测 / 用户原话 / AI推导 / 作者说法
## 差距与后续
## 用户的回答            ← discussion notes only; filled in later, never paraphrased
```

Omit empty sections. For a discussion note, `可复用元素` may be replaced by `我的看法` and `留给用户的问题`.

## When to write a note

Write one only when at least one is true (KUMO.md rule 8): a saved source was actually applied or replicated; a decision changed because of it; something was measured or verified; the user stated an idea, judgment or feedback worth keeping. Do not save routine chat, search logs or plans that changed nothing. One task = one note; update the same note when the task continues instead of creating a second one.

Writing a note is part of finishing the task when the user has authorized writes to the library (an organize request, an explicit "记下来 / 存成笔记", or the library's standing policy). Otherwise offer it in one line.

## Element-level links

Every source a note uses must say **which element** it contributed: "拍立得的内边距与阴影", "ζ=0.55 的弹簧参数", not "参考了这篇". Co-use in one task is still not a support relation between two clips.

## How notes compile

1. **Pending:** a note is pending when no fresh card has its id or its `content_hash` changed (same rule as clips).
2. **Card:** `contentType: "note-<note_kind>"`; summary = what was done and the main verified result; `evidenceStatus` = `sufficient` only for claims the note itself measured or the user stated; `keywords` = the 2–3 most reusable elements.
3. **Relations:** from the note card to each used source card, type `practices` (applied/replicated it), `discusses` (debated it) or `contradicts` (the practice disproved a claim). `fromQuote` = the note line naming the element, `toQuote` = the source line it came from.
4. **Topic knowledge:** for every topic a note touches, merge into `knowledge`:
   - `elements`: `[{name, use, params, status, noteId, sourceIds}]`. Same element in several notes → one entry with all note ids.
   - `practice`: `[{noteId, case, result, artifact}]`.
   - takeaways carry `claimType` (`实测`, `用户原话`, `AI推导`, `作者说法`) and are ordered in that sequence.
5. **Domain overview:** may cite notes like cards; mention recent practice in at most one line.

When the official compiler is unavailable, put note cards, `practices` relations and the `elements` / `practice` topic fields in the same `tasks/<date>-compile-<scope>.md` proposal as the clips (skill-mode.md).

## Retrieval order

domain (LIBRARY.md) → topic → **topic elements and practice first** → the note → the source cards it links → original source and media.

Show measured and user-stated knowledge first, but always also list relevant sources nobody has practised yet, so the library does not narrow to what was already tried.

## Keeping notes fresh

- If a linked source's `content_hash` changes, mark the note's elements from that source `待复核` in the next compile; do not delete them.
- If the user corrects a note, edit the note (new `updated_at`, new `content_hash`); keep their words verbatim in `用户的回答`.
- Older records in `tasks/discussions/` or `wiki/claude/discussions/` are migrated by copying them into `notes/` with `note_kind: discussion` and leaving a one-line pointer in the old file. Never delete the old file without the user's permission.
