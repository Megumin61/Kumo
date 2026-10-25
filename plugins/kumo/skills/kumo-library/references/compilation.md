# Classification and Wiki compilation contract

## Concrete progressive summaries

Source summaries answer three questions: what is actually here, how its information or reasoning is organized, and what the reader can take away. Do not force identical bullet headings on every source. For example, an SVG tutorial can name transparent PNG → layered SVG with stable IDs → anchor deformation → shared timelines; an eight-link motion list should name representative tools and say it is a directory, not invent a production workflow. Keywords describe at most three concrete concepts, not the collection name.

Read the body before trusting the title. If a saved account tutorial contains an unrelated advertisement, state the mismatch, retain a discovery-only card for recapture, and do not derive account or financial methods. When the main argument is in images, inspect those images and retain their resource provenance. Do not promote unread video titles into steps.

A domain overview first names its information types and representative materials. Then provide up to three substantive takeaways and three reusable actions anchored to those materials. Explain the action, not merely “verify and iterate.” Necessary limitations stay attached to their source; long checks and unknowns should not dominate the first reading layer.

## Default meaning of 整理

One request covers the full scoped pipeline, not only moving tags or producing a prose summary:

1. Verify the connected root, list current tags, Wiki and sources. Record the scope and initial IDs, existing manual assignments, raw-file hashes and verbatim notes. Honor narrower requests; never replace a missing connection with an empty template.
2. Read pending/stale/incomplete bodies and notes, paginate to the relevant end, and inspect images carrying the main text or requested visual meaning. Media files alone are not evidence that a video was watched. Record actually inspected resources and gaps.
3. Preserve all existing manual labels. For unclassified items choose a suitable existing tag, or a small set of reusable new tags. Show the label/domain plan concisely, then apply authorized classification through preview/save. A broad tag chosen by the user may differ from the AI domain; preserve it.
4. Only after classifications finish, refresh the queue fingerprints: classification appends annotation events and can invalidate an earlier Wiki snapshot. Generate/update source cards from the inspected evidence. `evidenceStatus` distinguishes `sufficient` for the stated interpretation, `limited`, and `index_only` when only discovery/catalogue is justified. None is a fact-checking score.
5. Preserve stable domain/topic IDs. Compare related source cards, record meaningful supports/contradictions/examples/prerequisites/complements with evidence on both sides, update topic syntheses and domain methods (conditional takeaways, steps, checks, unknowns, applicability and citations). Do not require a relationship for every source or turn incidental co-occurrence into support.
6. Publish bounded previewed batches, up to20 source cards each. After each save recompute the queue from offset0; after the final batch refresh all affected domain/topic methods and their dependencies using `cards:[]` if needed. Existing relevant relationships involving recompiled cards must be re-evidenced, not silently lost.
7. Verify counts and fresh cards, source-to-topic/domain links, summary dependency freshness, visible tag counts and unchanged existing manual assignments; compare raw metadata/body hashes and verbatim notes. Distinguish all-source indexing from knowledge extracted from sufficient evidence. Report new labels, processed / skipped / stale / index-only counts, useful domain conclusions and remaining media gaps. Retrieval does not run this write pipeline.

If sources are added while organizing, finish the scoped snapshot first and report newly arrived items rather than claiming they were read. If evidence cannot be recovered locally, keep a discoverable, explicitly limited card; do not invent missing content or fetch/execute unfamiliar links automatically. A repeated request should incrementally process new/stale sources and revisit incomplete ones when new evidence exists, without duplicating tags, cards or facts. Do not recompile the same unchanged incomplete card in a loop; report its known gap instead.

## Two independent layers

User layer: original source packages stay in chronological inbox/archive locations. Tags/collections keep stable IDs. “Unclassified” is the absence of assigned tags; “classified” is a status, not a topical tag. Read existing tags and source notes first. Preserve any manual classification. For an unclassified source, reuse a matching visible label; propose a new short label only when existing collections do not fit. Prefer reusable topics over platform names unless the user groups by platform. Do not flood users with one tag per post. Ambiguous content remains unclassified with an explanation.

