# Agent Note: Workspace-scoped FDE stage progress

Status: implemented

English | [中文](2026-08-26-workspace-fde-stage-progress.zh.md)

## Problem

An FDE project spans multiple ordinary Sessions, while DSH planning, goals, todo lists, and workflow runs belong to one Agent or Session. Storing the current delivery stage in one conversation would make another conversation disagree, and storing it in browser state would lose authority on refresh or another page. The first product slice also has no confirmed stage completion criteria, so exposing an advance action would turn an unverified click into project progress.

## Decision

`@deepseek-ai/dsh-fde-stage` opens one `fde_stage` storage domain with a `projects` table keyed by WorkspaceId. Its trusted same-origin POST route accepts only a registered WorkspaceId, reads the record, or commits the initial `requirements` record before returning it. The request has no target-stage field, and the package registers no model tool or transition service.

`@deepseek-ai/dsh-client-ui-fde-stage` owns one apply-scoped observable controller keyed by WorkspaceId. It resolves Session ownership only from the Workspace projection's `sessionIds`, coalesces duplicate reads, retains explicit errors, and retries only the addressed project. Two contextual registrations share that controller: `conversation.input.dock` shows the initial stage above a blank composer, and `conversation.session.header.utilities` shows the current stage after the Session starts. The blank strip uses the Conversation root's `--dsh-composer-card-max-width` and subtracts both `--dsh-composer-side-clearance` values, so it shares the input card's outer edges even though the Slot itself sits in the wider composer stack. The independent multi-project page belongs to [`ui-fde-project`](2026-08-26-project-delivery-pages.md), so project management does not become another Session view.

The product order is `requirements` → `solution` → `development` → `validation` → `pilot` → `handoff`. Chinese labels and high-level objectives belong to the Client locale dictionary. Better Sidebar remains the code-development dock and does not own project lifecycle state.

## Alternatives considered

**Use Plan Mode, Goal, Todo, or workflow phases.** Those values describe one Agent, Session, turn, or workflow run. They cannot authoritatively represent a Workspace project shared by several ordinary Sessions, and workflow phase labels do not define execution structure.

**Persist progress in the browser store.** A browser-local value could render quickly but would diverge across tabs and disappear as an authoritative fact after storage loss. The Host storage domain is already the project-level durable mechanism used beside Workspace.

**Put the stage panel in Better Sidebar.** The right dock owns Files, Editor, Git, and Agent file review. Project lifecycle must remain visible when that optional dock is closed, so the stage UI uses existing Conversation extension points.

**Allow a manual next-stage button in the first slice.** No stage has confirmed inputs, artifacts, or completion rules yet. Omitting every transition operation keeps progress truthful until F005 can evaluate a real delivery gate.

## Consequences

Every project starts visibly at requirements research, all of its Sessions read the same value, and another Workspace cannot inherit that value through cwd or recency. Empty and active conversations use different existing slots without modifying the Conversation shell. The global project page performs its own Workspace-keyed reads of the same Host route instead of importing another client plugin's values. The current record has no transition history, affected-stage state, or browser push channel; F005 adds those only after the corresponding delivery-gate rules are confirmed. The stage is not model-visible until a later `fde-context` consumer records a reconstructable project snapshot in the addressed Session.
