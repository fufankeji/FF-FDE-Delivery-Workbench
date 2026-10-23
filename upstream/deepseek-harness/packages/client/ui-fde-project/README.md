# @deepseek-ai/dsh-client-ui-fde-project

English | [中文](README.zh.md)

Browser presentation for the FDE project delivery workspace. The system opens on the product introduction; Enter Platform opens Overview. Platform navigation provides Overview, Project Center, Lab, and Skills Center as peer entries. Overview reads real project and lab summaries and offers direct access to recent projects. Skills Center combines seven complete Chinese platform Skills with explicitly supplied original course packages. Cards support source filtering, search, read-only file browsing and downloads; viewing never installs or executes a Skill. Project Center and the persistent sidebar open the same browser-owned New Project form. Creation establishes the project and opens its management page; only an explicit Enter Project action opens or creates a Session. System Architecture appears from solution design, Usage Analysis and project runtime controls from development, Evaluation & Optimization from validation, and API Docs only while the project is running with a real OpenAPI source.

## Behavior

FDE pages follow the official visual hierarchy: 20/28 work-page titles, 13/20 descriptions, semantic theme surfaces and shared control sizing. Project detail, all eight stages, method readers, Skills, architecture, usage, evaluation, runtime output and preview retain their own information and actions. Public navigation draws the retained skin over an opaque backing; dialogs use the native mask and readable overlay surface. The introduction keeps its display layout, and the graph keeps its dark canvas and category colors. Visual changes do not modify project state or theme preferences.

Skills Center opens the canonical SKILL.md body over the retained cards. The dialog shows the name and content with download, expand and close actions, without a directory tree, raw path, frontmatter code block or upstream attribution panel. Relative references open in the same reader with one Back to Skill action. Focus, independent scrolling, Escape and list restoration remain unchanged.

Platform names, descriptions, bodies and download files come from the Host, which reads the same maintained packages as the native Agent provider. ZIP entries preserve package paths without a duplicate outer Skill directory. Templates, shared stage rules and necessary licensing remain in downloads but are not listed as browsing controls. Catalog and download failures remain visible and recoverable.

The default All filter retains Platform Built-in and Course Original cards. The six-file lesson-one snapshot in src/client/course-skills/fde-business-diagnosis.json remains byte-preserving and read-only, with course metadata on its card. It does not register an Agent capability or scan additional courses.

The browser has no independent platform-content snapshot or upstream importer. Platform files live under fde/stage/skills and arrive through the existing trusted catalog route. Downloads use fflate/browser with realm-local Uint8Array inputs. Original course content stays independent; compatibility with other agents is not claimed.

The platform sidebar places Settings below the return-home action and attribution. Its `sidebar.settings.shortcut` outlet opens the existing Settings panel, including the Models/API-key section; it neither duplicates configuration nor removes the project sidebar's original Settings entry.

Overview uses a compact three-metric strip, the three most recently updated projects, and separate Lab and platform/course Skills cards. Counts, project order, company and stage labels remain source-driven. The lab summary contributes two top metrics and a bottom card through its existing slot; one request supplies all three. Both packages coordinate numeric grid tracks at the same breakpoints because CSS Module area names are package-local. Decorative project marks do not classify projects. The sidebar owns the overview's footer attribution.

Stage headings, instructions, dialogs, and review conditions name concrete delivery tasks. Established lifecycle titles and technical identifiers remain unchanged. Technical editors explain ontology terms in Chinese; graph status and query modes have readable labels. Reported selection, test evidence, and human approval remain distinct. Saved customer content is displayed without terminology rewriting, and read-only historical views do not claim files are immutable snapshots.

Across all eight stages, the workbench exposes the native composer only for the project's actual current stage. Historical and future views hide it and release its reserved space without changing project progress. Returning to the current view restores input; reopening an earlier stage requires the existing reasoned return flow and a successful Host update. Agent Chat retains its normal input and drafts.