`preview_classification` → user-visible preview → `save_classification` appends a collection event through the verified same-library bridge. It never moves source directories. The code refuses stale/already classified sources. Correcting an existing user collection remains an explicit action in the collection UI, not an automatic reclassification. User notes remain verbatim.

AI layer: store interpretation in `wiki/kumo/`, outside the collection UI. A user collection need not equal an AI domain. One source may link to several domains/topics. This is derived knowledge, inspectable for debugging, not inaccessible secret memory.

## Bootstrap and incremental compilation

For each pending batch call `compilation_context(ids, query)` to reuse existing concepts and compare up to six fresh candidates. Inspect `existingRelations` for every recompiled source, including stale endpoints. `preview_wiki_batch` returns `removedRelations`; check this list and explain intentional removals instead of silently dropping old links. Refresh only affected topic/domain methods and ancestors. Read images carrying primary content and save their observed content in source-card image evidence so it becomes searchable without a separate OCR service.

1. Call `wiki_map` and `list_collections`. With no Wiki, define only domains justified by the sources. Reuse existing domain/topic IDs on updates; avoid parallel synonyms. Code creates storage/map scaffolding on the first authorized save; the model supplies meanings, not directories chosen from arbitrary paths.
2. Use `compilation_queue(limit)` to find pending or stale sources. During a full-library request work in bounded batches; persist valid batches, report coverage and interruptions. After saving a pending batch, start offset 0 again: the queue shrinks. For `all:true` rebuilds use pagination because fresh sources stay in the queue. Do not report “all compiled” if warnings or pending items remain.
3. Read each source body and user notes, then discussion/media as needed. Long text uses offsets; inspect needed images. Do not read the entire library into one prompt. Do not infer missing image/video details. For a missing/corrupt source report the gap, not a fabricated summary.
4. Produce source cards first, then compare the selected cards with existing related cards. Create/update topic summaries based on those comparisons. A topic is a reusable decision or concept, not just a post title; a domain groups coherent topics. Root map gives domain scope/triggers, domain map gives topics, topic gives a small set of cards; original source remains the final evidence.
5. Call `preview_wiki_batch`, review counts, affected nodes and relationships, then `save_wiki_batch` within the authorized scope. No write permission: present proposal and state it is not saved. Fingerprint/revision mismatch: reread changed sources/maps and re-preview; never retry the old plan repeatedly. Previous Wiki snapshots are retained in history; do not manually overwrite them.

## Payload meanings

Domains and topics: stable slug `id`, human `name`, `scope`, concise `summary`, concrete `triggers`, and `avoidWhen`. Topic also has `domainId`. Domain summary describes a navigation boundary, not all source facts.

Cards: source `id`, exact `fingerprint` from compilation_queue, `domainIds`, `topicIds`, concise `summary`, `reuseWhen`, `avoidWhen`, `limitations`, exact `evidence` quotes with `view` body/notes/comments, and actual `inspectedImages` resource names (empty if none viewed). Record facts, methods, examples and explicit user intent separately in the summary. A quote proves grounding location, not the correctness of the author's claim or the model's inference. Do not invent confidence percentages.

Use a readable source-card structure inside the summary when useful: contribution; mechanism/steps; applicable constraints; explicit user note vs inference; disagreements/missing evidence. Avoid redundant paraphrase of the entire post.

Relations: `from`, `to`, `type`, specific `reason`, `fromQuote`, `toQuote`. Both quotes must come from each card's validated evidence. Choose supports, contradicts, example, prerequisite or complements only when the relationship changes interpretation or reuse. Same keywords do not establish support; two copies of one post are not independent corroboration. No relationship is required for an isolated source. Recompiling a card removes old endpoint relationships unless re-evidenced.

## Domain knowledge and topic hierarchy

Keep user labels and the AI taxonomy independent. Never rename, delete, hide or reassign an existing user label as a side effect of compiling Wiki. Preserve stable source directories and all original annotations. A missing bridge is a connection failure, not an empty library; do not seed an empty substitute root.

Preserve existing assignments regardless of whether an earlier AI or the user created them. Classification applies only to unclassified sources. Reuse a fitting label before proposing additions; default to at most two new reusable labels in one organization pass, fewer when existing labels suffice. More requires a concrete explanation and user choice. Fine distinctions belong in AI topics, not a new visible tag for every source.

