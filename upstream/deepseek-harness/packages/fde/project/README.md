# @deepseek-ai/dsh-fde-project

English | [中文](README.zh.md)

Trusted Host support for the FDE project-delivery surfaces. It resolves one explicit Harness WorkspaceId, reads only that Workspace's `.fde/project-runtime.json`, `.fde/api-docs.json`, `.fde/architecture.json`, `.fde/evaluations/`, `.fde/deployment-trial.json`, `.fde/acceptance-handover.json`, fixed six-stage outputs, and canonical project-development docs, validates bounded structures, and returns one same-origin snapshot for the browser. Stage output readers report present, missing, or read-error state without creating files or treating presence as confirmation; present Markdown outputs receive bounded, read-only same-origin preview URLs selected by Host-indexed artifact ids rather than browser-supplied paths. It also adapts the locked `dsh-openapi` parser and HTTP implementation so the standard OpenAPI tools resolve configuration from the calling Agent's registered Workspace instead of a process-global API list.

## Project development docs

The read-only development projection scans `docs/PRD.md`, `docs/specs/product-spec.md`, `docs/specs/feature-map.md`, and up to 100 canonical `docs/specs/FNNN-slug/{spec,plan,tasks}.md` Feature directories. Optional frontmatter supplies title, status, planned dates, milestone, and blocker; unchecked and checked Markdown tasks provide the only task counts. Missing dates stay unknown, duplicate Feature ids are reported, and the browser never receives a write-back task API. The same projection reports the three close-out files under `fde-deliverables/03-project-development/`. Every preview id is re-indexed and realpath-checked inside the registered Workspace before bytes are served.

## Project runtime

`POST /api/fde-project/runtime/preview` accepts only a trusted Workspace ID and resolves its running URL from the runtime record. A temporary loopback proxy uses a random per-project `*.localhost` origin and OS-assigned port, separate from GUI storage and other projects. It forwards unchanged page/resource bodies, HTTP streams and WebSocket upgrades, adapts embedding headers to the actual GUI parent, rewrites same-target redirects and request origins, and removes cookie Domain attributes. Every request rechecks the runtime; active streams are revoked within one second of observing a stopped or changed record. Disposal closes listeners and streams. Arbitrary targets, GUI ports, cross-origin writes and external redirects are rejected; project source and durable state are untouched. The browser keeps an explicit original-URL fallback for hardcoded absolute origins, cross-site authentication or unsupported HTTPS embedding environments.

An explicit start or stop request creates one exact operation in `.fde/project-runtime.json`, owned by the Session that must perform it. The visible Agent reads the project's own `AGENTS.md`, uses the Better Sidebar persistent terminal tools, verifies the real loopback project URL, and settles that operation through `project_runtime_report`. A blocked start remains recoverable by the same Session and operation after missing prerequisites are supplied and a real preview URL is verified. The Host still rejects stale operation ids, reports from another Session, non-loopback or credentialed URLs, out-of-project OpenAPI paths, and every other invalid state transition. A stop keeps the terminal title and transcript reachable while clearing the preview and API runtime facts only after the Agent truthfully reports that the service exited. A blocked stop must be retried before another start can begin.

## Validation contract

The validation projection parses schema-v2 `.fde/evaluations/validation.json` with bounded candidates, environments, project-specific datasets, metrics, results, and issues. Every metric must cite one or more existing prior-stage project documents plus document-local references. A PASS or WARN result uses one non-empty project-relative `evidence` string, not an array; WARN acceptance uses the camelCase `waiverReason` field. Evidence must resolve to a real file inside the registered Workspace. If one metric is malformed, the projection preserves the valid candidate, environment, datasets, other metrics, issues, and independently indexed stage artifacts for diagnosis, but marks the entire contract invalid and withholds its digest, plan confirmation, and stage gate. Once the plan exists and every source is readable, an exact-plan same-origin action atomically records the FDE's confirmation in `.fde/evaluations/validation-plan-approval.json`. Its SHA-256 digest covers the candidate, environment, datasets, and metric definitions, but excludes execution results, evidence, issue state, and FDE metric decisions: changing the plan makes confirmation stale while normal result or decision updates do not. An FDE may accept one currently open issue only with a non-empty reason; the locked exact-contract action preserves the issue and writes `status=waived`, `waiverReason`, and `waivedAt`. An FDE may separately accept one unmet required metric with a non-empty reason; the locked action writes `result.manualAcceptance.reason` and `acceptedAt` while preserving the real NOT_RUN/FAIL status, evidence gap, value, and note. Either action removes only its own blocker and rejects stale plan digests. Required metrics without valid evidence or a complete metric acceptance, unaccepted WARN, open critical/high issues, incomplete issue acceptance, missing outputs, and absent/currently stale plan confirmation remain explicit blockers. The same snapshot indexes `fde-deliverables/04-validation/{validation-plan,validation-report,validation-baseline}.md` for bounded preview. It never runs validation or advances the delivery stage.

## Delivery close-out contracts

