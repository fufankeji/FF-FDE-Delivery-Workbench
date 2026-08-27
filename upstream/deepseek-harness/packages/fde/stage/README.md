# @deepseek-ai/dsh-fde-stage

English | [中文](README.zh.md)

Host-side current-stage state for FDE projects. The package opens one `storage-domain` table keyed by Harness WorkspaceId and exposes trusted same-origin POST routes that read or initialize the record and perform four fixed transitions: `requirements` to `solution`, `solution` to `development`, `development` to `validation`, then `validation` to `pilot`. Concurrent first reads share one write; transition requests are serialized per Workspace and require the exact browser revision. The four gates respectively recheck three requirement-research files; five solution-design documents and a confirmed project architecture; three project-development close-out files; then the current FDE-confirmed validation plan, contract, evidence, blockers, and three validation outputs. No route accepts an arbitrary target stage.

The package also registers bundled `fde-requirement-research`, `fde-solution-design`, `fde-project-development`, and `fde-validation` Skills plus one short stage-aware system section. The development Skill applies a lightweight spec-first contract directly to the project's canonical `docs/` tree and evidence-backed tasks. The validation Skill separates plan preparation from execution, requires every metric to cite real prior-stage documents, and gives exact result templates: `evidence` is one non-empty project-relative path string and WARN acceptance uses `waiverReason`. It cannot create the Host-owned FDE plan confirmation or write `waived` issue decisions; only an FDE's explained browser action may accept an open issue. Only an FDE's explicit browser confirmations can authorize the current plan and later advance the stage. The remaining two gates stay deferred.

## Model Experience

While an Agent belongs to a registered project in requirement research, solution design, project development, or validation, the model sees one short section naming the current stage, fixed output directory, on-demand Skill, and prohibition on confirming or advancing the project. The complete matching Skill body is loaded only when the existing skill tool is invoked. No stage-transition tool is registered.

#### KV Cache effect

The short stage section is stable within each supported stage and changes only when the committed project stage changes. It becomes empty from pilot onward. A longer Skill body affects only the ordinary conversation suffix after an explicit Skill load.

## Known Limitations and Deferred Work

- The route is loopback/same-origin only and requires an existing WorkspaceId.
- The record contains only the current stage, revision, and timestamps; transition history, affected-stage state, pilot/handoff evidence, and browser push updates remain deferred.
- The pilot-to-handoff and final handoff completion gates do not exist yet.
- Fixed files are checked for presence and readability; their business quality remains the FDE's responsibility.
