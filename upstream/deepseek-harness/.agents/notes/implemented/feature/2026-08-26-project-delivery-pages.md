# Agent Note: Project delivery pages over Workspace and Session facts

Status: implemented

English | [中文](2026-08-26-project-delivery-pages.zh.md)

## Problem

The FDE workbench uses one Harness Workspace as one delivery project and lets that project contain several ordinary Sessions. Conversation and the right development dock are suitable for doing the work, but neither is a truthful place to compare every project, its delivery stage, schedule, and activity. API documentation, system architecture, observability, and evaluation are also project artifacts or project-wide evidence: tying them to one Session would split facts that every Session in the Workspace must share.

The useful community plugins have narrower ownership. `dsh-openapi` loads one static process-wide API directory, `dsh-planchart` stores one Session plan and adds a steps overlay, `dsh-observe` exports runtime records to configured backends, and `dsh-eval-harness` owns Agent-driven regression tools. Installing each UI unchanged would either cross project boundaries, duplicate the development dock, or require external infrastructure before the local workbench can explain its own project.

## Decision

`@deepseek-ai/dsh-client-ui-fde-project` registers “项目进度” in `sidebar.footer.action` and renders the page through `shell.overlay`, offset by the live sidebar width. The page reads the Workspace and Session object layers, browser-local creation metadata, and the Workspace-keyed stage route. It shows stage segments and confirmed dates rather than inventing a percentage. Entering a project selects the latest visible ordinary Session in that Workspace, creates or reuses the first blank Session only when none is recoverable, opens it, and closes the global page. Entering a project detail forces a fresh project-artifact snapshot so Agent-written files and architecture confirmations do not remain hidden behind the controller's first-load cache.

The same client package registers four project views in `conversation.view`: API 文档, 系统架构, 观测, and 评估. Each view derives Workspace ownership from the current Session's membership. `@deepseek-ai/dsh-fde-project` exposes one trusted snapshot route that resolves an explicit registered WorkspaceId before reading `.fde/api-docs.json`, `.fde/architecture.json`, or `.fde/evaluations/`; a caller-supplied directory never selects the project.

The OpenAPI tools reuse the parser, catalog, validation, redirect, private-network, credential-header, timeout, and bounded-response implementations from MIT-licensed `dsh-openapi` commit `fb854355b89e495ded090b9e2eb94c33430d2366`. The upstream plugin's static catalog is not mounted directly. `openapi_list`, `openapi_describe`, and `openapi_call` instead resolve the calling Agent's cwd through `workspaceRegistry` on every execution and load only that Workspace's explicit configuration. Tool schemas stay constant across projects, while the execution path enforces project isolation and defaults to `GET` and `HEAD`.

The system architecture uses the grouped-node-and-edge idea from MIT-licensed `dsh-planchart` commit `e63a6359ed43e6ae35cac505f10a8d128f53eba7`, without its Session plan or right-side steps UI. `architecture_get` returns the exact project revision; `architecture_set` accepts one complete candidate only when its `expectedRevision` matches, validates bounded groups, nodes, and edges, then commits by locked atomic replacement. The browser provides deterministic layout, zoom, SVG/PNG export, and an exact-revision confirmation route. A candidate row on Project Progress is navigation, not confirmation: it opens the target project's latest visible ordinary Session and selects the System Architecture view through the scope-addressed Conversation service. The confirmation action remains inside that full view; a confirmed row becomes inert on the next fresh snapshot. Generating or modifying a candidate is an explicit prompt to the current Agent, and confirmation does not advance the delivery stage.

`dsh-observe@0.2.0` from commit `64791ff93ac01bac5bb6e6a14f48d072b479464b` is installed with `enabled: false`, no OTLP or Langfuse backend, and prompt/completion capture disabled. The local 观测 page therefore aggregates existing Session `sessionStats` and `tokenUsage` projections without capture or outbound traffic. A later deployment can configure an external backend without replacing the project page.

`dsh-eval-harness` commit `2f59376e2a2f22c151f75de446d5cde764dd5aff` supplies `eval_run`, `eval_gate`, and judge-calibration tools. Its obsolete exact DSH dependency numbers are redirected to this locked Harness checkout; its source is built during the approved Git dependency preparation step. A Host pre-execution guard confines cases, runtime output, and gate reports to the calling Agent's Workspace, rejects symlink traversal and model-selected executables or profiles, and denies Judge calibration in V1. The 评估 page only queues an `eval_run` instruction after a user click, reads reports from the current project's bounded directory, and lets the user atomically approve one indexed report as the baseline. Page loading and automated checks never start a model evaluation.

## Alternatives considered

**Put the project overview in a Conversation tab.** A Session tab disappears into whichever project is already open and cannot provide a natural multi-project entry. It also mixes project management with the page used for implementation work.

**Confirm architecture directly from Project Progress.** A compact artifact row cannot show the complete architecture, dependencies, or revision context. Project Progress therefore guides the FDE to the full System Architecture view and never owns the confirmation mutation.

**Install every community plugin unchanged.** The static OpenAPI catalog can expose one project's APIs to another Agent, and the planchart steps overlay duplicates project stages while remaining Session-owned. Their reusable mechanisms are retained behind Workspace ownership instead.

**Require Langfuse before showing observability.** That makes local delivery diagnostics depend on Docker, credentials, outbound access, and a second application. Existing durable Session projections provide an immediate project summary, while the exporter remains an explicit optional layer.

**Build a general project-management and evaluation platform.** Customer management, asset reuse, arbitrary Gantt editing, scheduled evaluations, and a full APM product exceed the single delivery-chain release. The implemented pages expose current project facts and explicit actions without creating those adjacent products.

## Consequences

The left sidebar remains the stable way to move between project management and delivery work, the center remains the official Conversation, and the right dock remains Files, Editor, and Git. API, architecture, observation, and evaluation state survives across Sessions because project files and Host records, not component memory, hold the facts. Cross-plugin deep links use a scope-addressed Conversation view action rather than DOM clicks or direct persistence edits. Missing files, disabled exporters, invalid reports, and unavailable API pages stay explicit rather than becoming demo data.

Five project tools add stable schemas to Agent requests: three OpenAPI tools and two architecture tools. Their results enter context only after invocation. External observability exports remain absent until deployment configuration opts in, and evaluation remains potentially billable only after a direct click. Company and schedule metadata still belong to the current browser's Workspace view store, iframe refusal has an external-open fallback rather than a cross-origin bypass, and the evaluation page delegates long-running process control to the current Agent and its existing cancel path.
