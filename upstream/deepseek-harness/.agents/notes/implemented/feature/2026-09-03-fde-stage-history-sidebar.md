# Agent Note: Project stage history and sidebar use one data-driven structure

Status: implemented

English | [中文](2026-09-03-fde-stage-history-sidebar.zh.md)

## Problem

The completed-stage history view used plain text cards that did not clearly relate inputs, saved stage records, the human decision, and archival state. The project sidebar also required two disclosures—stage row, then “Current stage methods”—before showing the method catalog. That extra layer consumed vertical space and implied that the intermediate row was a separate business object.

## Decision

Completed discovery uses a shared history structure. Its hero shows stage identity, counts derived from real materials and records, and the human gate. The evidence chain continues to project Sources, Artifacts, workflow, blockers, and stage state from the current Workspace. No project name or business record is fixed in presentation code, and missing facts remain unregistered. The dedicated SVG is decorative only and carries no text, data, or interaction.

The project workbench opens the left sidebar at 354px so the nine method labels stay on one line while the eight-stage timeline remains reachable. The current or viewed stage row is itself the collapsed-by-default catalog disclosure. Clicking it loads and shows the Host-registered required and conditional methods directly; clicking it again collapses the catalog. Selecting another stage changes the read-only view and expands that stage in the same action. Method definitions, fixed provenance, and runtime Skill routing do not change.

## Alternatives considered

**Keep the “Current stage methods” intermediate disclosure.** Rejected because it owns no independent state or business meaning, duplicates the stage row's disclosure role, and consumes vertical space.

**Embed the reference project's name, files, and counts.** Rejected because the history view must work for every FDE project and may show only records derived from the current Workspace.

## Consequences

Any project that completed discovery and advanced can reuse the same history structure with its own real data. The sidebar removes one interaction level while the method catalog remains lazy-loaded, retryable, and linked to read-only definitions. Other stage-history views do not gain the same visual treatment from this decision.
