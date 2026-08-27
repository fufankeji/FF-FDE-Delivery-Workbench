# @deepseek-ai/dsh-fde-stage

English | [中文](README.zh.md)

Host-side current-stage state for FDE projects. The package opens one `storage-domain` table keyed by Harness WorkspaceId and exposes trusted same-origin POST routes that read or initialize the record and perform three fixed transitions: `requirements` to `solution`, `solution` to `development`, then `development` to `validation`. Concurrent first reads share one write; transition requests are serialized per Workspace and require the exact browser revision. The first gate rechecks three fixed requirement-research files; the second rechecks five fixed solution-design documents and a confirmed project architecture; the third rechecks three fixed project-development close-out files. No route accepts an arbitrary target stage.

The package also registers bundled `fde-requirement-research`, `fde-solution-design`, and `fde-project-development` Skills plus one short stage-aware system section. The development Skill applies a lightweight spec-first contract directly to the project's canonical `docs/` tree and evidence-backed tasks, without adding a second CLI or task database. Only an FDE's explicit browser confirmation can advance the stage. The remaining three gates stay deferred.

## Model Experience

While an Agent belongs to a registered project in requirement research or solution design, the model sees one short section naming the current stage, fixed output directory, on-demand Skill, and prohibition on confirming or advancing the project. The complete matching Skill body is loaded only when the existing skill tool is invoked. No stage-transition tool is registered.

#### KV Cache effect

The short stage section is stable within each supported stage and changes only when the committed project stage changes. It becomes empty from development onward. A longer Skill body affects only the ordinary conversation suffix after an explicit Skill load.

## Known Limitations and Deferred Work

- The route is loopback/same-origin only and requires an existing WorkspaceId.
- The record contains only the current stage, revision, and timestamps; transition history, affected-stage state, later delivery-gate evidence, and browser push updates remain deferred.
- Only the requirements-to-solution and solution-to-development gates exist. Later stages cannot be advanced through this package yet.
- Fixed files are checked for presence and readability; their business quality remains the FDE's responsibility.
