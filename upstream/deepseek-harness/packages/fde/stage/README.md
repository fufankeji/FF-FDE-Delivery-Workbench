# @deepseek-ai/dsh-fde-stage

English | [中文](README.zh.md)

Host-side current-stage state for FDE projects. The package opens one `storage-domain` table keyed by Harness WorkspaceId and exposes trusted same-origin POST routes that read or initialize the record and perform six fixed transitions: `requirements` to `solution`, `solution` to `development`, `development` to `validation`, `validation` to `pilot`, `pilot` to `handoff`, then `handoff` to the terminal `completed` state. Concurrent first reads share one write; transition requests are serialized per Workspace and require the exact browser revision. The six gates respectively recheck three requirement-research files; five solution-design documents and a confirmed project architecture; three project-development close-out files; the current FDE-confirmed validation plan, contract, evidence, blockers, and three validation outputs; the deployment-trial contract, environment authorization, five evidence files, issues, and four outputs; then the final acceptance/handover contract, deliverables, conditions, responsibility transfer, evidence, and four outputs. A separate FDE-only route returns exactly one stage, including reopening `completed` to `handoff`; it requires a reason, retains files and evidence, records a bounded audit, and marks the returned range for renewed confirmation. No route accepts an arbitrary target stage.

The package also registers bundled `fde-requirement-research`, `fde-solution-design`, `fde-project-development`, `fde-validation`, `fde-deployment-trial`, and `fde-acceptance-handover` Skills plus one short stage-aware system section. The development Skill applies a lightweight spec-first contract directly to the project's canonical `docs/` tree and evidence-backed tasks. The validation Skill separates plan preparation from execution and requires every metric to cite real prior-stage documents. The deployment Skill records the target environment, current candidate, project-local runtime/rollback evidence, issues, and four fixed outputs without granting credentials or treating a local start as deployment; the Agent leaves authorization false and does not write `status=ready`, because the exact-contract Project Progress action owns that FDE decision. The handover Skill treats `.fde/deployment-trial.json` as the authoritative deployment fact when Markdown is stale, writes acceptance evidence as a bounded array, and keeps enterprise acceptance, artifact availability, condition decisions, and responsibility-transfer completion reserved for the evidence-backed FDE action in Project Progress. Skills can maintain candidate files but cannot call a stage-transition operation; recording handover facts and completing the project remain two distinct FDE actions.

## Model Experience

While an Agent belongs to a registered project in any active delivery stage, the model sees one short section naming the current stage, fixed output directory, on-demand Skill, and prohibition on confirming or advancing the project. The complete matching Skill body is loaded only when the existing skill tool is invoked. The terminal `completed` state contributes no stage instruction. No stage-transition tool is registered.

#### KV Cache effect

The short stage section is stable within each active stage and changes only when the committed project state changes. It becomes empty after final completion. A longer Skill body affects only the ordinary conversation suffix after an explicit Skill load.

## Known Limitations and Deferred Work

- The route is loopback/same-origin only and requires an existing WorkspaceId.
- The record keeps a bounded return audit and renewed-confirmation boundary; general forward-transition history and browser push updates remain deferred.
- Deployment and acceptance contracts remain project files; the package does not execute deployment, hold credentials, authenticate customers, or sign acceptance.
- Fixed files are checked for presence and readability; their business quality remains the FDE's responsibility.
