# Kumo library schema

Read this reference when organizing clips or changing the library structure.

## AI Wiki (plugin 0.6+)

The new tool-managed layer is `wiki/kumo/state.json`, schema `kumo-wiki-v1`. It contains a revision, domains, topics, source cards and evidenced relations. `wiki/kumo/history/` retains publication snapshots. Source fingerprints mark compiled cards stale after raw/annotation changes; tools exclude stale cards from routing. This layer is separate from the user collection UI and does not replace legacy domain notes or organization.json. For current compilation use [compilation.md](compilation.md), not direct writes to the legacy projection below. Old notes remain readable/searchable; they are not silently claimed to be migrated Wiki cards.

## Source layer

Each `inbox/<clip-id>/` or `archive/<clip-id>/` directory contains:

- `source.md`: immutable human-readable capture with YAML frontmatter.
- `metadata.json`: immutable machine-readable capture metadata.
- `readable.html`: optional cleaned HTML for structural recovery.
- `viewport.png`: optional visual evidence from capture time.

`metadata.json` uses camelCase: `id`, `title`, `url`, `capturedAt`, `contentHash`, `dedupeKey`, `userNote`, optional `userTags`, `stats`, `warnings`, `files`. The Markdown frontmatter uses snake_case; do not assume both formats have identical field names. Missing evidence is a quality issue, not permission to invent values.

`tags.json` stores stable tag IDs, editable labels and a hidden flag. Renaming or hiding a tag must not move or delete sources. `annotations/<id>.json` stores append-only user note/tag events. The ID is the first 24 hex characters of SHA-256 of the clip's slash-separated relative directory path. Preserve every note string, including whitespace.

## Organization projection

Read the library's `ORGANIZATION.md` when organizing. Maintain `organization.json` with schema `kumo-organization-v1`, `domains` and `records` arrays. Domains have `id`, `name`, `scope`, `triggers`, `avoidWhen`, `indexPath`. Records have `sourcePath` (directory relative to root), `domainIds`, `reuseWhen`, `avoidWhen`, `evidence`, `relations`, `notePath`, and `status` (`organized` or `needs_evidence`). Relationships contain `sourcePath`, `type`, `reason`. Paths must remain within this library and exist; use forward slashes. Revalidate links before marking organized. This is a rebuildable index, not the source of truth for user notes.

## Derived note

Use a compact structure that helps future work. Omit empty sections.

```markdown
---
schema: kumo-note-v1
domain: product-design
source_ids: ["2026-10-10-deadbeef"]
updated_at: 2026-10-10
confidence: medium
---

# Descriptive claim or method

## What the source contributes

State the useful claim, method, example, or aesthetic cue without inflating it.

## Why Jayce saved it

Preserve the user's explicit note and highlight. Label inference as inference.

## Reuse cues

Describe concrete tasks or decisions where this may help.

## Tensions and limits

Record counterexamples, uncertainty, age, source incentives, and conflicts with other material.

## Sources

- [Local source](../../../inbox/<clip-id>/source.md) — [original page](https://example.com)
```

## Domain index

`domains/<domain>/README.md` should state the domain boundary, current durable judgments, disagreements or open questions, and a short note index. It is a map, not a transcript and not a dump of all extracted facts.

## Root index

`LIBRARY.md` should remain small. List active domains, their scope, recent meaningful changes, and unresolved inbox count. Do not enumerate every source at the root.
