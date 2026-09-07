# @deepseek-ai/dsh-client-ui-fde-project

English | [中文](README.zh.md)

Browser presentation for the FDE project delivery workspace. The system opens on the root-level Project Center, where the user creates or manages a project before entering its single-project home and delivery environment. Project Center and the persistent sidebar open the same browser-owned New Project form. Creation establishes the project and opens its management page; only an explicit Enter Project action opens or creates a Session. System Architecture appears from solution design, Usage Analysis and project runtime controls from development, Evaluation & Optimization from validation, and API Docs only while the project is running with a real OpenAPI source.

## Behavior

Across all eight stages, the workbench exposes the native composer only for the project's actual current stage. Historical and future views hide it and release its reserved space without changing project progress. Returning to the current view restores input; reopening an earlier stage requires the existing reasoned return flow and a successful Host update. Agent Chat retains its normal input and drafts.

The project collection opens on All Projects in card view, ordered by recent activity: the newest Workspace, Session, or loaded stage update, with creation time available for projects without Sessions. Lists, filters, and pagination share that order; priority ordering remains an explicit option and the separate priority card retains its action ranking. The priority-card background is a decorative static WebP, with no pointer interaction or generated UI text.

Project Preview resolves a platform-owned isolated URL using only the Workspace ID, authorizes its exact local authority and opens it in the current Session's Browser tab. Both stage actions and the Session header use this flow; no project-specific CSP or port edits are required. The header also offers an explicit external open of the original runtime URL. Better Sidebar's downstream patch compares frame policies with the actual parent origin and leaves unsupported expressions to the browser instead of rejecting every non-wildcard policy.

V2 stage five keeps development in Agent Chat. Its workbench shows the tested version and scope, shared runtime controls, project-defined metrics with source and result evidence, unresolved conditions, and explicit FDE stage acceptance. It neither invents development tasks nor starts work on page entry. Verification actions prepare an editable conversation draft; runtime actions reuse the Session header implementation. Project records expand inline, and the scrollport ends above the native composer. Historical stage-five views expose records without execution or acceptance controls. The stage-five metric view does not replace the legacy validation page or its optional Agent Trial runner. Metric rows stay in a height-limited, keyboard-focusable scroll region with sticky column headers; current and historical views retain every metric and evidence link, with horizontal scrolling on narrow screens.

