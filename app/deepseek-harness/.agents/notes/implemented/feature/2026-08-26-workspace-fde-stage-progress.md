# Agent Note: Workspace-scoped FDE stage progress

Status: implemented

English | [中文](2026-08-26-workspace-fde-stage-progress.zh.md)

## Problem

An FDE project spans multiple ordinary Sessions, while DSH planning, goals, todo lists, and workflow runs belong to one Agent or Session. Storing the current delivery stage in one conversation would make another conversation disagree, and storing it in browser state would lose authority on refresh or another page. A file appearing in the Workspace also does not prove that the customer or FDE accepted its contents. Stage progress therefore needs one project-level authority and explicit completion gates that distinguish candidate Agent output from an FDE decision.

## Decision

`@deepseek-ai/dsh-fde-stage` opens one `fde_stage` storage domain with a `projects` table keyed by WorkspaceId. Its trusted same-origin POST route accepts only a registered WorkspaceId, reads the record, or commits the initial `requirements` record before returning it. Six separate fixed completion routes implement the adjacent transitions from `requirements` through `handoff`, with the final route committing the terminal `completed` state; none accepts a browser-supplied target state. A separate FDE-only route returns exactly one adjacent stage, including reopening `completed` to `handoff`. It requires a non-empty reason, retains all project artifacts, records a bounded audit, and marks the former current stage and affected later stages for renewed confirmation. Every route requires the exact current revision and serializes transitions per Workspace.

The requirement gate reads three fixed Markdown artifacts. The solution gate reads `project-prd.md`, `solution-design.md`, `development-plan.md`, `acceptance-plan.md`, and `solution-baseline.md` plus the current confirmed project architecture. The development gate reads three close-out documents. The validation gate requires the exact FDE-confirmed plan, valid metric sources, each required metric's evidence-backed result or complete FDE manual acceptance, resolved blockers, and three validation outputs; accepting a metric never rewrites its measured status. The deployment-trial gate requires schema-v1 `.fde/deployment-trial.json`, an authorized target environment, five project-local evidence files, resolved or explicitly accepted critical/high issues, and four fixed outputs. The acceptance-handover gate requires schema-v1 `.fde/acceptance-handover.json`, accepted or conditionally accepted enterprise evidence, available deliverables, decided conditions, completed training/access/operations responsibility transfer with evidence, and four fixed outputs. File presence only makes an action eligible; the FDE confirms again in Project Progress and the Host rechecks every condition at commit time.

The Host registers six on-demand Skills—one per active stage—and one short stage-aware system-prompt section. The Skills constrain Agent output to fixed project paths, require candidate/unknown distinctions, and prohibit the Agent from confirming customer facts, architecture, stage advancement, or final project completion. Deployment actions still require the FDE's explicit external-action authorization and never grant credential access; acceptance records do not authenticate a customer or create a signature. Architecture updates use `architecture_get` and `architecture_set` rather than direct writes to `.fde/architecture.json`.

`@deepseek-ai/dsh-client-ui-fde-stage` owns one apply-scoped observable controller keyed by WorkspaceId. It resolves Session ownership only from the Workspace projection's `sessionIds`, coalesces duplicate reads, retains explicit errors, and retries only the addressed project. Two contextual registrations share that controller: `conversation.input.dock` shows the initial stage above a blank composer, and `conversation.session.header.utilities` shows the current stage after the Session starts. The blank strip uses the Conversation root's `--dsh-composer-card-max-width` and subtracts both `--dsh-composer-side-clearance` values, so it shares the input card's outer edges even though the Slot itself sits in the wider composer stack. The independent multi-project page and all six manual gates belong to [`ui-fde-project`](2026-08-26-project-delivery-pages.md), so project management does not become another Session view.

The product order is `requirements` → `solution` → `development` → `validation` → `pilot` → `handoff` → `completed`; the last value is a terminal project state, not a seventh work stage. Chinese labels and high-level objectives belong to the Client locale dictionary. Better Sidebar remains the code-development dock and does not own project lifecycle state.

## Alternatives considered

**Use Plan Mode, Goal, Todo, or workflow phases.** Those values describe one Agent, Session, turn, or workflow run. They cannot authoritatively represent a Workspace project shared by several ordinary Sessions, and workflow phase labels do not define execution structure.

**Persist progress in the browser store.** A browser-local value could render quickly but would diverge across tabs and disappear as an authoritative fact after storage loss. The Host storage domain is already the project-level durable mechanism used beside Workspace.

**Put the stage panel in Better Sidebar.** The right dock owns Files, Editor, Git, and Agent file review. Project lifecycle must remain visible when that optional dock is closed, so the stage UI uses existing Conversation extension points.

**Automatically advance when every fixed file exists.** An Agent can write syntactically complete files while customer questions, rejected decisions, or an unconfirmed architecture remain. Automatic advancement would turn filesystem state into a business decision.

**Let the Agent call a stage-transition tool.** The Agent produces and updates candidate material, but the FDE owns the customer relationship and the decision to accept delivery risk. No model tool can confirm or advance a project stage.

**Expose one generic next-stage or target-stage API.** A generic transition would let the browser skip stage-specific evidence rules. Each shipped gate has its own fixed source state, destination, evidence check, copy, and stable failure codes.

## Consequences

Every project starts visibly at requirements research, all of its Sessions read the same value, and another Workspace cannot inherit that value through cwd or recency. Empty and active conversations use different existing slots without modifying the Conversation shell. Project Progress displays the current stage's fixed inputs and outputs, previews present artifacts through verified same-origin routes, and owns the explicit FDE confirmations. Revision checks turn stale tabs into conflicts instead of duplicate or out-of-order transitions.

All six gates have stage-specific evidence contracts, and the final confirmation preserves the six completed stages while changing the project state to `completed`. A return never deletes Sessions, documents, code, reports, or evidence; the FDE must pass the affected fixed gates again before advancing beyond the former position. Fixed document presence is intentionally weaker than approval; project-specific prototype/API/data/POC, deployment, and enterprise evidence remain FDE review concerns. The stage record keeps return history but still has no complete forward-transition history or browser push channel. The Agent receives only the current active-stage guidance and cannot mutate lifecycle state.
