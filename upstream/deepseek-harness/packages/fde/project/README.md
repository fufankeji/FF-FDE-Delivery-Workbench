# @deepseek-ai/dsh-fde-project

English | [中文](README.zh.md)

Trusted Host support for the FDE project-delivery surfaces. It resolves one explicit Harness WorkspaceId, reads only that Workspace's `.fde/api-docs.json`, `.fde/architecture.json`, and `.fde/evaluations/` artifacts, validates bounded structures, and returns one same-origin snapshot for the browser. It also adapts the locked `dsh-openapi` parser and HTTP implementation so the standard OpenAPI tools resolve configuration from the calling Agent's registered Workspace instead of a process-global API list. A pre-execution guard confines `dsh-eval-harness` cases and results to the same project, rejects symlink traversal and model-selected executables or profiles, and disables unapproved Judge calibration.

## Model Experience

### Project OpenAPI and architecture tools

#### What the model sees

Five stable tool schemas: `openapi_list`, `openapi_describe`, `openapi_call`, `architecture_get`, and `architecture_set`. At execution, each tool resolves `exec.agent.session.header.cwd` through the Workspace registry. OpenAPI results contain only that project's operation metadata or bounded HTTP response; credentials remain environment references and never appear in tool arguments or results. Architecture writes require the exact current revision and atomically replace one complete candidate.

#### Token effect

The five fixed schemas add input tokens to each request whose Agent can see the global tool registry. Project operation catalogs and architecture documents are loaded only after a call and enter context only through that call's bounded result.

#### KV Cache effect

The schemas are identical across projects and requests, so changing the current project's OpenAPI file does not change the cached tool-schema prefix. A tool result changes only the ordinary conversation suffix.

## Known Limitations and Deferred Work

- The package does not start project servers, run evaluations, or create architecture artifacts.
- API documentation URLs must be explicitly project-owned; absent configuration remains unconfigured.
- Evaluation reports are read-only and malformed reports are excluded instead of repaired.
- The adapter intentionally uses the locked plugin's parser and request modules because the upstream plugin's static process-wide API catalog cannot provide Workspace isolation by itself.
- Architecture history is file-based under `.fde/architecture-history/`; the browser presents the current version only.
