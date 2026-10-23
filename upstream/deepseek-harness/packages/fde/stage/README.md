# @deepseek-ai/dsh-fde-stage

English | [中文](README.zh.md)

HTTP routes require Connection's authenticated owner identity and same-origin request checks. Local binding is the default; explicit LAN access uses a concrete `--host` IP and the startup authorization URL. The retired `--lan` flag cannot disable authentication.

Host-side current-stage state for FDE projects. The package opens one `storage-domain` table keyed by Harness WorkspaceId and exposes trusted same-origin POST routes that read or initialize the record and perform six fixed transitions: `requirements` to `solution`, `solution` to `development`, `development` to `validation`, `validation` to `pilot`, `pilot` to `handoff`, then `handoff` to the terminal `completed` state. Concurrent first reads share one write; transition requests are serialized per Workspace and require the exact browser revision. The six gates respectively recheck three requirement-research files; five solution-design documents and a confirmed project architecture; three project-development close-out files; the current FDE-confirmed validation plan, contract, evidence, blockers, and three validation outputs; the deployment-trial contract, environment authorization, five evidence files, issues, and four outputs; then the final acceptance/handover contract, deliverables, conditions, responsibility transfer, evidence, and four outputs. A separate FDE-only route returns exactly one stage, including reopening `completed` to `handoff`; it requires a reason, retains files and evidence, records a bounded audit, and marks the returned range for renewed confirmation. No route accepts an arbitrary target stage.

The seven stage-one methods are complete Chinese SKILL.md packages under skills/, with focused references and templates. The native FileSystemSkillProvider reads only this fixed directory and loads current bodies on demand. Platform priority stays at 250, preserving project overrides and prior user-level precedence. The seven hardcoded bodies are no longer registered. Other stages, evidence checks, records and manual decisions remain unchanged; Skills cannot advance a project.

The trusted read-only GET /api/fde-stage/skills route refreshes platform metadata, bodies and downloadable UTF-8 files from the same directory, including paths and SHA-256 values. Required licensing stays in the packages. It does not enumerate user/global Skill directories or customer projects, execute Skills or mutate project data.

The core method retains business reconstruction, causal diagnosis, measurement definitions, non-AI comparisons and three existing records. Shared persistence fields live once in qualify-ai-workflow/references/stage-records.md; other platform methods link there. Creation follows skill-creator: discriminating triggers, complete task-specific workflows and progressive references. Instructions do not prove the quality of a generated diagnosis.

## V2 delivery records

The selected methods for V2 stages six through eight describe the delivery record format, file digests, evidence scope and optional semantic dependencies. Legacy six-stage records and earlier V2 method instructions are unchanged. The actual stage gate consumes the Host projection, not file counts or an Agent recommendation.


## Lifecycle version isolation

Reading an existing record does not migrate it. Legacy completion and return operations accept only legacy records; V2 operations require `lifecycleVersion=2` and an authoritative `v2Stage`. A cross-version operation fails without changing the revision. Prompt selection follows the same version instead of assigning the discovery prompt to every legacy project.

## Model Experience

While an Agent belongs to a registered project in any active delivery stage, the model sees one short section naming the current stage, fixed output directory, available method routes, and prohibition on confirming or advancing the project. The complete bodies of only the selected Skills are loaded when the existing skill tool is invoked. The terminal `completed` state contributes no stage instruction. No stage-transition tool is registered.

#### KV Cache effect

The short stage section is stable within each active stage and changes only when the committed project state changes. It becomes empty after final completion. A longer Skill body affects only the ordinary conversation suffix after an explicit Skill load.

## Known Limitations and Deferred Work

- The route is loopback/same-origin only and requires an existing WorkspaceId.
- The record keeps a bounded return audit and renewed-confirmation boundary; general forward-transition history and browser push updates remain deferred.
- Deployment and acceptance contracts remain project files; the package does not execute deployment, hold credentials, authenticate customers, or sign acceptance.
- Fixed files are checked for presence and readability; their business quality remains the FDE's responsibility.