The deployment-trial projection parses schema-v1 `.fde/deployment-trial.json`, verifies that its validation, deployment, health, rollback, trial, and issue evidence paths remain inside the registered Workspace, and indexes four fixed Markdown outputs under `fde-deliverables/05-deployment-trial/`. Readiness requires an authorized named environment, one candidate version, `status=ready`, all five evidence files, all four outputs, and no unresolved or deferred critical/high issue; resolved, accepted, and deferred issues retain their recorded explanation and responsibility. One exact-contract same-origin action lets the FDE accept an open or deferred issue with a non-empty reason and changes only that issue. A separate exact-contract action is available only after the evidence, issue decisions, and outputs are otherwise complete; it atomically records the FDE's target-environment authorization and `status=ready` without executing deployment, stop, or rollback. File locks and SHA-256 digests reject stale decisions.

The acceptance-handover projection parses schema-v1 `.fde/acceptance-handover.json`, accepts up to forty project-relative enterprise-acceptance evidence files, verifies project-relative evidence and deliverable files, records external HTTP(S) deliverables without fetching them, and indexes four fixed Markdown outputs under `fde-deliverables/06-acceptance-handover/`. One exact-contract, file-locked FDE action may update only the acceptance conclusion and evidence, each declared deliverable's availability, condition decisions, and the three responsibility-transfer facts plus evidence; it rejects stale digests and changed item sets while preserving deliverable identity, location, version, and checksum. Project-completion readiness requires an accepted or conditionally accepted conclusion with evidence, a readable deployment-trial baseline, at least one available deliverable, no open condition, complete reasons and ownership for accepted conditions, completed training/access/operations responsibility transfer with project evidence, and all four outputs. Recording these facts does not complete the project: the fixed Host stage route remains a separate final confirmation. Neither projection deploys, uploads or downloads artifacts, authenticates customers, signs acceptance, or advances a project by itself.

## V2 delivery workbenches

Project snapshots read only the registered workspace records. No alternate demonstration payload or lifecycle is returned. User-authorized integration fixtures use the same stage files, evidence validation, and completion endpoints; fixture provenance belongs in the source records, not a second product mode.

The V2 Pilot, production and improvement snapshots include a read-only delivery projection. Version manifests and evidence pin project-local files by SHA-256; absent or changed evidence cannot satisfy the stage gate. Local, sandbox, Pilot, production and prior-source scopes remain distinct. Optional semantic references describe snapshot versus runtime integration, not automatic Semantica deployment. No projection runs services, approves customers, or modifies project data.

## Model Experience

### V2 stage-five evidence reader

The stable, argument-free `project_evaluation_get` tool resolves the calling Session's registered Workspace and returns its stage-five candidate, metrics, evidence gaps and current testing fingerprint without writing files or running tests. `.fde/stages/evaluation.json` stores `evaluation.candidate` (`summary`, `version`, `sourceFiles`) and `evaluation.testing` (`environment`, `metrics`, optional `run`). Metrics use `id/title/kind/required/criterion/sourceRefs`; run results use `metricId/status/value/evidenceRefs` and the fingerprint captured before execution. Results retain NOT_RUN/RUNNING/PASS/WARN/FAIL; a changed candidate file, version, environment, metric or source produces STALE. Required non-PASS results, missing values/evidence, malformed records and unreadable files prevent stage acceptance. Paths must resolve inside the project; the reader permits 100 paths per list, 256 distinct files, 8 MiB per file and 32 MiB total. There is no development-task gate or whole-project scan. This V2 record is separate from the legacy validation contract above. The fixed schema adds input tokens; bounded metadata enters context only after a call, leaving the schema cache prefix stable. File presence is checked, not the truth of the reported test, which still requires FDE review.

### Project OpenAPI and architecture tools

#### What the model sees

Five stable tool schemas: `openapi_list`, `openapi_describe`, `openapi_call`, `architecture_get`, and `architecture_set`. At execution, each tool resolves `exec.agent.session.header.cwd` through the Workspace registry. OpenAPI results contain only that project's operation metadata or bounded HTTP response; credentials remain environment references and never appear in tool arguments or results. Architecture writes require the exact current revision and atomically replace one complete candidate.

#### Token effect

The five fixed schemas add input tokens to each request whose Agent can see the global tool registry. Project operation catalogs and architecture documents are loaded only after a call and enter context only through that call's bounded result.

#### KV Cache effect

The schemas are identical across projects and requests, so changing the current project's OpenAPI file does not change the cached tool-schema prefix. A tool result changes only the ordinary conversation suffix.

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
- Deployment-trial and acceptance-handover records remain project files. The Agent maintains candidate descriptions and fixed documents; exact-contract Project Progress actions own the reserved FDE decision fields. The Host does not execute deployment, probe external deliverable URLs, collect customer signatures, or manage credentials.
- The adapter intentionally uses the locked plugin's parser and request modules because the upstream plugin's static process-wide API catalog cannot provide Workspace isolation by itself.
- Architecture history is file-based under `.fde/architecture-history/`; the browser presents the current version only.
