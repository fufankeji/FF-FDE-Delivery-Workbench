# @deepseek-ai/dsh-fde-project

English | [中文](README.zh.md)

Trusted Host support for the FDE project-delivery surfaces. It resolves one explicit Harness WorkspaceId, reads only that Workspace's `.fde/project-runtime.json`, `.fde/api-docs.json`, `.fde/architecture.json`, `.fde/evaluations/`, fixed requirement/solution/validation outputs, canonical project-development docs, and requirement Wiki state, validates bounded structures, and returns one same-origin snapshot for the browser. Stage output readers report present, missing, or read-error state without creating files or treating presence as confirmation; present Markdown outputs receive bounded, read-only same-origin preview URLs selected by Host-indexed artifact ids rather than browser-supplied paths. It also adapts the locked `dsh-openapi` parser and HTTP implementation so the standard OpenAPI tools resolve configuration from the calling Agent's registered Workspace instead of a process-global API list.

## Project development docs

The read-only development projection scans `docs/PRD.md`, `docs/specs/product-spec.md`, `docs/specs/feature-map.md`, and up to 100 canonical `docs/specs/FNNN-slug/{spec,plan,tasks}.md` Feature directories. Optional frontmatter supplies title, status, planned dates, milestone, and blocker; unchecked and checked Markdown tasks provide the only task counts. Missing dates stay unknown, duplicate Feature ids are reported, and the browser never receives a write-back task API. The same projection reports the three close-out files under `fde-deliverables/03-project-development/`. Every preview id is re-indexed and realpath-checked inside the registered Workspace before bytes are served.

## Project runtime

An explicit start or stop request creates one exact operation in `.fde/project-runtime.json`, owned by the Session that must perform it. The visible Agent reads the project's own `AGENTS.md`, uses the Better Sidebar persistent terminal tools, verifies the real loopback project URL, and settles that operation through `project_runtime_report`. A blocked start remains recoverable by the same Session and operation after missing prerequisites are supplied and a real preview URL is verified. The Host still rejects stale operation ids, reports from another Session, non-loopback or credentialed URLs, out-of-project OpenAPI paths, and every other invalid state transition. A stop keeps the terminal title and transcript reachable while clearing the preview and API runtime facts only after the Agent truthfully reports that the service exited. A blocked stop must be retried before another start can begin.

## Validation contract

The validation projection parses schema-v2 `.fde/evaluations/validation.json` with bounded candidates, environments, project-specific datasets, metrics, results, and issues. Every metric must cite one or more existing prior-stage project documents plus document-local references. A PASS or WARN result uses one non-empty project-relative `evidence` string, not an array; WARN acceptance uses the camelCase `waiverReason` field. Evidence must resolve to a real file inside the registered Workspace. If one metric is malformed, the projection preserves the valid candidate, environment, datasets, other metrics, issues, and independently indexed stage artifacts for diagnosis, but marks the entire contract invalid and withholds its digest, plan confirmation, and stage gate. Once the plan exists and every source is readable, an exact-plan same-origin action atomically records the FDE's confirmation in `.fde/evaluations/validation-plan-approval.json`. Its SHA-256 digest covers the candidate, environment, datasets, and metric definitions, but excludes execution results, evidence, and issue state: changing the plan makes confirmation stale while normal result updates do not. An FDE may also accept one currently open issue only with a non-empty reason. The exact-contract same-origin action rechecks the plan digest and open issue under the contract-file lock, preserves the original issue, and writes `status=waived`, `waiverReason`, and `waivedAt`; it never changes a metric result or clears unrelated blockers. Required NOT_RUN/FAIL results, missing evidence, unaccepted WARN, open critical/high issues, incomplete manual-acceptance records, missing outputs, and absent/currently stale plan confirmation remain explicit blockers. The same snapshot indexes `fde-deliverables/04-validation/{validation-plan,validation-report,validation-baseline}.md` for bounded preview. It never runs validation or advances the delivery stage.

## Requirement Wiki

The trusted start route accepts 1–30 explicit SourceIds from the existing FDE Source catalog. Each Source must have a current `ready` derivative under `.fde/derived/`; the build freezes the original bytes and modification time, parser identity and version, derivative path, complete Source-catalog fingerprint, and expected Wiki revision. Publication rechecks every frozen fact and rejects changed, removed, newly added, cross-project, pending, or reparsed material.

