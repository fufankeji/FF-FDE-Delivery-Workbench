# Agent Note: Remove the FDE requirement Wiki

Status: implemented

English | [中文](2026-09-03-remove-fde-requirement-wiki.zh.md)

## Problem

The requirement Wiki synthesized explicitly selected, locally parsed project Sources into source-cited pages, relations, conflicts, and unknowns, then published one immutable revision and rendered it through Galaxy View plus an accessible list. That traceable cross-document view was useful in isolation, but it duplicated the current FDE product path in which project Sources and fixed requirement artifacts already carry evidence into human confirmation. Keeping the parallel path also retained two model-visible schemas, a separate on-disk lifecycle, Session/provider/model confirmation logic, Three.js client weight, polling, and five extra Project Details sections for a capability the product no longer needs.

## Decision

The FDE project packages provide no requirement-Wiki runtime. `@deepseek-ai/dsh-fde-project` does not register Wiki tools or start/cancel routes, read or publish Wiki revisions, or include Wiki state in the project snapshot. `@deepseek-ai/dsh-client-ui-fde-project` does not create a Wiki controller, queue Wiki prompts, poll builds, render Wiki/issues/Galaxy sections, or depend on Three.js and model-directory services for that flow. Project Details keeps project Source ingestion, local parsing and preview, the three fixed requirement-research artifacts, and the FDE-controlled requirement gate.

Existing `.fde/requirement-wiki/` directories are inert user-project data. The product neither reads nor mutates them, and the removal does not scan unrelated Workspaces to delete prior generated files.

## Verification

The published Host and Client bundles contain no Wiki route, tool, controller, prompt, panel, Galaxy implementation, or dependency. Focused Host and Client tests cover the surviving project snapshot, plugin application, Project Details, Source path, and delivery close-out behavior. The generated tool catalog contains only the remaining FDE architecture and OpenAPI tools.

## Alternatives considered

**Hide the Wiki UI but keep the Host tools and storage.** Rejected because the model schemas, write path, Source dependency, persistent state machine, and maintenance burden would remain even though users could not reach the result.

**Keep read-only compatibility for existing Wiki revisions.** Rejected because it would preserve snapshot types, parsers, UI branches, and a compatibility contract for a pre-release capability with no current product consumer. Existing files remain recoverable directly from the project directory without a supported runtime path.

**Remove Galaxy View but retain a list-only Wiki.** Rejected because the duplicate synthesis, model authorization, provenance validation, revision publication, conflicts, and unknowns would still form a second requirement workflow beside fixed artifacts.

## Consequences

The project has one requirement path: Sources feed visible Agent work and fixed requirement artifacts, and an FDE confirms the resulting baseline. Every Agent request loses the two Wiki tool schemas, the client no longer carries Three.js for this feature, and the Host no longer owns a second Source-derived revision lifecycle.

The product gives up source-cited cross-document knowledge pages, relation browsing, conflict and unknown aggregation, immutable Wiki history, and the Galaxy visualization with its semantic fallback. Reintroducing any of those capabilities requires a new explicit product Feature that demonstrates why fixed artifacts and ordinary Source references cannot satisfy the user journey, defines its model and data authorization, and restores end-to-end absence-to-publication coverage rather than reviving the deleted implementation by default.