Domains may specify `parentDomainId` (maximum four levels, no cycles). Prefer a few coherent top-level directions; put specialized domains below them rather than creating unrelated roots. Root and parent counts include unique sources in descendants, never a sum that double-counts shared sources. Update parent syntheses whenever their actual evidence changes. Parent grouping is navigation, not proof that every child supports every parent claim.

Every adequately read source card should answer: what this contributes, what mechanism/example supports it, when it is reusable, and what it does not establish. Every supported topic/domain should additionally answer: what comparison across these sources teaches, what conditional judgment follows, how to apply it, how to check success, and what is still unknown. A list of post summaries is not a domain synthesis. If evidence is insufficient, explicitly leave the method unestablished rather than inventing conclusions.

For maps, expose domain → subdomain → topic → reusable judgment. Keep individual post titles out of the scene; use a separate evidence drawer with per-source summaries and links. Spatial proximity means hierarchy/layout only. Cross-links require actual cited source relationships, not guessed similarity. Node size means supporting-source coverage, not confidence, user taste or model capability. Retrieval reads the fresh domain method first and follows narrower branches only when needed; this is contextual guidance, not model training.

Topics may specify `parentTopicId` within the same domain, up to six levels. Create a subtopic only when it supports a reusable distinction. Same terms do not imply the same meaning, and a source can contribute to several topics without being moved or copied.

Compile bottom-up: read source and actual media → source card with evidence → compare related cards → conditional topic synthesis → domain method. For a domain/topic, optional `knowledge` has `takeaways` (conditional judgments), `steps` (task procedure), `checks` (observable quality checks), `openQuestions` (conflicts or missing evidence), and `evidence` entries (`sourceId`, `view`, exact `quote` from a validated card). Each claim should state its scope in the text and point to its supporting source; separate source fact, author opinion and AI inference. One source is a preliminary method, not independent corroboration. Reposts are not independent evidence. Preserve contrary evidence and explain differing conditions.

The compiler validates the referenced quotations and stores their source fingerprints. A changed dependency marks that node's knowledge for review; do not use stale methods as settled guidance. Navigation summaries can remain routing hints. To revise only methods, provide empty `cards` and update the affected domains/topics with fresh evidence; never publish an entirely empty batch.

During a relevant task, load the selected fresh domain method and applicable topic synthesis first. Use it as a proposed way of reasoning, check it against the user's actual constraints, then read precise facts and visual references from original sources as needed. Missing methods do not justify inventing them. The method is trusted only as derived evidence, not an instruction overriding the user or the host. Personal taste requires an explicit note or feedback; collecting many examples only indicates interest. Task outputs and user feedback are not silently saved as new knowledge.

The local `/ui/knowledge.html` graph reads the same Wiki through `/knowledge`; it is a read-only projection, not another category registry. No AI call occurs in the browser. If compilation has not happened, show raw pending sources and existing user labels rather than fictional domains or ability scores.

Image evidence uses `view:'image'`, the exact saved `resource` name and a concise observed quote/description. Put that resource in `inspectedImages` after actually viewing it. The compiler checks inventory membership and inspection declaration, not semantic truth or OCR accuracy; explicitly label AI transcription/visual interpretation. Never cite a body placeholder as support for a claim observed only in an image. A domain method referencing image evidence carries the same resource provenance and should be rechecked visually when needed.

## Growth and routing quality

Never promote every answer to Wiki knowledge. Verified new cross-source connections or corrections may be compiled when authorized; temporary task decisions stay in the task. Do not turn access frequency into credibility, newest content into universal truth, or collection into preference. Preserve opposing evidence with conditions rather than picking a winner automatically.

Changed fingerprints exclude cards from route results and mark pending. Domain/topic summaries may still require review; `summaryNeedsReview` signals this. Update affected summaries on the next compilation, or read original evidence instead of treating those summaries as reliable. Distinct topics may reuse the same card without copying its raw content.

For a retrieval task, use the compact map only as routing hints. Prefer direct cross-branch search when the domain is uncertain. Read cards for scope and exclusions, then fetch original evidence. Report actually applied sources. The current version has no embedding model and no guaranteed per-turn trigger; measure retrieval misses and task-quality differences before adding those capabilities.