The project collection opens on All Projects in card view, ordered by recent activity: the newest Workspace, Session, or loaded stage update, with creation time available for projects without Sessions. Lists, filters, and pagination share that order; priority ordering remains an explicit option and the separate priority card retains its action ranking. The priority-card background is a decorative static WebP, with no pointer interaction or generated UI text.

Project Preview requests a platform-issued isolated URL using only the Workspace ID and opens a dedicated FDE preview tab. Stage actions and the Session header share this flow without editing project CSP or ports. The Host proxy admits the actual parent origin; an explicit external-open action remains available.

V2 stage five keeps development in Agent Chat. Its workbench shows the tested version and scope, shared runtime controls, project-defined metrics with source and result evidence, unresolved conditions, and explicit FDE stage acceptance. It neither invents development tasks nor starts work on page entry. Verification actions prepare an editable conversation draft; runtime actions reuse the Session header implementation. Project records expand inline, and the scrollport ends above the native composer. Historical stage-five views expose records without execution or acceptance controls. The stage-five metric view does not replace the legacy validation page or its optional Agent Trial runner. Metric rows stay in a height-limited, keyboard-focusable scroll region with sticky column headers; current and historical views retain every metric and evidence link, with horizontal scrolling on narrow screens.

- Project Center is reached from platform navigation or project-side actions and replaces the center/right work surfaces, so the underlying conversation, composer, and Better Sidebar cannot show through or receive input. It does not repeat the sidebar brand in a separate page header. The project overview shows real-project totals, projects needing attention, running Sessions, stage position, current AI FDE work, artifacts or evidence, recent activity, runtime, schedule, and the recommended next action. New Project opens the same structured form as the sidebar; successful creation opens Project Details with zero Sessions allowed. Each project provides direct Enter Project and View Stage & Artifacts actions. All Projects provides list, card, and real delivery-timeline views. The page reads only Workspaces registered in the isolated DSH state; it adds no demo projects, fabricated trends, or actionless portfolio charts to the first screen.

