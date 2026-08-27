# @deepseek-ai/dsh-client-ui-fde-project

English | [中文](README.zh.md)

Browser presentation for the FDE project delivery workspace. It adds a root-level Project Progress page beside the persistent sidebar, a project requirement Wiki with Galaxy View, and stage-aware delivery views. System Architecture appears from solution design, Observability and project runtime controls from development, Evaluation from validation, and API Docs only while the project is running with a real OpenAPI source.

## Behavior

- Project Progress replaces the center/right work surfaces while open, so the underlying conversation, composer, and Better Sidebar cannot show through or receive input.
- It reads the existing Workspace list, creation metadata, Session summaries, and Workspace-scoped six-stage projection. Project Details shows real stage outputs: three requirement files; five solution documents plus architecture; canonical development core docs, Feature/task evidence, and three close-out files; or the validation candidate, environment, datasets, metrics/evidence, issues, blockers, and three validation outputs. Present Markdown can be read in place. An FDE uses a two-step confirmation to enter solution, development, validation, or pilot only after the corresponding Host checks pass; the Agent cannot perform these actions. A successful Host commit invalidates the matching Project Delivery stage prompt so it re-reads the same durable revision.
- Enter Project Delivery opens that Workspace's most recently updated non-archived ordinary Session. Subagent, archived, and other-project Sessions are excluded; only a project with no recoverable Session uses the official first-blank-session flow.
- Conversation keeps Chat and Trajectory available throughout delivery. Project-specific result views are registered only after their corresponding stage starts; loading or failure never reveals later-stage views early.
- From project development onward, the Session header provides Start Project. It first enables the pinned Better Sidebar terminal and browser capabilities, records one exact Host operation, then queues a visible instruction in the project Session. The Agent reads project `AGENTS.md`, starts the real service in a persistent “项目运行” terminal, verifies its loopback URL, and reports success or a concrete blocker. A blocked start stays under low-frequency observation and can recover through the same Session and operation after its prerequisites are supplied. Running projects expose Open Project, View Terminal, and Stop Project; stop uses the original Session, sends an interrupt through terminal tools, and preserves the transcript.
- The first observed transition of a current start operation to `running` automatically opens Better Sidebar's embedded Browser once, with only the verified loopback authority added to its allowlist; it never invokes the operating-system browser or reopens the same running snapshot. API Docs, System Architecture, and Evaluation read the trusted `/api/fde-project/snapshot` route. API Docs stays absent until runtime is `running` and the snapshot contains a configured OpenAPI source.
- Observability aggregates the current project's existing `sessionStats` and `tokenUsage` projections. External export remains disabled until deployment configuration opts in.
- From validation onward, Evaluation shows the explicit sequence Generate Evaluation Plan, Confirm Evaluation Plan, and Start Validation. Its overview derives completion, result distribution, evidence and artifact coverage, blockers, category coverage, and five-step progress from the current project snapshot; result and category filters are presentation-only. Metrics expose their prior-stage document references, and confirmation is bound to the current plan-definition digest; result updates do not invalidate it. The existing Agent Trial runner remains available as Run Fixed Cases, an optional validation method rather than the complete workflow. Plan generation, validation execution, and fixed cases each require an explicit user action; mounting or viewing the page never starts a model call.
- Requirement Wiki browsing never starts a model call. An FDE selects only locally parsed `ready` Sources, then confirms the exact existing project Session, provider, model, possible cost, and customer-data transfer. The package rechecks that target before creating a build and queues the instruction only in the confirmed Session.
- The Wiki labels every result as candidate understanding and shows its revision, stale/build state, Source links, conflicts, and unknowns. Its Three.js Galaxy View and keyboard-operable page/relation list read the same immutable revision; search, topic filtering, one-hop focus, camera movement, and selection never change Wiki facts.

## Project files

```text
.fde/project-runtime.json
.fde/api-docs.json
.fde/architecture.json
.fde/evaluations/cases/*.yml
.fde/evaluations/reports/*/report.json
.fde/evaluations/baseline/report.json
.fde/evaluations/validation.json
.fde/evaluations/validation-plan-approval.json
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
.fde/requirement-wiki/build.json
.fde/requirement-wiki/current.json
.fde/requirement-wiki/versions/RNNNNNN/manifest.json
.fde/requirement-wiki/versions/RNNNNNN/pages/*.md
```

## Model Experience

### Requirement Wiki build instruction

#### What the model sees

Only after the FDE confirms one source set and the displayed Session/provider/model target, the package queues the following user message in that exact Session. `<BuildId>`, `<revision>`, and `<source-list>` are data-dependent values from the trusted Host build; each source-list row contains only one selected SourceId, derivative path, and stored filename.

##### Queued user message

```markdown
请执行当前 FDE 项目的需求知识整理。BuildId=<BuildId>，页面基于 revision R<revision>。

先调用 requirement_wiki_get，并传入 BuildId；随后只读取它返回的以下固定派生文本，不要读取其他项目或自行扩展来源：
<source-list>

把资料整体梳理为业务目标、角色、流程/SOP、系统与数据、业务规则、约束、验收方向、风险、冲突和未知项。每个知识页、关系、冲突和未知项都必须引用一个或多个本次 SourceId。完成后调用 requirement_wiki_publish 一次提交完整候选，expectedRevision 必须使用 requirement_wiki_get 返回的值。不要把候选理解写成客户已确认事实，不要推进项目阶段或项目基线。
```

#### Token effect

No tokens are added by loading or browsing the page. One confirmed build appends the message and selected Source list to the target Session; derivative text and Wiki data enter context only through the Host-owned read and requirement Wiki tools the Agent subsequently invokes.

#### KV Cache effect

The confirmed instruction appends to the ordinary Session suffix and does not replace an earlier request prefix. BuildId, revision, and Source rows vary per build, so that suffix is build-specific.

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
- The v1 architecture diagram uses a deterministic grouped layout rather than an interactive editor.
- External Langfuse/OTLP status is not shown while the exporter is disabled by deployment configuration.
- Project Details keeps files read-only. Its only mutation is explicit FDE stage confirmation after Host-side document, architecture, and revision checks; editing, moving, deleting, and Agent use remain in Project Delivery.
- Requirement knowledge cannot be built until the project has a Session with a routable model and at least one current `ready` Source. A changed target requires another confirmation.
- The browser presents the current Wiki revision only and has no general Wiki editor or revision diff. A viewport below 520 px, unavailable WebGL, context loss, or reduced-motion preference keeps the same knowledge available through the semantic list.
