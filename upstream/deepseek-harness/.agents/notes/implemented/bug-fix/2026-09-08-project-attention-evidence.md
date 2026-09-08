# Agent Note: Project Center attention requires specific facts

Status: implemented

English | [中文](2026-09-08-project-attention-evidence.zh.md)

## Problem

Selecting priority projects by loading state, running Sessions and incomplete delivery mislabels background loading and ordinary work as human action items. Review prerequisites also include materials not yet produced, so their entire list cannot represent business risk.

## Decision

Project Center derives attention reasons from explicit unresolved issues in the current stage, actually failed tests or delivery records for the current version, Host review readiness, valid registered plan dates and read errors. Cards show a reason label and concrete issue; lists, the top summary, counts, filters and priority sorting reuse that decision. Completed projects, historical stages, resolved issues, ordinary incomplete work and loading do not automatically create action items. Default collection sorting remains recent activity; only explicit priority sorting uses reason severity.

## Alternatives considered

**Prioritize every unfinished project.** This cannot explain why intervention is needed now and therefore does not justify an action item.

**Use every review prerequisite gap.** A file not yet produced represents ordinary progress, not an observed business blocker; only explicit issues and executed results count.

## Consequences

Without supporting facts there may be no priority project; an absence of registered action items does not assert that every project is confirmed risk-free. Registered dates are plans, not contractual commitments. The legacy lifecycle retains its corresponding human confirmation actions. This attention change introduces no storage, model calls or stage advancement, and does not special-case project names.
