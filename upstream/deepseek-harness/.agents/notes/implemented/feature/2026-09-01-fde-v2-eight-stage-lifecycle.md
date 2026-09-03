# Agent Note: V2 uses one authoritative eight-stage FDE lifecycle

Status: implemented

English | [中文](2026-09-01-fde-v2-eight-stage-lifecycle.zh.md)

## Problem

The workbench had two competing lifecycle models. The V2 product language described eight field-delivery stages, while persisted stage state, project summaries, and several headers still projected the older six-stage course flow. Later stages also lacked a shared, testable baseline for required artifacts, manual review, return paths, and copyable validation prompts. This made the interface look complete without giving the operator a reliable way to understand or test the whole delivery path.

## Decision

V2 uses one authoritative eight-stage state: discover value, define outcome and scope, investigate the environment, design and complete a vertical slice, run PoC and Eval, integrate and run a controlled Pilot, enter production and hand over, and continuously improve. The persisted record keeps this V2 state and its return and reconfirmation history. Legacy six-stage values remain only as an explicit compatibility projection for existing specialized pages and old project records; they do not define the current lifecycle.

Stages two through eight share a lightweight delivery baseline. Stage two exposes nine inspectable methods; stages three through six expose seven methods each, stage seven exposes eight, and stage eight exposes seven. Every catalog separates required work from conditional work, uses business-facing labels, and points to an actually registered Skill. The sidebar groups the methods without inventing execution state, and the Agent loads only the minimum methods needed for the current task. Every method states the business objective, fixed artifact paths, state-file contract, truth constraints, and the rule that only an FDE can change stage. The Host reads the stage-scoped JSON record and required files, then exposes current work, blockers, review readiness, and artifact availability. The project workbench renders the same four-action guided shape used to orient stage-one users, opens existing artifacts for preview, prepares an editable Agent task, and keeps review and return decisions inside the current project. Completion requires review-ready state and an explicit human confirmation; artifact existence never means that facts, evaluation, Pilot, production, or handover have passed.

The project center, project rail, and stage header all read the same eight-stage state and labels. Returning to a prior stage records the reason and marks downstream stages for reconfirmation. Stage eight records repeated improvement cycles instead of pretending that the project has no further work. Each stage has a Chinese manual-test pack with short prompts so an operator can create the baseline artifacts and manually walk the lifecycle tomorrow.

The project rail also supports read-only navigation across all eight stages without changing the persisted lifecycle state. The real current stage and the stage being viewed are marked separately. Completed stages expose only the recorded inputs, artifacts, blockers, and human stage conclusion that actually exist for the project; missing historical facts are reported as unrecorded instead of being completed from a template. Future stages are explicit not-started states: they show the current project stage, the condition for starting, and expected records, but never present planned methods or work as if execution had begun. A dedicated return action removes the preview selection and follows the authoritative current stage again.

The current-project workbench uses a collapsed project record axis on the right instead of a single button that can open only the current stage's artifacts. The axis lists only the current stage and stages already advanced by an FDE; future stages are excluded. Each node shows its stage number, current or completed state, and required-record count. Expanding a node exposes the inputs used at that time, the artifacts left by the stage, and the human decision, while an aggregate view summarizes all existing records. Selecting a historical node is read-only and never calls a stage-transition endpoint. The axis sizes itself to the number of existing stages instead of reserving an empty full-height rail.

The project center is a high-fidelity management home organized around human action. Its header keeps project identity, creation, and a static account area; the overview shows real projects, pending human decisions, running sessions, and registered schedules, while one dark card carries the current priority. The collection defaults to a two-column card view and retains list, filter, and sort controls. Project cards keep the eight-stage path, recent progress, required decision, and project-entry action. The priority illustration is a local static asset only: it adds no login, notification, or permission behavior and does not change the isolated workspace data source.

This implementation is deliberately a baseline, not a claim that every specialized field operation is complete. Dedicated value-evidence analysis, permission and governance matrices, real vertical-slice execution, evaluation runners, Pilot authorization and telemetry, production adoption evidence, and controlled release automation remain in their feature task lists. The generic baseline makes those stages navigable and testable without fabricating their results.

## Alternatives considered

**Keep the six-stage state and show eight labels only in the new workbench.** Rejected because project summaries, headers, transitions, and persisted state would disagree.

**Mark a stage complete as soon as its required files exist.** Rejected because files are candidate carriers, not proof that facts are confirmed or that real operations succeeded.

**Build every specialized stage surface before exposing the lifecycle.** Rejected because it would delay a testable end-to-end product path and encourage unverified complex integrations. The baseline preserves clear extension points while reporting unfinished work honestly.

## Consequences

Operators can now see and manually test one coherent eight-stage delivery path. Agent work, artifact persistence, current-project review, human stage decisions, returns, and continuous-improvement cycles have shared contracts. Existing V1 records and specialized six-stage pages remain reachable through an explicit compatibility projection. Advanced stage-specific execution remains visibly in progress rather than being inferred from file presence or static UI.
