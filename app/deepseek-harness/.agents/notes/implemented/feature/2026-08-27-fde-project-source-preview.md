# Agent Note: FDE project sources share one identity across progress and delivery

Status: implemented

English | [中文](2026-08-27-fde-project-source-preview.zh.md)

## Problem

The first FDE source slice saved ordinary files under `fde-resources/`, but it had no stable Source identity, processing projection, or read-only review path. Project Progress was also rendered as a translucent shell overlay, so the conversation and composer remained visible underneath. Adding a viewer independently to Project Progress and Better Sidebar would create two format matrices and two file identities, while routing project uploads through the composer would incorrectly imply an Agent turn.

## Decision

`@deepseek-ai/dsh-fde-source` now publishes a stable record for every original under `.fde/sources/`. Existing files that predate the index receive a deterministic SourceId when the project is first listed. Same-origin list, file, and parse routes require an explicit WorkspaceId and SourceId; file reads revalidate the project boundary and never accept an arbitrary absolute path. Local conversion uses `@jiaoqsh/dsh-document@0.1.1` and writes replaceable Markdown to `.fde/derived/` with source size/mtime and parser-version facts. A changed original marks the derived result stale. Parse failure or an OCR requirement updates the Source status and retains the original.

`@deepseek-ai/dsh-client-ui-fde-document-preview` provides one read-only rendering component. It registers Word, Spreadsheet, and Presentation renderers from the Apache-2.0 Flyfish File Viewer stack into Better Sidebar's public `registerFileViewer` service and occupies the `fde.project.source.preview` Slot declared by the FDE Project page. PDF, image, and text project previews use the same wrapper while Better Sidebar keeps its existing native PDF/image/text viewers. Renderer code is emitted as one module-table artifact because the Harness dynamic Client loader cannot resolve package-relative split chunks.

Project Progress keeps `shell.overlay` only as the official root extension point. While open, it marks the page state, hides and disables the mounted center/details work surfaces, hides the Better Sidebar portal, and renders a complete theme-aware page beside the persistent project/session sidebar. Project cards now open a read-only Project Details state first. The details page lists the project's Sources and real save/preview/parse status, hosts the shared preview, permits local parse retry, and exposes an explicit “Enter project delivery” action. Closing the page restores the previously mounted work surfaces without changing a project, Session, or stage.

The project-row upload action still has no Conversation or Agent dependency. After durable publication it broadcasts one project-scoped refresh notification and starts local conversion only for newly saved supported files. Better Sidebar consumes that notification solely to clear its visible tree cache.

## Alternatives considered

**Copy the community Better Sidebar Office viewer.** Its current package is AGPL-3.0 and includes a large prebuilt adaptation. Copying it would change distribution obligations and duplicate the project-details viewer.

**Install the generic file-upload plugin unchanged.** Its composer/session integration conflicts with the confirmed separation between project persistence and explicit conversation intent.

**Store only directory paths and infer identity from filenames.** Filename matching cannot distinguish collisions, renames, or the same filename in multiple projects and would let the two views drift.

**Replace the application router.** Harness does not expose a route-level page API. The existing root Slot remains the smallest compatible extension point; the implementation changes its product behavior from a translucent overlay to a complete page.

## Consequences

Projects now retain one original and one Source identity across source intake, Project Details, Better Sidebar, and future explicit Agent references. DOCX, XLSX, PPTX, PDF, CSV, Markdown, and text conversion is covered by generated in-test samples, so no binary fixtures are committed. OCR, deletion, permission/effectivity, version relationships, and conversation references remain separate future slices.

The Office browser module is intentionally larger than ordinary UI plugins, but it is limited to the three required renderer families and emitted as a single lazy Client plugin artifact. Opening Project Progress hides rather than unmounts the conversation and details trees, preserving their state while ensuring the independent page cannot reveal or operate the underlying delivery surface.