- Project Center is the default system entry and replaces the center/right work surfaces, so the underlying conversation, composer, and Better Sidebar cannot show through or receive input. It does not repeat the sidebar brand in a separate page header. The project overview shows real-project totals, human decisions, running Sessions, stage position, current AI FDE work, artifacts or evidence, recent activity, runtime, schedule, and the recommended next action. New Project opens the same structured form as the sidebar; successful creation opens Project Details with zero Sessions allowed. Each project provides direct Enter Project and View Stage & Artifacts actions. All Projects provides list, card, and real delivery-timeline views. The page reads only Workspaces registered in the isolated DSH state; it adds no demo projects, fabricated trends, or actionless portfolio charts to the first screen.
- It reads the existing Workspace list, creation metadata, Session summaries, and Workspace-scoped six-stage projection. Project Details shows real stage outputs: three requirement files; five solution documents plus architecture; canonical development core docs, Feature/task evidence, and three close-out files; the validation candidate, environment, datasets, metrics/evidence, issues, blockers, and three validation outputs; deployment-trial version/environment/evidence/issues and four outputs; or final acceptance, deliverables, conditions, responsibility transfer, and four handover outputs. Present Markdown can be read in place. An FDE uses a two-step confirmation for all six fixed transitions, including pilot to handoff and handoff to terminal completion, only after the corresponding Host checks pass; the Agent cannot perform these actions. Project Details also offers an explicit one-step return with a required reason and second confirmation. It keeps every artifact, displays the latest audit, marks affected later stages for renewed confirmation, and uses “Reopen Project” for the terminal state. A successful Host commit invalidates the matching Project Delivery stage prompt so it re-reads the same durable revision.
- Enter Project Delivery opens that Workspace's most recently updated non-archived ordinary Session. Subagent, archived, and other-project Sessions are excluded; only a project with no recoverable Session uses the official first-blank-session flow.
- Conversation keeps Chat and Trajectory available throughout delivery. Project-specific result views are registered only after their corresponding stage starts; loading or failure never reveals later-stage views early.
- The optional stage-four ontology route renders only the current Workspace's structurally validated `.fde/design/knowledge-graph.json`. The shared `3d-force-graph` renderer owns the live three-dimensional simulation; soft attraction between each connected component and its display anchor keeps disconnected groups in frame without fixed coordinates or artificial relationships. Luminous node meshes, degree-based rings, Bloom and camera-relative stars provide depth. Initial framing fits the real graph; collision-aware names are visible without hovering. All real relationships appear by default; the optional backbone is a deterministic maximum spanning forest, not a business-importance judgment. Moving particles indicate registered relationship direction, never live execution. Automatic orbit, pause/resume, interruption on drag or selection, and reduced-motion handling make motion controllable. Search, related-entity navigation, community isolation, reset, fullscreen and evidence details never mutate project facts.
- From project development onward, the Session header provides Start Project. It first enables the pinned Better Sidebar terminal and browser capabilities, records one exact Host operation, then queues a visible instruction in the project Session. The Agent reads project `AGENTS.md`, starts the real service in a persistent “项目运行” terminal, verifies its loopback URL, and reports success or a concrete blocker. A blocked start stays under low-frequency observation and can recover through the same Session and operation after its prerequisites are supplied. Running projects expose Open Project, View Terminal, and Stop Project; stop uses the original Session, sends an interrupt through terminal tools, and preserves the transcript within the current Host lifecycle. View Terminal always targets the recorded runtime Session, waits briefly for its live tab, and accepts an already-visible same-title terminal. If a Host restart has discarded the old Agent PTY, it returns to that project conversation and asks the Agent to create only a replacement observation terminal and verify the existing preview; it does not restart the service or claim that the old transcript was recovered.
- The first observed transition of a current start operation to `running` automatically opens Better Sidebar's embedded Browser once, with only the verified loopback authority added to its allowlist; it never invokes the operating-system browser or reopens the same running snapshot. API Docs, System Architecture, and Evaluation read the trusted `/api/fde-project/snapshot` route. API Docs stays absent until runtime is `running` and the snapshot contains a configured OpenAPI source.
- Usage Analysis aggregates the current project's existing `sessionStats` and `tokenUsage` projections into Token, model-call, Session-activity, and runtime views. External export remains disabled until deployment configuration opts in.
- From validation onward, Evaluation & Optimization shows the explicit sequence Generate Evaluation Plan, Confirm Evaluation Plan, and Start Validation. Its overview derives completion, result distribution, evidence and artifact coverage, blockers, category coverage, and five-step progress from the current project snapshot; result and category filters are presentation-only. Metrics expose their prior-stage document references, and confirmation is bound to the current plan-definition digest; result updates and FDE decisions do not invalidate it. Project Progress keeps long hashes, paths, and issue text inside their cards. An open issue offers an inline FDE-only acceptance form. An unmet required metric separately offers Accept Metric: the FDE must record a reason before that metric stops blocking, while its real NOT_RUN/FAIL status and evidence gap stay visible. Both actions refresh the current project snapshot, affect only their addressed item, and never turn a metric into PASS. The existing Agent Trial runner remains available as Run Fixed Cases, an optional validation method rather than the complete workflow. Plan generation, validation execution, and fixed cases each require an explicit user action; mounting or viewing the page never starts a model call.
- Deployment Trial presents the current candidate, target-environment authorization, five project-local evidence classes, issue decisions, blockers, and four fixed outputs. An unresolved issue exposes an inline FDE-only acceptance form whose reason is bound to the exact displayed contract; accepting one issue does not rewrite its evidence, authorize the environment, or clear another blocker. When evidence, issue decisions, and outputs are otherwise complete, a separate two-step FDE action confirms the exact displayed target and trial conclusion; the Host records authorization and readiness without executing deployment, stop, or rollback. Acceptance Handover presents the final version, enterprise conclusion, controlled deliverable locations, conditions, training/access/operations responsibility transfer, blockers, and four fixed outputs. Its four-step FDE form records the enterprise conclusion with multiple project evidence paths, marks only actually obtainable deliverables, resolves or explicitly accepts each condition, and records training plus access/operations responsibility transfer with evidence against the exact displayed digest. Saving the form changes facts only: it neither performs those real-world actions nor completes the project. Each page keeps its stage transition behind a separate second FDE confirmation; terminal completion keeps the handover record visible while all six stage segments remain complete.

## Project files

```text
.fde/project-runtime.json
.fde/api-docs.json
.fde/architecture.json
.fde/design/knowledge-graph.json
.fde/design/semantica/
.fde/evaluations/cases/*.yml
.fde/evaluations/reports/*/report.json
.fde/evaluations/baseline/report.json
.fde/evaluations/validation.json
.fde/evaluations/validation-plan-approval.json
.fde/deployment-trial.json
.fde/acceptance-handover.json
fde-deliverables/01-requirement-research/requirement-research-report.md
fde-deliverables/01-requirement-research/confirmation-checklist.md
fde-deliverables/01-requirement-research/requirement-baseline.md
fde-deliverables/02-solution-design/project-prd.md
fde-deliverables/02-solution-design/solution-design.md
fde-deliverables/02-solution-design/development-plan.md
fde-deliverables/02-solution-design/acceptance-plan.md
fde-deliverables/02-solution-design/solution-baseline.md
docs/PRD.md
docs/specs/product-spec.md
docs/specs/feature-map.md
docs/specs/FNNN-slug/spec.md
docs/specs/FNNN-slug/plan.md
docs/specs/FNNN-slug/tasks.md
fde-deliverables/03-project-development/implementation-report.md
fde-deliverables/03-project-development/runbook.md
fde-deliverables/03-project-development/development-baseline.md
fde-deliverables/04-validation/validation-plan.md
fde-deliverables/04-validation/validation-report.md
fde-deliverables/04-validation/validation-baseline.md
fde-deliverables/05-deployment-trial/deployment-runbook.md
fde-deliverables/05-deployment-trial/deployment-baseline.md
fde-deliverables/05-deployment-trial/trial-operation-report.md
fde-deliverables/05-deployment-trial/issue-closure-list.md
fde-deliverables/06-acceptance-handover/delivery-inventory.md
fde-deliverables/06-acceptance-handover/acceptance-report.md
fde-deliverables/06-acceptance-handover/operations-and-maintenance-guide.md
fde-deliverables/06-acceptance-handover/handover-record.md
```