Project Center derives actionable notices only from current-stage open issues, current-version failed test or delivery results, Host review readiness, valid recorded past planned end dates, or read errors. Each affected card names its reason; the top notice, list status, count, filter and priority sort use the same rule. Incomplete projects, loading, active Sessions, resolved or historical issues and missing default artifacts do not independently produce attention. Completed projects are excluded. No qualifying facts leaves an explicit empty state; planned dates do not imply contractual lateness. Default ordering remains latest activity.
- It reads the existing Workspace list, creation metadata, Session summaries, and Workspace-scoped six-stage projection. Project Details shows real stage outputs: three requirement files; five solution documents plus architecture; canonical development core docs, Feature/task evidence, and three close-out files; the validation candidate, environment, datasets, metrics/evidence, issues, blockers, and three validation outputs; deployment-trial version/environment/evidence/issues and four outputs; or final acceptance, deliverables, conditions, responsibility transfer, and four handover outputs. Present Markdown can be read in place. An FDE uses a two-step confirmation for all six fixed transitions, including pilot to handoff and handoff to terminal completion, only after the corresponding Host checks pass; the Agent cannot perform these actions. Project Details also offers an explicit one-step return with a required reason and second confirmation. It keeps every artifact, displays the latest audit, marks affected later stages for renewed confirmation, and uses “Reopen Project” for the terminal state. A successful Host commit invalidates the matching Project Delivery stage prompt so it re-reads the same durable revision.
- Enter Project Delivery opens that Workspace's most recently updated non-archived ordinary Session. Subagent, archived, and other-project Sessions are excluded; only a project with no recoverable Session uses the official first-blank-session flow.
- Conversation keeps Chat and Trajectory available throughout delivery. Project-specific result views are registered only after their corresponding stage starts; loading or failure never reveals later-stage views early.
- The optional stage-four ontology route renders only the current Workspace's structurally validated `.fde/design/knowledge-graph.json`. The shared `3d-force-graph` renderer owns the live three-dimensional simulation; soft attraction between each connected component and its display anchor keeps disconnected groups in frame without fixed coordinates or artificial relationships. Luminous node meshes, degree-based rings, Bloom and camera-relative stars provide depth. Initial framing fits the real graph; collision-aware names are visible without hovering. All real relationships appear by default; the optional backbone is a deterministic maximum spanning forest, not a business-importance judgment. Moving particles indicate registered relationship direction, never live execution. Automatic orbit, pause/resume, interruption on drag or selection, and reduced-motion handling make motion controllable. Search, related-entity navigation, community isolation, reset, fullscreen and evidence details never mutate project facts.
- From project development onward, the header offers start, stop, preview, read-only Runtime Output and a separate Manual Terminal. Start and stop retain operation ids and use official Agent terminal tools with actual verification; stop retains the original runtime Session across views. Runtime Output reads only that project's Agent PTY, showing the latest 200 lines up to 64 KiB and stopping reads while hidden. Missing output after Host restart is explicit and creates no replacement process. Manual Terminal uses the Session current project directory and shares files and ports without entering the Agent transcript; service changes require rechecking.
- When the current start first reaches running, the FDE isolated project preview opens once, without opening a system browser or reopening on duplicate snapshots. API documentation still requires a running project and a real OpenAPI source.
- Usage Analysis defaults to project lifetime totals and keeps Today, 7-day and 30-day filters. The trusted project usage read combines `sessionStats`, `tokenUsage` and request-start `sessionActivity`; date-filtered cards, charts and session rows use the same activity intervals, not the session update date. Empty periods offer lifetime totals; loading, partial reads and failures remain distinct from zero. Long histories merge adjacent calendar days into at most 90 chart intervals without discarding totals. No conversation text or external telemetry is requested.
- From validation onward, Evaluation & Optimization shows the explicit sequence Generate Evaluation Plan, Confirm Evaluation Plan, and Start Validation. Its overview derives completion, result distribution, evidence and artifact coverage, blockers, category coverage, and five-step progress from the current project snapshot; result and category filters are presentation-only. Metrics expose their prior-stage document references, and confirmation is bound to the current plan-definition digest; result updates and FDE decisions do not invalidate it. Project Progress keeps long hashes, paths, and issue text inside their cards. An open issue offers an inline FDE-only acceptance form. An unmet required metric separately offers Accept Metric: the FDE must record a reason before that metric stops blocking, while its real NOT_RUN/FAIL status and evidence gap stay visible. Both actions refresh the current project snapshot, affect only their addressed item, and never turn a metric into PASS. The existing Agent Trial runner remains available as Run Fixed Cases, an optional validation method rather than the complete workflow. Plan generation, validation execution, and fixed cases each require an explicit user action; mounting or viewing the page never starts a model call.
- Deployment Trial presents the current candidate, target-environment authorization, five project-local evidence classes, issue decisions, blockers, and four fixed outputs. An unresolved issue exposes an inline FDE-only acceptance form whose reason is bound to the exact displayed contract; accepting one issue does not rewrite its evidence, authorize the environment, or clear another blocker. When evidence, issue decisions, and outputs are otherwise complete, a separate two-step FDE action confirms the exact displayed target and trial conclusion; the Host records authorization and readiness without executing deployment, stop, or rollback. Acceptance Handover presents the final version, enterprise conclusion, controlled deliverable locations, conditions, training/access/operations responsibility transfer, blockers, and four fixed outputs. Its four-step FDE form records the enterprise conclusion with multiple project evidence paths, marks only actually obtainable deliverables, resolves or explicitly accepts each condition, and records training plus access/operations responsibility transfer with evidence against the exact displayed digest. Saving the form changes facts only: it neither performs those real-world actions nor completes the project. Each page keeps its stage transition behind a separate second FDE confirmation; terminal completion keeps the handover record visible while all six stage segments remain complete.

## Project files