`requirement_wiki_get` exposes only the exact active build and marks it running. `requirement_wiki_publish` validates one complete candidate with at most 120 pages, 360 relations, 80 conflicts, and 80 unknowns; every item must cite a SourceId from the build, and page Markdown cannot contain executable HTML. Successful publication creates an immutable `.fde/requirement-wiki/versions/RNNNNNN/` directory and atomically replaces `current.json`. Failure or cancellation updates `build.json` without changing the prior current revision. A changed project Source catalog marks the current revision stale; it never starts an automatic rebuild.

## Model Experience

### Project OpenAPI and architecture tools

#### What the model sees

Five stable tool schemas: `openapi_list`, `openapi_describe`, `openapi_call`, `architecture_get`, and `architecture_set`. At execution, each tool resolves `exec.agent.session.header.cwd` through the Workspace registry. OpenAPI results contain only that project's operation metadata or bounded HTTP response; credentials remain environment references and never appear in tool arguments or results. Architecture writes require the exact current revision and atomically replace one complete candidate.

#### Token effect

The five fixed schemas add input tokens to each request whose Agent can see the global tool registry. Project operation catalogs and architecture documents are loaded only after a call and enter context only through that call's bounded result.

#### KV Cache effect

The schemas are identical across projects and requests, so changing the current project's OpenAPI file does not change the cached tool-schema prefix. A tool result changes only the ordinary conversation suffix.

### Requirement Wiki tools

#### What the model sees

Two stable tool schemas: [`requirement_wiki_get`](../../../docs/tool-catalog.md#requirement_wiki_get) and [`requirement_wiki_publish`](../../../docs/tool-catalog.md#requirement_wiki_publish). The first returns the exact BuildId's fixed Source metadata, expected revision, and optional current Wiki; the second accepts one complete traceable candidate. Neither tool discovers Sources outside the user-confirmed build.

#### Token effect

The two fixed schemas add input tokens to each request whose Agent can see the global tool registry. Build metadata and the current Wiki enter context only after `requirement_wiki_get`; the selected derivative contents enter only when the Agent reads the returned project paths, and a published candidate enters through the bounded `requirement_wiki_publish` result.

#### KV Cache effect

The schemas remain identical across projects and builds, so Source or Wiki changes do not alter the cached tool-schema prefix. Tool calls and data-dependent results extend the ordinary conversation suffix.

### Project runtime report tool

#### What the model sees

One stable `project_runtime_report` schema. The visible start or stop instruction supplies the exact operation id; the tool resolves the calling Session's registered Workspace and accepts only the state and verified runtime facts for that operation.

#### Token effect

The fixed schema adds input tokens to requests that can see the global tool registry. Operation-specific ids, URLs, terminal titles, and failure reasons enter context only through the visible user instruction and the bounded tool result.

#### KV Cache effect

The schema is stable across projects. Only the ordinary conversation suffix changes for each operation.

## Known Limitations and Deferred Work

- The package does not execute server commands itself, run evaluations, or create architecture artifacts; the visible project Agent owns start and stop work through a persistent terminal.
- The package does not infer dates, task completion, or Feature state from Git history, file timestamps, Agent replies, or conversation content, and it never edits project docs.
- API documentation must come from an explicit project file or a verified running-project report; absent OpenAPI stays unconfigured.
- Evaluation reports are read-only. A malformed metric keeps the remaining valid contract facts visible for diagnosis, but the Host never repairs it or treats the partial projection as confirmable.
- The adapter intentionally uses the locked plugin's parser and request modules because the upstream plugin's static process-wide API catalog cannot provide Workspace isolation by itself.
- Architecture history is file-based under `.fde/architecture-history/`; the browser presents the current version only.
- Requirement Wiki history is file-based under `.fde/requirement-wiki/versions/`; the Host snapshot presents the complete current revision and latest build only.
- The package does not upload or parse Sources, edit Wiki pages, run an automatic rebuild, or promote candidate knowledge into the requirement baseline or delivery stage.
