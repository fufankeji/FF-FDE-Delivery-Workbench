# Agent Note: FDE project-development docs and progress

Status: implemented

English | [中文](2026-08-27-fde-project-development-docs.zh.md)

## Problem

Project development needed more than a code dock. An FDE may use repeated Agent conversations to refine PRDs, specifications, implementation plans, tasks, tests, and evidence, while a less experienced developer needs one visible workflow that explains what exists, what is still unknown, and what may enter validation. Reusing a generic task board would create a second source of truth beside project Markdown, and automatically advancing from file existence would let Agent output make a business decision.

## Decision

The Host registers one on-demand `fde-project-development` Skill. It adopts a lightweight spec-first order inspired by Spec Kit, but edits the project's canonical `docs/` tree directly: `docs/PRD.md`, `docs/specs/product-spec.md`, `docs/specs/feature-map.md`, and `docs/specs/FNNN-slug/{spec,plan,tasks}.md`. It does not install another CLI, impose branch names, or create a task database. Unknown dates remain "待确认", and a checked Markdown task requires source, test, build, or runtime evidence.

`@deepseek-ai/dsh-fde-project` adds a bounded, read-only development projection. It scans at most 100 canonical Feature directories, parses a small frontmatter allowlist, counts Markdown tasks, reports duplicate Feature ids, and indexes three close-out files under `fde-deliverables/03-project-development/`. Preview routes accept only Host-indexed artifact ids and repeat a realpath-inside-Workspace check before serving bytes; the browser cannot submit an arbitrary path.

Project Progress renders core docs, Feature status, task evidence, planned dates, milestones, blockers, document previews, and close-out files from that projection. It never writes task state. Evaluation becomes available when development starts; Observability remains gated to validation. Three close-out files only enable the FDE action. A two-step confirmation calls a dedicated `development` to `validation` Host route, which rechecks the files, current stage, and exact revision. The Agent and Skill have no stage-transition capability.

## Alternatives considered

**Install GitHub Spec Kit unchanged.** Its CLI, branch workflow, and generated state are useful for repository bootstrapping but would duplicate the existing FDE documentation contract and make installation a runtime requirement.

**Store tasks in a dashboard database.** That would require synchronization and conflict rules between UI state and Markdown. The project docs remain authoritative instead.

**Derive progress from Git commits or file timestamps.** These signals do not prove acceptance, test evidence, dates, or task completion, and they are unavailable in imported non-Git projects.

**Advance automatically when tasks or close-out files are complete.** The FDE owns risk acceptance. File presence only enables review and never changes the stage.

## Consequences

Imported and Agent-built projects can show a consistent development plan without adopting a second workflow engine. Existing source projects can be reverse-documented into the same shape and immediately exercise the UI. Missing or malformed documents remain visible instead of being repaired silently. The first implementation does not edit docs, estimate schedules, draw a dependency Gantt, or validate the semantic quality of a checked task; those remain FDE and project-tool responsibilities.
