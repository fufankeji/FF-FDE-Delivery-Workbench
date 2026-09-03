# @deepseek-ai/dsh-fde-stage

English | [中文](README.zh.md)

Host-side current-stage state for FDE projects. The package opens one `storage-domain` table keyed by Harness WorkspaceId and exposes trusted same-origin POST routes that read or initialize the record and perform six fixed transitions: `requirements` to `solution`, `solution` to `development`, `development` to `validation`, `validation` to `pilot`, `pilot` to `handoff`, then `handoff` to the terminal `completed` state. Concurrent first reads share one write; transition requests are serialized per Workspace and require the exact browser revision. The six gates respectively recheck three requirement-research files; five solution-design documents and a confirmed project architecture; three project-development close-out files; the current FDE-confirmed validation plan, contract, evidence, blockers, and three validation outputs; the deployment-trial contract, environment authorization, five evidence files, issues, and four outputs; then the final acceptance/handover contract, deliverables, conditions, responsibility transfer, evidence, and four outputs. A separate FDE-only route returns exactly one stage, including reopening `completed` to `handoff`; it requires a reason, retains files and evidence, records a bounded audit, and marks the returned range for renewed confirmation. No route accepts an arbitrary target stage.

For stage one the package registers separate method Skills (`qualify-ai-workflow`, conditional `reframe-ai-engagement`) and only the necessary engineering Skills (`fde-orient`, `knowledge-interview`, `ownership-map`, `repo-recon`, `stakeholder-brief`) instead of one composite Skill. Candidate workflows persist claim-level evidence references, while the Artifact Catalog records pinned source versions, content versions, structure maturity, and evidence state. The manual stage gate consumes the same validated projection and never treats file existence as readiness. Stage two exposes nine methods; stages three through six expose seven methods each, stage seven exposes eight, and stage eight exposes seven. Each catalog separates required work from conditional work, uses business-facing labels, and points to an actually registered Skill. The Agent loads only the minimum methods needed for the current task. Skills can maintain candidate files but cannot call a stage-transition operation; recording handover facts and completing the project remain distinct FDE actions.

The trusted same-origin read-only `GET /api/fde-stage/skills` route returns only the methods fixed in the product, including business-facing labels, required-or-conditional grouping where applicable, usage guidance, full Markdown definitions, and source metadata. It never enumerates the operator's machine, global Skill directories, or other projects, and exposes no execution or mutation capability. The client uses this projection to render an explainable method tree beneath the current stage.

## Model Experience

While an Agent belongs to a registered project in any active delivery stage, the model sees one short section naming the current stage, fixed output directory, available method routes, and prohibition on confirming or advancing the project. The complete bodies of only the selected Skills are loaded when the existing skill tool is invoked. The terminal `completed` state contributes no stage instruction. No stage-transition tool is registered.

#### KV Cache effect

The short stage section is stable within each active stage and changes only when the committed project state changes. It becomes empty after final completion. A longer Skill body affects only the ordinary conversation suffix after an explicit Skill load.

## Known Limitations and Deferred Work

- The route is loopback/same-origin only and requires an existing WorkspaceId.
- The record keeps a bounded return audit and renewed-confirmation boundary; general forward-transition history and browser push updates remain deferred.
- Deployment and acceptance contracts remain project files; the package does not execute deployment, hold credentials, authenticate customers, or sign acceptance.
- Fixed files are checked for presence and readability; their business quality remains the FDE's responsibility.