## V2 delivery workbenches

The sidebar and body follow the actual project stage unless a stage is explicitly being viewed. Returning clears only the browsing selection. There is no demonstration banner, alternate entry, data source, or lifecycle. Improvement completion counts and review time come from the persisted project stage.

The final three V2 stages have distinct delivery workbenches: Pilot readiness and results, production acceptance and handover, and evidence-led improvement. Tabs use Host-checked delivery facts; details open on the right and fixed artifacts remain accessible without a narrow record rail. Future and historical previews are read-only and do not advance lifecycle state. Execution remains in the Agent conversation; no deployment, monitoring or production-query adapter is implied.

Pilot uses a dark illustrated header, four evidence totals, three equal overview columns, a semantic-dependency panel, fixed records and an explicit human-review section. Its content scrolls above the current-stage composer; history keeps the existing read-only composer behavior. Graph counts and recovery duration are display extracts from the recorded summary, not fresh measurements; absent counts stay unregistered. File details and revision copying use the actual record paths and revision. The illustration is decorative and contains no project facts.

Production uses a light header, a dark evidence-total strip, release-sequence and adoption views, and a two-column delivery archive. Charts only display recognizable values from the source summary; unrecognized summaries remain text, and missing values are not replaced with examples. Test or simulated observations retain their source qualifiers and complete summaries. Acceptance and handover shortcuts select the existing tabs; file access, read-only history, and explicit human review retain their existing behavior.

Improvement uses a navy illustrated header, grouped evidence counts, source-grounded signal rows, fixed-record cards and a compact graph-dependency panel. The complete summary and simulation qualifiers remain available in details; missing evidence never becomes a successful example. File and Agent shortcuts reuse the existing callbacks. Human review still requires confirmation, records one improvement cycle and does not execute release. The page scrolls above the existing composer.


## Model Experience

### Project start and stop instructions

#### What the model sees

Only after an FDE clicks Start Project or Stop Project, the package queues one visible user message in the exact project Session. It contains the Host-issued operation id and tells the Agent to read the project's own `AGENTS.md`, use the Better Sidebar terminal tools for the persistent process, verify actual readiness or exit, and settle the operation through `project_runtime_report`. Commands, ports, preview paths, and OpenAPI locations are never guessed by the UI.

#### Token effect

Opening project pages adds no runtime prompt tokens. Each explicit start or stop appends one bounded instruction to the chosen Session; project instructions, terminal output, and verification results enter context only when the Agent reads or invokes them.

#### KV Cache effect

The runtime instruction is appended to the ordinary Session suffix. Its operation id and verified project facts are operation-specific and do not replace earlier request prefixes.

## Known Limitations and Deferred Work

- Project creation metadata is browser-local in the current Workspace view store; a second browser does not receive company and schedule fields yet.
- API documentation embedded in an iframe depends on the target server's frame policy; Open Project itself uses the internal Better Sidebar Browser.
- Project start needs the pinned Better Sidebar terminal Host dependencies. Missing `AGENTS.md`, unavailable terminal tools, an unstartable checkout, or failed readiness checks remain a visible blocked state rather than simulated success.
- The architecture diagram uses a deterministic grouped layout rather than an interactive editor. It fits all groups into the available viewport above the composer by default; zoom is relative to that fit, and Fit Window restores the complete overview. Node inspection, connection animation, and full-diagram SVG/PNG exports remain available.
- External Langfuse/OTLP status is not shown while the exporter is disabled by deployment configuration.
- Project Details keeps files read-only. Its mutations are limited to explicit FDE stage confirmation after Host-side document, structured-state, evidence, architecture, and revision checks; an explained one-step stage return; and explained manual acceptance of one still-open validation issue or one unmet required metric after exact-contract Host checks. Returning a stage never edits or deletes project artifacts. Metric acceptance records a separate decision and never overrides the real result. Editing, moving, deleting, metric-result overrides, deployment execution, customer signatures, and Agent use remain in Project Delivery or the project's controlled external process.