The product homepage keeps its existing layout and light palette under every workbench theme; only the delivery preview follows the theme. The homepage does not change the user's theme preference. Project counts appear only after the Workspace baseline is ready. Pending and failed reads show their status instead of a false zero, and entering project operations remains available.

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


Stage-one recommendation actions prepare Chinese business questions about extra work and its causes, measurement definitions, non-AI comparisons, and the next human decision. They still only prefill the native composer, preserve existing drafts, and never send or advance a project automatically. Machine identifiers in technical repair instructions retain their exact spelling.

## Model Experience

### Project start and stop instructions

#### What the model sees

Only after an FDE clicks Start Project or Stop Project, the package queues one visible user message in the exact project Session. It contains the Host-issued operation id and tells the Agent to read the project's own `AGENTS.md`, use the official Agent terminal tools for the persistent process, verify actual readiness or exit, and settle the operation through `project_runtime_report`. Commands, ports, preview paths, and OpenAPI locations are never guessed by the UI.

#### Token effect

Opening project pages adds no runtime prompt tokens. Each explicit start or stop appends one bounded instruction to the chosen Session; project instructions, terminal output, and verification results enter context only when the Agent reads or invokes them.

#### KV Cache effect

The runtime instruction is appended to the ordinary Session suffix. Its operation id and verified project facts are operation-specific and do not replace earlier request prefixes.

## Project Center activity and dates

Project Center and its timeline expose **Back to Overview** in the top breadcrumb. The timeline also exposes **Back to Project Center**, which restores the project collection, recent activity and delivery preview. Card/list switching remains available, and navigation does not open a Session or change project data.

The introduction homepage uses Enter Platform for all three entry buttons, opening Overview without a separate lab shortcut. Workbench navigation declares `fde.workbench.lab.page` and renders it independently of project state; Overview uses `fde.workbench.lab.summary` for read-only lab and case counts. Navigation preserves the visited training frame while switching modules. Existing project actions remain unchanged.

Recent activity pairs each latest update with its own title and timestamp. Session entries open that exact ordinary, non-archived Session in Agent Chat; stage and project-record entries open the corresponding project-management page. A removed or unavailable Session reports an error without falling back to another conversation. The list initially shows three entries and scrolls when expanded.

Delivery previews show registered dates for unfinished projects, ordered by end date, and each row opens its project. Both count and footer links open the complete delivery timeline. Timeline counts include only projects with registered dates; completed project dates remain available there. Company and dates come from the shared Workspace metadata service, with visible errors and retry instead of fabricated dates.

## Known Limitations and Deferred Work

- Legacy company and delivery dates become portable only after their original browser imports them into the project record. Recent activity summarizes the latest visible Session, stage-record and project-record updates; it is not a complete audit log.
- API documentation embedded in an iframe depends on the target server's frame policy; Open Project itself uses an FDE tab restricted to the platform-issued isolated project origin.
- Project start needs the official Agent terminal registry, backend and tools. Missing `AGENTS.md`, unavailable terminal tools, an unstartable checkout, or failed readiness checks remain a visible blocked state rather than simulated success.
- The architecture diagram uses a deterministic grouped layout rather than an interactive editor. It fits all groups into the available viewport above the composer by default; zoom is relative to that fit, and Fit Window restores the complete overview. Node inspection, connection animation, and full-diagram SVG/PNG exports remain available.
- External Langfuse/OTLP status is not shown while the exporter is disabled by deployment configuration.
- Project Details keeps files read-only. Its mutations are limited to explicit FDE stage confirmation after Host-side document, structured-state, evidence, architecture, and revision checks; an explained one-step stage return; and explained manual acceptance of one still-open validation issue or one unmet required metric after exact-contract Host checks. Returning a stage never edits or deletes project artifacts. Metric acceptance records a separate decision and never overrides the real result. Editing, moving, deleting, metric-result overrides, deployment execution, customer signatures, and Agent use remain in Project Delivery or the project's controlled external process.
