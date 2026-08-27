# Agent Note: Workspace-scoped FDE stage progress

Status: implemented

English | [中文](2026-08-26-workspace-fde-stage-progress.zh.md)

## Problem

An FDE project spans multiple ordinary Sessions, while DSH planning, goals, todo lists, and workflow runs belong to one Agent or Session. Storing the current delivery stage in one conversation would make another conversation disagree, and storing it in browser state would lose authority on refresh or another page. A file appearing in the Workspace also does not prove that the customer or FDE accepted its contents. Stage progress therefore needs one project-level authority and explicit completion gates that distinguish candidate Agent output from an FDE decision.

## Decision

`@deepseek-ai/dsh-fde-stage` opens one `fde_stage` storage domain with a `projects` table keyed by WorkspaceId. Its trusted same-origin POST route accepts only a registered WorkspaceId, reads the record, or commits the initial `requirements` record before returning it. Two separate fixed completion routes implement only `requirements` to `solution` and `solution` to `development`; neither accepts a browser-supplied target stage. Both require the exact current revision and serialize transitions per Workspace.

The requirement gate reads the three fixed Markdown artifacts under `fde-deliverables/01-requirement-research/`. The solution gate reads the four fixed Markdown artifacts under `fde-deliverables/02-solution-design/` and the current project architecture from `.fde/architecture.json`; all four files must be present and the current architecture revision must have `confirmed` status. File presence only makes the action available. The FDE must confirm again in Project Progress before either route commits the next stage, and the Host rechecks every condition at commit time.

The Host registers the on-demand `fde-requirement-research` and `fde-solution-design` Skills plus one short stage-aware system-prompt section. The Skills constrain Agent output to the fixed project paths, require candidate/unknown distinctions, and prohibit the Agent from confirming customer facts, confirming architecture, or advancing the stage. Architecture updates use `architecture_get` and `architecture_set` rather than direct writes to `.fde/architecture.json`.

`@deepseek-ai/dsh-client-ui-fde-stage` owns one apply-scoped observable controller keyed by WorkspaceId. It resolves Session ownership only from the Workspace projection's `sessionIds`, coalesces duplicate reads, retains explicit errors, and retries only the addressed project. Two contextual registrations share that controller: `conversation.input.dock` shows the initial stage above a blank composer, and `conversation.session.header.utilities` shows the current stage after the Session starts. The blank strip uses the Conversation root's `--dsh-composer-card-max-width` and subtracts both `--dsh-composer-side-clearance` values, so it shares the input card's outer edges even though the Slot itself sits in the wider composer stack. The independent multi-project page and both manual gates belong to [`ui-fde-project`](2026-08-26-project-delivery-pages.md), so project management does not become another Session view.

The product order is `requirements` → `solution` → `development` → `validation` → `pilot` → `handoff`. Chinese labels and high-level objectives belong to the Client locale dictionary. Better Sidebar remains the code-development dock and does not own project lifecycle state.

## Alternatives considered

**Use Plan Mode, Goal, Todo, or workflow phases.** Those values describe one Agent, Session, turn, or workflow run. They cannot authoritatively represent a Workspace project shared by several ordinary Sessions, and workflow phase labels do not define execution structure.

**Persist progress in the browser store.** A browser-local value could render quickly but would diverge across tabs and disappear as an authoritative fact after storage loss. The Host storage domain is already the project-level durable mechanism used beside Workspace.

**Put the stage panel in Better Sidebar.** The right dock owns Files, Editor, Git, and Agent file review. Project lifecycle must remain visible when that optional dock is closed, so the stage UI uses existing Conversation extension points.

**Automatically advance when every fixed file exists.** An Agent can write syntactically complete files while customer questions, rejected decisions, or an unconfirmed architecture remain. Automatic advancement would turn filesystem state into a business decision.

**Let the Agent call a stage-transition tool.** The Agent produces and updates candidate material, but the FDE owns the customer relationship and the decision to accept delivery risk. No model tool can confirm or advance a project stage.

**Expose one generic next-stage or target-stage API.** A generic transition would let the browser skip stage-specific evidence rules. Each shipped gate has its own fixed source stage, destination, evidence check, copy, and stable failure codes; later stages remain unavailable until their contracts are defined.

## Consequences

Every project starts visibly at requirements research, all of its Sessions read the same value, and another Workspace cannot inherit that value through cwd or recency. Empty and active conversations use different existing slots without modifying the Conversation shell. Project Progress displays the current stage's fixed inputs and outputs, previews present artifacts through verified same-origin routes, and owns the explicit FDE confirmations. Revision checks turn stale tabs into conflicts instead of duplicate or out-of-order transitions.

The first two gates now have truthful evidence contracts while development and later stages still have no completion actions. Fixed document presence is intentionally weaker than approval, conditional prototype/API/data/POC evidence remains a manual review concern, and the stage record still has no transition history or browser push channel. The Agent receives only the current stage guidance and cannot mutate lifecycle state.
