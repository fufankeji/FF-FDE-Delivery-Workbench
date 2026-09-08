# Agent Note: Project Center record targets and delivery metadata

Status: implemented

English | [中文](2026-09-08-project-center-navigation-metadata.zh.md)

## Problem

Project Center mixed project update times with the latest conversation title, and clicking could not locate the displayed record. Delivery dates lived only in browser storage, preview rows had no navigation, and timeline counts included projects without dates.

## Decision

The page controller exposes an explicit return to the product homepage, reachable from the Project Center breadcrumb in overview and timeline views. The timeline has a separate return to the complete Project Center overview; it does not require users to infer navigation from card/list controls. Both routes preserve project data and existing Session entry points.

Recent activity separately projects the latest updates of visible ordinary Sessions, stage records and project registration records. Each entry binds its own title, time and target. Session navigation rechecks project membership, existence and ordinary non-archived status before opening that exact Session in Agent Chat. Stage and project records open project management. Unavailable targets produce errors without creating or selecting another Session.

Company and planned dates persist in the registered project's `.fde/project-metadata.json` through the trusted `fde-project` Host route. `ui-workspace` provides the shared client service consumed by creation, sidebar and Project Center. Legacy browser data initializes only missing project records; initialization preserves existing records under a file lock and retains the browser copy. A metadata failure after creation retries data only, without duplicating the project.

Delivery previews show dated unfinished projects ordered by end date, with each row opening its project. The complete timeline retains completed projects' registered dates. Titles, counts and empty states use the dated collection. This decision adds persistence and navigation without changing attention rules or delivery stages.

## Alternatives considered

**Keep separate browser copies of dates.** This cannot make the same project dates available in another browser and leaves sidebar and Project Center with different data sources.

**Always open the project's latest Session from activity.** This opens a different conversation from the historical Session the user selected and breaks record-to-target correspondence.

**Overwrite project records from legacy browser copies.** Old clients may hold outdated dates, so import initializes only missing records.

## Consequences

Latest-record summaries are not a complete event audit log and cannot replay all conversation changes. Dates are registered plans, not proof of contractual commitment or stage approval. Legacy migration requires the original browser to load the new page at least once; other browsers show unregistered dates until then. The endpoint does not edit existing dates.

## Testing

Targeted tests cover real HTTP routes, project isolation, date and file validation, concurrent initialization, legacy import, failed-save recovery, exact Session navigation, activity expansion, timeline counts and all date entry points. Affected package typechecks and client/Host builds pass; both Client bundles served on 3080 match the local build. Browser visual acceptance was not performed in this turn.
