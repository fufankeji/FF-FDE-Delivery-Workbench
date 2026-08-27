# Agent Note: Project requirement Wiki revisions and Galaxy View

Status: implemented

English | [中文](2026-08-27-project-requirement-wiki-galaxy-view.zh.md)

## Problem

The [project resource intake](2026-08-26-project-resource-intake.md) and local parsing flow give one FDE Workspace durable customer originals, SourceIds, and derived text, but those records remain separate documents. An FDE needs to review how business goals, roles, processes, systems, rules, constraints, acceptance directions, risks, conflicts, and unknowns relate across the complete selected set. A generated summary without source identity cannot be audited, while updating one shared graph in place lets a failed or stale run damage the last useful understanding.

Generation also crosses an explicit data and cost decision. Opening a project page must not send customer material to a model, and a build confirmed for one Session, provider, and model must not silently move to another route. The graph is candidate understanding: publishing it must not confirm customer facts, update the requirement baseline, or advance the delivery stage.

## Decision

`@deepseek-ai/dsh-fde-project` uses the existing `@deepseek-ai/dsh-fde-source` catalog as its only input inventory. A trusted start request addresses one registered Workspace and 1–30 explicit SourceIds. Each admitted Source must be `ready`, match the original file's recorded bytes and modification time, and reference a bounded, non-symlink file under `.fde/derived/`. The build freezes the SourceIds, original metadata, parser and parser version, derived paths, current Wiki revision, and a fingerprint of the complete project Source catalog. Publication rechecks those facts, so changed, removed, newly added, cross-project, pending, or reparsed material requires a new build.

The browser prepares a build against an existing Session belonging to that Workspace, resolves its routable provider and model, and shows both before confirmation. Start rechecks the same Session membership and exact provider/model before creating Host state, then queues one visible instruction in that Session. If queuing fails, the Host build becomes `cancelled`; browsing and refreshing the Wiki never invokes a model.

The Agent receives two Workspace-scoped tools. `requirement_wiki_get` marks the exact BuildId running and returns its frozen Sources, expected revision, and optional current Wiki. `requirement_wiki_publish` accepts one complete candidate and rejects unknown citations, invalid page or relation identities, executable HTML, bounds violations, stale Sources, a stale revision, or a replaced build. Every page, relation, conflict, and unknown cites at least one SourceId from that build.

Successful publication writes page Markdown and one manifest into a new immutable `.fde/requirement-wiki/versions/RNNNNNN/` directory, then atomically replaces `current.json`. `build.json` records `queued`, `running`, `succeeded`, `failed`, or `cancelled`. Failure and cancellation preserve the prior current revision; a Source-catalog change makes that revision `stale` without rewriting it. The Host snapshot exposes only the complete current revision and latest build state.

`@deepseek-ai/dsh-client-ui-fde-project` renders that same revision as both a Three.js Galaxy View and a semantic page/relation list. A deterministic revision-and-page layout maps knowledge pages to topic-colored glow sprites and relations to line segments; OrbitControls supplies rotation, zoom, and pan, while search, topic filtering, one-hop focus, hover, and selection operate on the same page identities. Camera and layout state never enter the Wiki files. A viewport below 520 px, WebGL initialization failure, context loss, or reduced-motion preference disables continuous three-dimensional rendering as needed while the keyboard-operable list, page text, issues, and Source links remain available.

The implementation is informed by three pinned MIT-licensed community sources without installing their runtimes: `@evegoodevening/dsh-llmwiki@0.1.1` at commit `7f620ccd2ef1d3a490c0b988149f9b518db35aa4` for SourceId provenance and atomic Markdown publication; `wangning19940904/dsh-llm-wiki` at commit `d7d896d58e3de4e2fbe0cf51d2938ea98a303bba` for Workspace isolation, Wiki links, and relation-graph organization; and `Longwind1984/galaxy-view@0.6.1` at commit `b49b60cb04687783153f24ff7f9b0a0af59334af` for the star-field, camera, search, filtering, and focus interaction vocabulary. The shipped client uses `three@0.184.0`; it does not load Obsidian Vault/Workspace APIs, `3d-force-graph`, a Python process, a vector database, or separate model credentials.

## Verification

The [REAL Loader composition test](../../../../packages/fde/project/tests/loader-composition.spec.ts) boots the Host plugin through a test-only `cordis.yml`, carries one real stored and parsed Source through both Agent tools, and observes the immutable revision in the project snapshot. The [Host behavior suite](../../../../packages/fde/project/tests/requirement-wiki.spec.ts) pins restart recovery, staleness, exact revision and Source checks, citation rejection, and preservation of the current revision after failure or cancellation.

The client suites pin exact Session/provider/model confirmation, target-change rejection, deterministic layout and filtering, source traceability, and accessible WebGL fallback. The [assembled Web scenario](../../../../apps/web/tests/requirement-wiki.e2e.ts) loads the shipped composition without a model credential, observes a real WebGL canvas, filters its star and relation counts, opens the keyboard list, and records the user-visible snapshot.

## Alternatives considered

**Install either community Wiki plugin unchanged.** Rejected because neither uses the FDE Source record, exact project Session/model confirmation, complete immutable revisions, current project-detail UI, or the existing Host trust rules. A global Wiki root or second parser would create another project identity and ingestion truth.

**Run a vector database or automatic RAG ingestion beside the Source pipeline.** Rejected because this feature needs an auditable synthesis of explicitly selected current documents, not a second background index. Automatic ingestion would also make upload or parsing imply model authorization.

**Overwrite one mutable Wiki or publish pages incrementally.** Rejected because a partial model result, stale Source, validation error, or process failure could leave a mixed revision. Complete candidate validation plus an atomic current pointer keeps the prior reviewable version intact.

**Persist graph coordinates as knowledge facts.** Rejected because camera and layout changes do not change customer knowledge. Deterministic client layout gives a stable initial view without adding a second versioned data model.

**Use only a static list or two-dimensional diagram.** Rejected because the confirmed product direction requires Galaxy View as the relationship overview. The semantic list remains a first-class reading and accessibility path rather than a replacement for the graph.

## Consequences

One project can turn real locally parsed customer material into a recoverable, traceable candidate Wiki without changing the original files or creating a parallel upload system. Every successful build has a fixed provenance set and immutable revision, while model routing and customer-data transfer remain tied to a visible user confirmation. New or changed project Sources make the current result visibly stale instead of triggering hidden regeneration.

The cost is a bounded but larger client bundle for Three.js and project storage for every published revision. The browser presents the current revision rather than a history browser or revision diff, and the Wiki has no general editor, embeddings, cross-project search, or automatic baseline promotion. Candidate quality remains model-dependent; Source citations establish provenance, not customer confirmation or factual correctness.
