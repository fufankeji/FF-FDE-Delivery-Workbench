# @deepseek-ai/dsh-fde-project

English | [中文](README.zh.md)

Trusted Host support for the FDE project-delivery surfaces. It resolves one explicit Harness WorkspaceId, reads only that Workspace's `.fde/api-docs.json`, `.fde/architecture.json`, `.fde/evaluations/`, and requirement Wiki state, validates bounded structures, and returns one same-origin snapshot for the browser. It also adapts the locked `dsh-openapi` parser and HTTP implementation so the standard OpenAPI tools resolve configuration from the calling Agent's registered Workspace instead of a process-global API list. A pre-execution guard confines `dsh-eval-harness` cases and results to the same project, rejects symlink traversal and model-selected executables or profiles, and disables unapproved Judge calibration.

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

## Known Limitations and Deferred Work

- The package does not start project servers, run evaluations, or create architecture artifacts.
- API documentation URLs must be explicitly project-owned; absent configuration remains unconfigured.
- Evaluation reports are read-only and malformed reports are excluded instead of repaired.
- The adapter intentionally uses the locked plugin's parser and request modules because the upstream plugin's static process-wide API catalog cannot provide Workspace isolation by itself.
- Architecture history is file-based under `.fde/architecture-history/`; the browser presents the current version only.
- Requirement Wiki history is file-based under `.fde/requirement-wiki/versions/`; the Host snapshot presents the complete current revision and latest build only.
- The package does not upload or parse Sources, edit Wiki pages, run an automatic rebuild, or promote candidate knowledge into the requirement baseline or delivery stage.
